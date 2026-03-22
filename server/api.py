"""
NEPSE REST API v4 — FastAPI + MySQL (Cloud or Local)
Features: Auth, Watchlist, Portfolio, Candlestick, NEPSE Index
"""

from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import mysql.connector
import os, hashlib, secrets, ssl
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="NEPSE API v4")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME",     "nepse_db"),
}

SSL_CA = os.getenv("DB_SSL_CA", "")
if SSL_CA and os.path.exists(SSL_CA):
    DB_CONFIG["ssl_ca"]          = SSL_CA
    DB_CONFIG["ssl_verify_cert"] = True
    print(f"[API] SSL enabled with CA: {SSL_CA}")

print(f"[API] DB → {DB_CONFIG['host']}:{DB_CONFIG['port']} / {DB_CONFIG['database']}")

security = HTTPBearer(auto_error=False)

class RegisterRequest(BaseModel):
    username: str; email: str; password: str

class LoginRequest(BaseModel):
    email: str; password: str

class WatchlistRequest(BaseModel):
    symbol: str

class PortfolioRequest(BaseModel):
    symbol: str
    kitta:  int      
    buy_price: float

def get_conn():
    return mysql.connector.connect(**DB_CONFIG)

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

def latest_date() -> str:
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT MAX(trading_date) FROM stocks")
    row = cur.fetchone(); cur.close(); conn.close()
    return str(row[0]) if row and row[0] else str(date.today())

def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def get_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials: raise HTTPException(401, "Not authenticated")
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT user_id FROM user_sessions WHERE token=%s AND expires_at>NOW()", (credentials.credentials,))
    row = cur.fetchone(); cur.close(); conn.close()
    if not row: raise HTTPException(401, "Invalid or expired token")
    return row[0]

def init_tables():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE, password VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;""")
    cur.execute("""CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token (token)) ENGINE=InnoDB;""")
    cur.execute("""CREATE TABLE IF NOT EXISTS watchlist (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_symbol (user_id, symbol),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB;""")
    cur.execute("""CREATE TABLE IF NOT EXISTS portfolio (
        id         INT           AUTO_INCREMENT PRIMARY KEY,
        user_id    INT           NOT NULL,
        symbol     VARCHAR(20)   NOT NULL,
        kitta      INT           NOT NULL DEFAULT 0,
        buy_price  DECIMAL(12,2) NOT NULL,
        added_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_port_symbol (user_id, symbol),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_port_uid (user_id)
    ) ENGINE=InnoDB;""")
    conn.commit(); cur.close(); conn.close()
    print("[API] All tables ready ✓")

init_tables()

@app.post("/nepse/auth/register")
def register(req: RegisterRequest):
    if len(req.username.strip()) < 2: raise HTTPException(400, "Username too short")
    if len(req.password) < 6:         raise HTTPException(400, "Password min 6 chars")
    if "@" not in req.email:          raise HTTPException(400, "Invalid email")
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("INSERT INTO users (username,email,password) VALUES (%s,%s,%s)",
                    (req.username.strip(), req.email.lower().strip(), hash_pw(req.password)))
        conn.commit(); cur.close(); conn.close()
        return {"message": "Account created"}
    except mysql.connector.IntegrityError:
        raise HTTPException(409, "Username or email already exists")

@app.post("/nepse/auth/login")
def login(req: LoginRequest):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id,username,email FROM users WHERE email=%s AND password=%s",
                (req.email.lower().strip(), hash_pw(req.password)))
    row = cur.fetchone()
    if not row: cur.close(); conn.close(); raise HTTPException(401, "Invalid email or password")
    user_id, username, email = row
    token = secrets.token_hex(32)
    cur.execute("INSERT INTO user_sessions (user_id,token,expires_at) VALUES (%s,%s,DATE_ADD(NOW(),INTERVAL 7 DAY))",
                (user_id, token))
    conn.commit(); cur.close(); conn.close()
    return {"token": token, "user_id": user_id, "username": username, "email": email}

@app.post("/nepse/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials:
        try:
            conn = get_conn(); cur = conn.cursor()
            cur.execute("DELETE FROM user_sessions WHERE token=%s", (credentials.credentials,))
            conn.commit(); cur.close(); conn.close()
        except: pass
    return {"message": "Logged out"}

@app.get("/nepse/auth/me")
def me(user_id: int = Depends(get_user)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id,username,email,created_at FROM users WHERE id=%s", (user_id,))
    row = cur.fetchone(); cur.close(); conn.close()
    if not row: raise HTTPException(404, "User not found")
    return {"id": row[0], "username": row[1], "email": row[2], "created_at": str(row[3])}

@app.get("/nepse/watchlist")
def get_watchlist(user_id: int = Depends(get_user)):
    ld = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT w.symbol, w.added_at,
               s.open_price, s.high_price, s.low_price,
               s.close_price, s.volume, s.turnover, s.trading_date
        FROM watchlist w
        LEFT JOIN stocks s ON w.symbol=s.symbol AND s.trading_date=%s
        WHERE w.user_id=%s ORDER BY w.added_at DESC
    """, (ld, user_id))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"data": data, "trading_date": ld}

