import argparse
import os
import sys
import time
from datetime import timezone, date, datetime, timedelta
UTC = timezone.utc

import mysql.connector
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

DB = dict(
    host     = os.getenv("DB_HOST",     "localhost"),
    port     = int(os.getenv("DB_PORT", "3306")),
    user     = os.getenv("DB_USER",     "root"),
    password = os.getenv("DB_PASSWORD", ""),
    database = os.getenv("DB_NAME",     "nepse_db"),
)

CHART_URL = (
    "https://www.merolagani.com/handlers/TechnicalChartHandler.ashx"
    "?type=get_advanced_chart&symbol={sym}&resolution=1D"
    "&rangeStartDate={fr}&rangeEndDate={to}"
    "&from=&isAdjust=1&currencyCode=NPR"
)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept":     "*/*",
    "Origin":     "https://www.merolagani.com",
})
_session_init = False


def to_ts(d: str) -> int:
    return int(datetime.strptime(d, "%Y-%m-%d").timestamp())


def today_iso() -> str:
    return date.today().strftime("%Y-%m-%d")


def ago(days: int) -> str:
    return (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")


def init_session(symbol: str):
    global _session_init
    if _session_init:
        return
    SESSION.headers["Referer"] = f"https://www.merolagani.com/CompanyDetail.aspx?symbol={symbol}"
    try:
        SESSION.get(
            f"https://www.merolagani.com/CompanyDetail.aspx?symbol={symbol}",
            timeout=15
        )
        _session_init = True
    except Exception:
        pass


def fetch_candles(symbol: str, from_ts: int, to_ts_val: int) -> list:
    """Fetch OHLCV candles from merolagani chart API."""
    init_session(symbol)
    SESSION.headers["Referer"] = f"https://www.merolagani.com/CompanyDetail.aspx?symbol={symbol}"
    try:
        res = SESSION.get(
            CHART_URL.format(sym=symbol, fr=from_ts, to=to_ts_val),
            timeout=25
        )
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        print(f"    API error: {e}")
        return []

    if data.get("s") != "ok" or not data.get("t"):
        return []

    rows = []
    seen = set()
    for i, ts in enumerate(data["t"]):
        try:
            day = datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%d")
            if day in seen:
                continue
            seen.add(day)
            o = float(data["o"][i])
            h = float(data["h"][i])
            l = float(data["l"][i])
            c = float(data["c"][i])
            v = int(data["v"][i])
            if c <= 0:
                continue
            if h < l:
                h, l = l, h
            rows.append({"date": day, "open": o, "high": h, "low": l, "close": c, "volume": v})
        except Exception:
            continue
    return rows


def get_conn():
    return mysql.connector.connect(**DB)


def already_have(cur, symbol: str, d: str) -> bool:
    cur.execute(
        "SELECT 1 FROM stocks WHERE symbol=%s AND trading_date=%s LIMIT 1",
        (symbol, d)
    )
    return cur.fetchone() is not None


def save_candles(symbol: str, rows: list) -> tuple:
    conn = get_conn(); cur = conn.cursor()
    inserted = updated = skipped = 0

    upsert = """
        INSERT INTO stocks
            (symbol, trading_date, open_price, high_price, low_price, close_price, volume, turnover)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            open_price  = VALUES(open_price),
            high_price  = VALUES(high_price),
            low_price   = VALUES(low_price),
            close_price = VALUES(close_price),
            volume      = VALUES(volume)
    """
    for row in rows:
        exists = already_have(cur, symbol, row["date"])
        cur.execute(upsert, (
            symbol, row["date"],
            row["open"], row["high"], row["low"], row["close"],
            row["volume"],
            None,       # turnover not provided by merolagani chart API
        ))
        if exists: updated += 1
        else:      inserted += 1

    conn.commit(); cur.close(); conn.close()
    return inserted, updated


def list_symbols_in_db() -> list:
    """Return all distinct symbols already in the stocks table."""
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT DISTINCT symbol FROM stocks ORDER BY symbol ASC")
    syms = [r[0] for r in cur.fetchall()]
    cur.close(); conn.close()
    return syms


def main():
    ap = argparse.ArgumentParser(description="NEPSE Historical Loader — merolagani chart API")
    ap.add_argument("--from",   dest="from_d",             help="Start date e.g. 2024-01-01")
    ap.add_argument("--to",     dest="to_d",               help="End date   e.g. 2026-03-20")
    ap.add_argument("--days",   type=int, default=365,     help="Days to backfill (default 365)")
    ap.add_argument("--symbol", default=None,              help="Single symbol e.g. NABIL")
    args = ap.parse_args()

    to_d   = args.to_d   or today_iso()
    from_d = args.from_d or ago(args.days)

    from_ts_val = to_ts(from_d)
    to_ts_val   = to_ts(to_d) + 86400   # inclusive end

    # Resolve symbol list
    if args.symbol:
        symbols = [args.symbol.upper().strip()]
    else:
        symbols = list_symbols_in_db()
        if not symbols:
            print("No symbols found in DB. Run fetcher.py first or use --symbol NABIL")
            sys.exit(1)

    print(f"Range   : {from_d} → {to_d}")
    print(f"Symbols : {len(symbols)}")
    print(f"Source  : merolagani chart API\n")

    total_ins = total_upd = 0

    for idx, sym in enumerate(symbols, 1):
        prefix = f"[{idx:3d}/{len(symbols)}] {sym:<12}"

        rows = fetch_candles(sym, from_ts_val, to_ts_val)
        rows = [r for r in rows if from_d <= r["date"] <= to_d]

        if not rows:
            print(f"{prefix} ✗ no data returned")
            time.sleep(0.2)
            continue

        ins, upd = save_candles(sym, rows)
        total_ins += ins; total_upd += upd

        first = rows[0];  last = rows[-1]
        print(
            f"{prefix} ✓ {ins:3d} new  {upd:3d} updated"
            f"  [{first['date']} C={first['close']:.2f} … {last['date']} C={last['close']:.2f}]"
        )
        time.sleep(0.2)   # be polite to the server

    print(f"\n{'─'*60}")
    print(f"Done!  Inserted: {total_ins}   Updated: {total_upd}")


if __name__ == "__main__":
    main()