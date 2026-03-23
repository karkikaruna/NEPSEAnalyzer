from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import mysql.connector
from mysql.connector import pooling
import os, hashlib, secrets, time
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="NEPSE API — Optimized")

app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

DB_CONFIG = {
    "host":          os.getenv("DB_HOST",     "localhost"),
    "port":          int(os.getenv("DB_PORT", 3306)),
    "user":          os.getenv("DB_USER",     "root"),
    "password":      os.getenv("DB_PASSWORD", ""),
    "database":      os.getenv("DB_NAME",     "nepse_db"),
}

pool = pooling.MySQLConnectionPool(
    pool_name="nepse_pool",
    pool_size=10,         
    pool_reset_session=True,
    **DB_CONFIG
)
print(f"[API] Pool ready → {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")


def get_conn():
    return pool.get_connection()


def rows_to_dicts(cursor):
    cols = [d[0] for d in cursor.description]
    result = []
    for row in cursor.fetchall():
        d = {}
        for col, val in zip(cols, row):
            if isinstance(val, Decimal):             d[col] = float(val)
            elif isinstance(val, (date, datetime)):  d[col] = str(val)
            else:                                    d[col] = val
        result.append(d)
    return result


_cache: dict = {}

def cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None

def cache_set(key: str, data, ttl_seconds: int):
    _cache[key] = {"data": data, "expires": time.time() + ttl_seconds}

def cache_clear(pattern: str = None):
    """Clear cache entries. Pass pattern to clear specific keys."""
    if pattern is None:
        _cache.clear()
    else:
        keys = [k for k in _cache if pattern in k]
        for k in keys:
            del _cache[k]


def latest_date() -> str:
    cached = cache_get("latest_date")
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT MAX(trading_date) FROM stocks")
    row = cur.fetchone(); cur.close(); conn.close()
    result = str(row[0]) if row and row[0] else str(date.today())
    cache_set("latest_date", result, 300)   # cache 5 mins
    return result


def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()
security = HTTPBearer(auto_error=False)

def get_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds: raise HTTPException(401, "Not authenticated")
    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        "SELECT user_id FROM user_sessions WHERE token=%s AND expires_at>NOW()",
        (creds.credentials,)
    )
    row = cur.fetchone(); cur.close(); conn.close()
    if not row: raise HTTPException(401, "Invalid or expired token")
    return row[0]


class RegisterReq(BaseModel): username: str; email: str; password: str
class LoginReq(BaseModel):    email: str; password: str
class WatchlistReq(BaseModel): symbol: str
class PortfolioReq(BaseModel): symbol: str; kitta: int; buy_price: float