@app.post("/nepse/watchlist")
def add_watchlist(req: WatchlistRequest, user_id: int = Depends(get_user)):
    sym = req.symbol.upper().strip()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stocks WHERE symbol=%s", (sym,))
    if cur.fetchone()[0] == 0:
        cur.close(); conn.close(); raise HTTPException(404, f"Symbol '{sym}' not found")
    try:
        cur.execute("INSERT INTO watchlist (user_id,symbol) VALUES (%s,%s)", (user_id, sym))
        conn.commit(); cur.close(); conn.close()
        return {"message": f"{sym} added"}
    except mysql.connector.IntegrityError:
        cur.close(); conn.close(); raise HTTPException(409, f"{sym} already in watchlist")

@app.delete("/nepse/watchlist/{symbol}")
def del_watchlist(symbol: str, user_id: int = Depends(get_user)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM watchlist WHERE user_id=%s AND symbol=%s", (user_id, symbol.upper()))
    conn.commit(); affected = cur.rowcount; cur.close(); conn.close()
    if affected == 0: raise HTTPException(404, "Symbol not in watchlist")
    return {"message": f"{symbol.upper()} removed"}

@app.get("/nepse/portfolio")
def get_portfolio(user_id: int = Depends(get_user)):
    """
    Returns portfolio with current market value, profit/loss per holding.
    SQL: JOIN portfolio with latest stocks to compute current value.
    """
    ld = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT
            p.symbol,
            p.kitta,
            p.buy_price,
            p.added_at,
            s.close_price  AS current_price,
            s.open_price,
            s.high_price,
            s.low_price,
            s.volume,
            s.turnover,
            s.trading_date,
            (p.kitta * p.buy_price)                              AS invested_amount,
            (p.kitta * COALESCE(s.close_price, p.buy_price))     AS current_value,
            (p.kitta * (COALESCE(s.close_price, p.buy_price) - p.buy_price)) AS profit_loss,
            ROUND(
                (COALESCE(s.close_price, p.buy_price) - p.buy_price)
                / p.buy_price * 100, 2
            )                                                    AS profit_loss_pct
        FROM portfolio p
        LEFT JOIN stocks s ON p.symbol = s.symbol AND s.trading_date = %s
        WHERE p.user_id = %s
        ORDER BY p.added_at DESC
    """, (ld, user_id))
    holdings = rows_to_dicts(cur)

    total_invested = sum(float(h["invested_amount"] or 0) for h in holdings)
    total_current  = sum(float(h["current_value"]   or 0) for h in holdings)
    total_pl       = total_current - total_invested
    total_pl_pct   = round((total_pl / total_invested * 100) if total_invested else 0, 2)

    cur.close(); conn.close()
    return {
        "holdings":       holdings,
        "trading_date":   ld,
        "summary": {
            "total_invested":    total_invested,
            "total_current":     total_current,
            "total_profit_loss": total_pl,
            "total_pl_pct":      total_pl_pct,
            "total_stocks":      len(holdings),
        }
    }

@app.post("/nepse/portfolio")
def add_portfolio(req: PortfolioRequest, user_id: int = Depends(get_user)):
    sym = req.symbol.upper().strip()
    if req.kitta <= 0:     raise HTTPException(400, "Kitta must be greater than 0")
    if req.buy_price <= 0: raise HTTPException(400, "Buy price must be greater than 0")
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stocks WHERE symbol=%s", (sym,))
    if cur.fetchone()[0] == 0:
        cur.close(); conn.close(); raise HTTPException(404, f"Symbol '{sym}' not found")
    try:
        cur.execute(
            "INSERT INTO portfolio (user_id,symbol,kitta,buy_price) VALUES (%s,%s,%s,%s)",
            (user_id, sym, req.kitta, req.buy_price)
        )
        conn.commit(); cur.close(); conn.close()
        return {"message": f"{sym} added to portfolio ({req.kitta} kitta @ ₨{req.buy_price})"}
    except mysql.connector.IntegrityError:
        cur.execute(
            "UPDATE portfolio SET kitta=%s, buy_price=%s WHERE user_id=%s AND symbol=%s",
            (req.kitta, req.buy_price, user_id, sym)
        )
        conn.commit(); cur.close(); conn.close()
        return {"message": f"{sym} updated in portfolio"}

@app.delete("/nepse/portfolio/{symbol}")
def del_portfolio(symbol: str, user_id: int = Depends(get_user)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM portfolio WHERE user_id=%s AND symbol=%s", (user_id, symbol.upper()))
    conn.commit(); affected = cur.rowcount; cur.close(); conn.close()
    if affected == 0: raise HTTPException(404, "Symbol not in portfolio")
    return {"message": f"{symbol.upper()} removed from portfolio"}

@app.get("/nepse/candles/{symbol}")
def candles(symbol: str, days: int = Query(30, ge=5, le=365)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT trading_date, open_price, high_price, low_price, close_price, volume, turnover
        FROM stocks
        WHERE symbol=%s AND open_price IS NOT NULL AND close_price IS NOT NULL
        ORDER BY trading_date ASC
        LIMIT %s
    """, (symbol.upper(), days))
    rows = rows_to_dicts(cur); cur.close(); conn.close()
    if not rows: raise HTTPException(404, f"No history for {symbol}")
    closes = [r["close_price"] for r in rows]
    first  = closes[0]; last = closes[-1]
    return {
        "symbol":  symbol.upper(),
        "candles": rows,
        "summary": {
            "days":        len(rows),
            "period_high": max(r["high_price"] for r in rows),
            "period_low":  min(r["low_price"]  for r in rows),
            "first_close": first, "last_close": last,
            "change_pct":  round((last - first) / first * 100, 2) if first else 0,
        }
    }

