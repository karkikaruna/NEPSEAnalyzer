"""
NEPSE REST API — FastAPI + MySQL
Serves stock data to the Next.js frontend.
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import mysql.connector
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="NEPSE API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME",     "nepse_db"),
}

print(f"[API] DB → {DB_CONFIG['host']}:{DB_CONFIG['port']} / {DB_CONFIG['database']} as {DB_CONFIG['user']}")


def get_conn():
    return mysql.connector.connect(**DB_CONFIG)


def rows_to_dicts(cursor):
    """Convert rows to dicts — Decimal → float, date → str so JSON works."""
    cols = [d[0] for d in cursor.description]
    result = []
    for row in cursor.fetchall():
        d = {}
        for col, val in zip(cols, row):
            if isinstance(val, Decimal):
                d[col] = float(val)
            elif isinstance(val, (date, datetime)):
                d[col] = str(val)
            else:
                d[col] = val
        result.append(d)
    return result


def latest_date() -> str:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT MAX(trading_date) FROM stocks")
    row = cur.fetchone()
    cur.close(); conn.close()
    return str(row[0]) if row and row[0] else str(date.today())

@app.get("/api/health")
def health():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM stocks")
        count = cur.fetchone()[0]
        cur.close(); conn.close()
        return {"status": "ok", "db": "connected", "stocks_rows": count}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "detail": str(e)})


@app.get("/api/dates")
def get_available_dates():
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("SELECT DISTINCT trading_date FROM stocks ORDER BY trading_date DESC LIMIT 60")
        dates = [str(r[0]) for r in cur.fetchall()]
        cur.close(); conn.close()
        return {"dates": dates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stocks")
def get_stocks(
    trading_date: Optional[str] = Query(None),
    symbol:       Optional[str] = Query(None),
    limit:        int           = Query(100, ge=1, le=500),
    offset:       int           = Query(0, ge=0),
    sort_by:      str           = Query("turnover"),
    order:        str           = Query("desc"),
):
    try:
        allowed = {"symbol","open_price","high_price","low_price","close_price","volume","turnover"}
        if sort_by not in allowed:
            sort_by = "turnover"
        order = "ASC" if order.lower() == "asc" else "DESC"
        if not trading_date:
            trading_date = latest_date()

        filters = ["trading_date = %s"]
        params  = [trading_date]
        if symbol:
            filters.append("symbol LIKE %s")
            params.append(f"%{symbol.upper()}%")

        where = " AND ".join(filters)
        conn = get_conn(); cur = conn.cursor()
        cur.execute(
            f"SELECT symbol, trading_date, open_price, high_price, low_price, "
            f"close_price, volume, turnover FROM stocks "
            f"WHERE {where} ORDER BY {sort_by} {order} LIMIT %s OFFSET %s",
            params + [limit, offset]
        )
        data = rows_to_dicts(cur)
        cur.execute(f"SELECT COUNT(*) FROM stocks WHERE {where}", params)
        total = cur.fetchone()[0]
        cur.close(); conn.close()
        return {"trading_date": trading_date, "total": total, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market-summary")
def market_summary(trading_date: Optional[str] = Query(None)):
    try:
        if not trading_date:
            trading_date = latest_date()
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT
                COUNT(*)               AS total_symbols,
                SUM(volume)            AS total_volume,
                SUM(turnover)          AS total_turnover,
                AVG(close_price)       AS avg_close,
                MAX(high_price)        AS market_high,
                MIN(low_price)         AS market_low,
                SUM(CASE WHEN close_price > open_price THEN 1 ELSE 0 END) AS gainers,
                SUM(CASE WHEN close_price < open_price THEN 1 ELSE 0 END) AS losers,
                SUM(CASE WHEN close_price = open_price THEN 1 ELSE 0 END) AS unchanged
            FROM stocks WHERE trading_date = %s
        """, (trading_date,))
        summary = rows_to_dicts(cur)[0]
        cur.close(); conn.close()
        return {"trading_date": trading_date, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/top-gainers")
def top_gainers(trading_date: Optional[str] = Query(None), limit: int = Query(10)):
    try:
        if not trading_date:
            trading_date = latest_date()
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT symbol, open_price, close_price,
                   ROUND((close_price - open_price) / open_price * 100, 2) AS change_pct,
                   volume, turnover
            FROM stocks
            WHERE trading_date = %s AND open_price > 0
            ORDER BY change_pct DESC LIMIT %s
        """, (trading_date, limit))
        data = rows_to_dicts(cur)
        cur.close(); conn.close()
        return {"trading_date": trading_date, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/top-losers")
def top_losers(trading_date: Optional[str] = Query(None), limit: int = Query(10)):
    try:
        if not trading_date:
            trading_date = latest_date()
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT symbol, open_price, close_price,
                   ROUND((close_price - open_price) / open_price * 100, 2) AS change_pct,
                   volume, turnover
            FROM stocks
            WHERE trading_date = %s AND open_price > 0
            ORDER BY change_pct ASC LIMIT %s
        """, (trading_date, limit))
        data = rows_to_dicts(cur)
        cur.close(); conn.close()
        return {"trading_date": trading_date, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sector-volume")
def sector_volume(trading_date: Optional[str] = Query(None)):
    try:
        if not trading_date:
            trading_date = latest_date()
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT symbol, turnover, volume, close_price
            FROM stocks WHERE trading_date = %s AND turnover IS NOT NULL
            ORDER BY turnover DESC LIMIT 15
        """, (trading_date,))
        data = rows_to_dicts(cur)
        cur.close(); conn.close()
        return {"trading_date": trading_date, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/symbol/{symbol}")
def symbol_history(symbol: str, limit: int = Query(30)):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            SELECT trading_date, open_price, high_price, low_price,
                   close_price, volume, turnover
            FROM stocks WHERE symbol = %s
            ORDER BY trading_date DESC LIMIT %s
        """, (symbol.upper(), limit))
        data = rows_to_dicts(cur)
        cur.close(); conn.close()
        if not data:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        return {"symbol": symbol.upper(), "history": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fetch-logs")
def fetch_logs(limit: int = Query(20)):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("SELECT * FROM fetch_logs ORDER BY fetched_at DESC LIMIT %s", (limit,))
        data = rows_to_dicts(cur)
        cur.close(); conn.close()
        return {"logs": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))