def init_tables():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS users(
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE, password VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;""")
    cur.execute("""CREATE TABLE IF NOT EXISTS user_sessions(
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token(token)) ENGINE=InnoDB;""")
    cur.execute("""CREATE TABLE IF NOT EXISTS watchlist(
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_sym(user_id,symbol),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB;""")
    cur.execute("""CREATE TABLE IF NOT EXISTS portfolio(
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL, kitta INT NOT NULL DEFAULT 0,
        buy_price DECIMAL(12,2) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_port_sym(user_id,symbol),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_uid(user_id)) ENGINE=InnoDB;""")
    conn.commit(); cur.close(); conn.close()
    print("[API] Tables ready ✓")

init_tables()


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/nepse/auth/register")
def register(req: RegisterReq):
    if len(req.username.strip()) < 2: raise HTTPException(400, "Username too short")
    if len(req.password) < 6:         raise HTTPException(400, "Password min 6 chars")
    if "@" not in req.email:          raise HTTPException(400, "Invalid email")
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("INSERT INTO users(username,email,password)VALUES(%s,%s,%s)",
            (req.username.strip(), req.email.lower().strip(), hash_pw(req.password)))
        conn.commit(); cur.close(); conn.close()
        return {"message": "Account created"}
    except mysql.connector.IntegrityError:
        raise HTTPException(409, "Username or email already exists")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/nepse/auth/login")
def login(req: LoginReq):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id,username,email FROM users WHERE email=%s AND password=%s",
        (req.email.lower().strip(), hash_pw(req.password)))
    row = cur.fetchone()
    if not row: cur.close(); conn.close(); raise HTTPException(401, "Invalid email or password")
    uid, uname, email = row
    token = secrets.token_hex(32)
    cur.execute("INSERT INTO user_sessions(user_id,token,expires_at)VALUES(%s,%s,DATE_ADD(NOW(),INTERVAL 7 DAY))",
        (uid, token))
    conn.commit(); cur.close(); conn.close()
    return {"token": token, "user_id": uid, "username": uname, "email": email}


@app.post("/nepse/auth/logout")
def logout(creds: HTTPAuthorizationCredentials = Depends(security)):
    if creds:
        try:
            conn = get_conn(); cur = conn.cursor()
            cur.execute("DELETE FROM user_sessions WHERE token=%s", (creds.credentials,))
            conn.commit(); cur.close(); conn.close()
        except: pass
    return {"message": "Logged out"}


@app.get("/nepse/auth/me")
def me(uid: int = Depends(get_user)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id,username,email,created_at FROM users WHERE id=%s", (uid,))
    row = cur.fetchone(); cur.close(); conn.close()
    if not row: raise HTTPException(404, "Not found")
    return {"id": row[0], "username": row[1], "email": row[2], "created_at": str(row[3])}

@app.get("/nepse/dashboard")
def dashboard(trading_date: Optional[str] = Query(None)):
    """
    Single endpoint that returns ALL dashboard data in one DB round-trip.
    Replaces 5 separate calls with 1 — much faster page load.
    Cached for 5 minutes.
    """
    if not trading_date: trading_date = latest_date()
    cache_key = f"dashboard:{trading_date}"
    cached = cache_get(cache_key)
    if cached: return cached

    conn = get_conn(); cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*) AS total_symbols, SUM(volume) AS total_volume,
            SUM(turnover) AS total_turnover, AVG(close_price) AS avg_close,
            MAX(high_price) AS market_high, MIN(low_price) AS market_low,
            SUM(CASE WHEN close_price>open_price THEN 1 ELSE 0 END) AS gainers,
            SUM(CASE WHEN close_price<open_price THEN 1 ELSE 0 END) AS losers,
            SUM(CASE WHEN close_price=open_price THEN 1 ELSE 0 END) AS unchanged
        FROM stocks WHERE trading_date=%s
    """, (trading_date,))
    summary = rows_to_dicts(cur)[0]

    cur.execute("""
        SELECT symbol, open_price, close_price,
            ROUND((close_price-open_price)/open_price*100,2) AS change_pct,
            volume, turnover
        FROM stocks WHERE trading_date=%s AND open_price>0
        ORDER BY change_pct DESC LIMIT 8
    """, (trading_date,))
    gainers = rows_to_dicts(cur)

    cur.execute("""
        SELECT symbol, open_price, close_price,
            ROUND((close_price-open_price)/open_price*100,2) AS change_pct,
            volume, turnover
        FROM stocks WHERE trading_date=%s AND open_price>0
        ORDER BY change_pct ASC LIMIT 8
    """, (trading_date,))
    losers = rows_to_dicts(cur)

    trend_key = "nepse_trend"
    trend = cache_get(trend_key)
    if not trend:
        cur.execute("""
            SELECT trading_date,
                ROUND(AVG(close_price),2)    AS avg_close,
                ROUND(SUM(turnover)/1e7,2)   AS total_turnover_cr,
                COUNT(*)                      AS symbols_traded
            FROM stocks GROUP BY trading_date
            ORDER BY trading_date DESC LIMIT 60
        """)
        trend = rows_to_dicts(cur)
        trend.reverse()
        cache_set(trend_key, trend, 600)   

    cur.close(); conn.close()

    result = {
        "trading_date": trading_date,
        "summary":      summary,
        "gainers":      gainers,
        "losers":       losers,
        "trend":        trend,
    }
    cache_set(cache_key, result, 300) 
    return result

@app.get("/nepse/symbols")
def get_symbols():
    cached = cache_get("symbols")
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT DISTINCT symbol FROM stocks ORDER BY symbol ASC")
    result = {"symbols": [r[0] for r in cur.fetchall()]}
    cur.close(); conn.close()
    cache_set("symbols", result, 600)
    return result

@app.get("/nepse/watchlist")
def get_watchlist(uid: int = Depends(get_user)):
    ld = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT w.symbol, w.added_at,
               s.open_price, s.high_price, s.low_price,
               s.close_price, s.volume, s.turnover, s.trading_date
        FROM watchlist w
        LEFT JOIN stocks s ON w.symbol=s.symbol AND s.trading_date=%s
        WHERE w.user_id=%s ORDER BY w.added_at DESC
    """, (ld, uid))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"data": data, "trading_date": ld}


@app.post("/nepse/watchlist")
def add_watchlist(req: WatchlistReq, uid: int = Depends(get_user)):
    sym = req.symbol.upper().strip()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stocks WHERE symbol=%s", (sym,))
    if cur.fetchone()[0] == 0:
        cur.close(); conn.close()
        raise HTTPException(404, f"'{sym}' not found")
    try:
        cur.execute("INSERT INTO watchlist(user_id,symbol)VALUES(%s,%s)", (uid, sym))
        conn.commit(); cur.close(); conn.close()
        return {"message": f"{sym} added"}
    except mysql.connector.IntegrityError:
        cur.close(); conn.close()
        raise HTTPException(409, f"{sym} already in watchlist")


@app.delete("/nepse/watchlist/{symbol}")
def del_watchlist(symbol: str, uid: int = Depends(get_user)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM watchlist WHERE user_id=%s AND symbol=%s", (uid, symbol.upper()))
    conn.commit(); affected = cur.rowcount; cur.close(); conn.close()
    if affected == 0: raise HTTPException(404, "Not in watchlist")
    return {"message": f"{symbol.upper()} removed"}


# ── Portfolio ─────────────────────────────────────────────────────────────────
@app.get("/nepse/portfolio")
def get_portfolio(uid: int = Depends(get_user)):
    ld = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT p.symbol, p.kitta, p.buy_price, p.added_at,
               s.close_price, s.open_price, s.high_price, s.low_price,
               s.volume, s.turnover, s.trading_date
        FROM portfolio p
        LEFT JOIN stocks s ON p.symbol=s.symbol AND s.trading_date=%s
        WHERE p.user_id=%s ORDER BY p.added_at DESC
    """, (ld, uid))
    rows = rows_to_dicts(cur); cur.close(); conn.close()
    for r in rows:
        cp = float(r.get("close_price") or 0)
        bp = float(r["buy_price"]); k = int(r["kitta"])
        r["current_value"]   = round(cp * k, 2)
        r["invested_amount"] = round(bp * k, 2)
        r["profit_loss"]     = round((cp - bp) * k, 2)
        r["profit_loss_pct"] = round((cp - bp) / bp * 100, 2) if bp else 0
    ti = sum(r["invested_amount"] for r in rows)
    tc = sum(r["current_value"]   for r in rows)
    pl = round(tc - ti, 2)
    return {
        "data": rows, "trading_date": ld,
        "summary": {"total_invested": ti, "total_current": tc, "total_pl": pl,
                    "total_pl_pct": round(pl/ti*100,2) if ti else 0, "holdings": len(rows)}
    }