@app.get("/nepse/index")
def nepse_index(days: int = Query(30, ge=5, le=365)):
    """
    Returns daily average close price across all stocks — acts as a NEPSE index proxy.
    Used for the main dashboard graph when user logs in.
    """
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT
            trading_date,
            ROUND(AVG(close_price), 2)  AS avg_close,
            ROUND(SUM(turnover)  / 1e7, 2) AS total_turnover_cr,
            COUNT(*)                    AS stocks_traded,
            SUM(CASE WHEN close_price > open_price THEN 1 ELSE 0 END) AS gainers,
            SUM(CASE WHEN close_price < open_price THEN 1 ELSE 0 END) AS losers
        FROM stocks
        WHERE close_price IS NOT NULL AND open_price IS NOT NULL
        GROUP BY trading_date
        ORDER BY trading_date ASC
        LIMIT %s
    """, (days,))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"data": data, "days": len(data)}

@app.get("/nepse/health")
def health():
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM stocks")
        count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(DISTINCT trading_date) FROM stocks")
        dates = cur.fetchone()[0]
        cur.close(); conn.close()
        return {"status": "ok", "stocks_rows": count, "trading_dates": dates}
    except Exception as e:
        return JSONResponse(500, {"status": "error", "detail": str(e)})

@app.get("/nepse/dates")
def dates():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT DISTINCT trading_date FROM stocks ORDER BY trading_date DESC LIMIT 60")
    d = [str(r[0]) for r in cur.fetchall()]; cur.close(); conn.close()
    return {"dates": d}

@app.get("/nepse/symbols")
def all_symbols():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT DISTINCT symbol FROM stocks ORDER BY symbol ASC")
    syms = [r[0] for r in cur.fetchall()]; cur.close(); conn.close()
    return {"symbols": syms}

@app.get("/nepse/stocks")
def get_stocks(
    trading_date: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("turnover"),
    order: str = Query("desc"),
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
    return {"trading_date": trading_date, "summary": summary}

@app.get("/nepse/top-gainers")
def top_gainers(trading_date: Optional[str] = Query(None), limit: int = Query(10)):
    if not trading_date: trading_date = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT symbol, open_price, close_price,
            ROUND((close_price-open_price)/open_price*100,2) AS change_pct, volume, turnover
        FROM stocks WHERE trading_date=%s AND open_price>0
        ORDER BY change_pct DESC LIMIT %s
    """, (trading_date, limit))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"trading_date": trading_date, "data": data}

@app.get("/nepse/top-losers")
def top_losers(trading_date: Optional[str] = Query(None), limit: int = Query(10)):
    if not trading_date: trading_date = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT symbol, open_price, close_price,
            ROUND((close_price-open_price)/open_price*100,2) AS change_pct, volume, turnover
        FROM stocks WHERE trading_date=%s AND open_price>0
        ORDER BY change_pct ASC LIMIT %s
    """, (trading_date, limit))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"trading_date": trading_date, "data": data}

@app.get("/nepse/sector-volume")
def sector_volume(trading_date: Optional[str] = Query(None)):
    if not trading_date: trading_date = latest_date()
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""
        SELECT symbol,turnover,volume,close_price FROM stocks
        WHERE trading_date=%s AND turnover IS NOT NULL ORDER BY turnover DESC LIMIT 15
    """, (trading_date,))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"trading_date": trading_date, "data": data}

@app.get("/nepse/fetch-logs")
def fetch_logs(limit: int = Query(20)):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT * FROM fetch_logs ORDER BY fetched_at DESC LIMIT %s", (limit,))
    data = rows_to_dicts(cur); cur.close(); conn.close()
    return {"logs": data}