@app.post("/nepse/portfolio")
def add_portfolio(req: PortfolioReq, uid: int = Depends(get_user)):
    sym = req.symbol.upper().strip()
    if req.kitta <= 0: raise HTTPException(400, "Kitta must be > 0")
    if req.buy_price <= 0: raise HTTPException(400, "Buy price must be > 0")
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stocks WHERE symbol=%s", (sym,))
    if cur.fetchone()[0] == 0:
        cur.close(); conn.close(); raise HTTPException(404, f"'{sym}' not found")
    try:
        cur.execute("""INSERT INTO portfolio(user_id,symbol,kitta,buy_price)VALUES(%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE kitta=VALUES(kitta),buy_price=VALUES(buy_price)""",
            (uid, sym, req.kitta, req.buy_price))
        conn.commit(); cur.close(); conn.close()
        return {"message": f"{sym} added"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/nepse/portfolio/{symbol}")
def del_portfolio(symbol: str, uid: int = Depends(get_user)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM portfolio WHERE user_id=%s AND symbol=%s", (uid, symbol.upper()))
    conn.commit(); affected = cur.rowcount; cur.close(); conn.close()
    if affected == 0: raise HTTPException(404, "Not in portfolio")
    return {"message": f"{symbol.upper()} removed"}


# ── Candlestick — cached per symbol ──────────────────────────────────────────
@app.get("/nepse/candles/{symbol}")
def candles(symbol: str, days: int = Query(90, ge=5, le=365)):
    cache_key = f"candles:{symbol.upper()}:{days}"
    cached = cache_get(cache_key)
    if cached: return cached

    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT trading_date, open_price, high_price, low_price,
               close_price, volume, turnover
        FROM stocks
        WHERE symbol=%s AND open_price IS NOT NULL AND close_price IS NOT NULL
              AND open_price > 0 AND close_price > 0
        ORDER BY trading_date ASC
        LIMIT %s
    """, (symbol.upper(), days))
    rows = rows_to_dicts(cur); cur.close(); conn.close()

    if not rows:
        raise HTTPException(404, f"No candle data for {symbol.upper()}. Run: python load_history.py --symbol {symbol.upper()} --days {days}")

    closes = [float(r["close_price"]) for r in rows]
    highs  = [float(r["high_price"])  for r in rows]
    lows   = [float(r["low_price"])   for r in rows]
    first  = closes[0]; last = closes[-1]
    chg    = round((last - first) / first * 100, 2) if first else 0

    result = {
        "symbol": symbol.upper(), "candles": rows,
        "summary": {"days": len(rows), "period_high": max(highs), "period_low": min(lows),
                    "first_close": first, "last_close": last, "change_pct": chg}
    }
    cache_set(cache_key, result, 300)  # cache 5 mins
    return result


# ── Other endpoints ───────────────────────────────────────────────────────────
@app.get("/nepse/health")
def health():
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM stocks"); count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(DISTINCT trading_date) FROM stocks"); dates = cur.fetchone()[0]
        cur.close(); conn.close()
        return {"status": "ok", "stocks_rows": count, "trading_dates": dates, "cache_entries": len(_cache)}
    except Exception as e:
        return JSONResponse(500, {"status": "error", "detail": str(e)})


@app.get("/nepse/dates")
def get_dates():
    cached = cache_get("dates")
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT DISTINCT trading_date FROM stocks ORDER BY trading_date DESC LIMIT 60")
    result = {"dates": [str(r[0]) for r in cur.fetchall()]}
    cur.close(); conn.close()
    cache_set("dates", result, 300)
    return result


@app.get("/nepse/stocks")
def get_stocks(
    trading_date: Optional[str] = Query(None),
    symbol:       Optional[str] = Query(None),
    limit: int  = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("turnover"),
    order: str   = Query("desc"),
):
    allowed = {"symbol","open_price","high_price","low_price","close_price","volume","turnover"}
    if sort_by not in allowed: sort_by = "turnover"
    order = "ASC" if order.lower() == "asc" else "DESC"
    if not trading_date: trading_date = latest_date()
    filters = ["trading_date=%s"]; params = [trading_date]
    if symbol: filters.append("symbol LIKE %s"); params.append(f"%{symbol.upper()}%")
    where = " AND ".join(filters)
    conn = get_conn(); cur = conn.cursor()
    cur.execute(
        f"SELECT symbol,trading_date,open_price,high_price,low_price,close_price,volume,turnover "
        f"FROM stocks WHERE {where} ORDER BY {sort_by} {order} LIMIT %s OFFSET %s",
        params + [limit, offset]
    )
    data = rows_to_dicts(cur)
    cur.execute(f"SELECT COUNT(*) FROM stocks WHERE {where}", params)
    total = cur.fetchone()[0]; cur.close(); conn.close()
    return {"trading_date": trading_date, "total": total, "data": data}


@app.get("/nepse/market-summary")
def market_summary(trading_date: Optional[str] = Query(None)):
    if not trading_date: trading_date = latest_date()
    cache_key = f"summary:{trading_date}"
    cached = cache_get(cache_key)
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) AS total_symbols, SUM(volume) AS total_volume,
            SUM(turnover) AS total_turnover, AVG(close_price) AS avg_close,
            MAX(high_price) AS market_high, MIN(low_price) AS market_low,
            SUM(CASE WHEN close_price>open_price THEN 1 ELSE 0 END) AS gainers,
            SUM(CASE WHEN close_price<open_price THEN 1 ELSE 0 END) AS losers,
            SUM(CASE WHEN close_price=open_price THEN 1 ELSE 0 END) AS unchanged
        FROM stocks WHERE trading_date=%s
    """, (trading_date,))
    summary = rows_to_dicts(cur)[0]; cur.close(); conn.close()
    result = {"trading_date": trading_date, "summary": summary}
    cache_set(cache_key, result, 300)
    return result


@app.get("/nepse/top-gainers")
def top_gainers(trading_date: Optional[str] = Query(None), limit: int = Query(10)):
    if not trading_date: trading_date = latest_date()
    cache_key = f"gainers:{trading_date}:{limit}"
    cached = cache_get(cache_key)
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT symbol, open_price, close_price,
            ROUND((close_price-open_price)/open_price*100,2) AS change_pct, volume, turnover
        FROM stocks WHERE trading_date=%s AND open_price>0
        ORDER BY change_pct DESC LIMIT %s
    """, (trading_date, limit))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    result = {"trading_date": trading_date, "data": data}
    cache_set(cache_key, result, 300)
    return result


@app.get("/nepse/top-losers")
def top_losers(trading_date: Optional[str] = Query(None), limit: int = Query(10)):
    if not trading_date: trading_date = latest_date()
    cache_key = f"losers:{trading_date}:{limit}"
    cached = cache_get(cache_key)
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT symbol, open_price, close_price,
            ROUND((close_price-open_price)/open_price*100,2) AS change_pct, volume, turnover
        FROM stocks WHERE trading_date=%s AND open_price>0
        ORDER BY change_pct ASC LIMIT %s
    """, (trading_date, limit))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    result = {"trading_date": trading_date, "data": data}
    cache_set(cache_key, result, 300)
    return result


@app.get("/nepse/nepse-index")
def nepse_index(days: int = Query(60, ge=10, le=365)):
    cache_key = f"index:{days}"
    cached = cache_get(cache_key)
    if cached: return cached
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT trading_date,
            ROUND(AVG(close_price),2)   AS avg_close,
            ROUND(SUM(turnover)/1e7,2)  AS total_turnover_cr,
            COUNT(*)                     AS symbols_traded
        FROM stocks GROUP BY trading_date
        ORDER BY trading_date DESC LIMIT %s
    """, (days,))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    data.reverse()
    result = {"data": data}
    cache_set(cache_key, result, 600)
    return result


@app.get("/nepse/fetch-logs")
def fetch_logs(limit: int = Query(20)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM fetch_logs ORDER BY fetched_at DESC LIMIT %s", (limit,))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"logs": data}


@app.post("/nepse/cache/clear")
def clear_cache():
    """Clear all cached data — call this after fetching new data."""
    cache_clear()
    return {"message": "Cache cleared", "entries_cleared": len(_cache)}
