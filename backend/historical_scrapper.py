"""
NEPSE Historical Data Scraper
Scrapes years of OHLCV data from Sharesansar date by date and stores in MySQL.
Usage:
    python historical_scraper.py                     # last 365 days
    python historical_scraper.py --days 730          # last 2 years
    python historical_scraper.py --from 2022-01-01   # from a specific date
    python historical_scraper.py --from 2022-01-01 --to 2023-01-01
"""

import io
import time
import logging
import argparse
import requests
import pandas as pd
import mysql.connector
from datetime import date, datetime, timedelta
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("historical.log")],
)
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME",     "nepse_db"),
}


def get_conn():
    return mysql.connector.connect(**DB_CONFIG)


def is_weekday(d: date) -> bool:
    return d.weekday() < 5  # Mon=0 … Fri=4


def already_in_db(d: str) -> bool:
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stocks WHERE trading_date=%s", (d,))
    count = cur.fetchone()[0]; cur.close(); conn.close()
    return count > 0


def fetch_day(trading_date: str) -> pd.DataFrame | None:
    url = "https://www.sharesansar.com/today-share-price"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.sharesansar.com/today-share-price",
    }
    try:
        resp = requests.get(url, headers=headers, params={"date": trading_date}, timeout=30)
    except Exception as e:
        log.error(f"  Request failed: {e}"); return None

    if resp.status_code != 200:
        log.warning(f"  HTTP {resp.status_code} — market may have been closed"); return None

    try:
        tables = pd.read_html(io.StringIO(resp.text))
    except ValueError:
        log.warning(f"  No table found — market closed or no data"); return None

    df = max(tables, key=len)
    orig = list(df.columns)

    def find(candidates):
        for c in candidates:
            if c in orig: return c
        for c in candidates:
            for col in orig:
                if col.strip().lower() == c.lower(): return col
        return None

    col_sym = find(["Symbol", "Scrip"])
    col_o   = find(["Open"])
    col_h   = find(["High"])
    col_l   = find(["Low"])
    col_c   = find(["LTP", "ltp"]) or find(["Close"])
    col_v   = find(["Vol", "Volume"])
    col_t   = find(["Turnover", "Amount"])

    if not all([col_sym, col_o, col_h, col_l, col_c, col_v, col_t]):
        log.warning(f"  Missing columns in response"); return None

    out = pd.DataFrame()
    out["Symbol"]   = df[col_sym].astype(str).str.strip()
    for name, src in [("Open",col_o),("High",col_h),("Low",col_l),("Close",col_c),("Vol",col_v),("Turnover",col_t)]:
        out[name] = pd.to_numeric(df[src].astype(str).str.replace(",","",regex=False).str.strip(), errors="coerce")

    out = out.dropna(subset=["Symbol", "Close"])
    out = out[out["Symbol"] != "nan"]
    return out if len(out) > 0 else None


def save_day(df: pd.DataFrame, trading_date: str) -> dict:
    conn = get_conn(); cur = conn.cursor()
    inserted = updated = 0
    sql = """
        INSERT INTO stocks
          (symbol,trading_date,open_price,high_price,low_price,close_price,volume,turnover)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          open_price=VALUES(open_price), high_price=VALUES(high_price),
          low_price=VALUES(low_price),   close_price=VALUES(close_price),
          volume=VALUES(volume),         turnover=VALUES(turnover)
    """
    for _, row in df.iterrows():
        vals = (
            row["Symbol"], trading_date,
            None if pd.isna(row["Open"])     else float(row["Open"]),
            None if pd.isna(row["High"])     else float(row["High"]),
            None if pd.isna(row["Low"])      else float(row["Low"]),
            None if pd.isna(row["Close"])    else float(row["Close"]),
            None if pd.isna(row["Vol"])      else int(row["Vol"]),
            None if pd.isna(row["Turnover"]) else float(row["Turnover"]),
        )
        cur.execute(sql, vals)
        if cur.rowcount == 1: inserted += 1
        else: updated += 1

    conn.commit(); cur.close(); conn.close()
    return {"inserted": inserted, "updated": updated}


def log_fetch(trading_date, rows, stats, status, msg=None):
    try:
        conn = get_conn(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO fetch_logs
              (trading_date,rows_fetched,rows_inserted,rows_updated,status,error_msg)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (trading_date, rows, stats.get("inserted",0), stats.get("updated",0), status, msg))
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        log.error(f"log_fetch error: {e}")


def scrape_range(start: date, end: date, delay: float = 2.0, force: bool = False):
    """
    Scrape all trading days between start and end (inclusive).
    delay: seconds to wait between requests (be polite to the server)
    force: re-fetch even if already in DB
    """
    total_days = (end - start).days + 1
    trading_days = [start + timedelta(days=i) for i in range(total_days) if is_weekday(start + timedelta(days=i))]

    log.info(f"Date range: {start} → {end}")
    log.info(f"Trading days to process: {len(trading_days)}")
    log.info(f"Estimated time: ~{len(trading_days)*delay/60:.1f} minutes")
    log.info("=" * 50)

    fetched = skipped = failed = 0

    for i, d in enumerate(trading_days):
        ds = d.strftime("%Y-%m-%d")
        pct = (i + 1) / len(trading_days) * 100

        # Skip if already in DB and not forcing
        if not force and already_in_db(ds):
            log.info(f"[{pct:.0f}%] {ds} — already in DB, skipping")
            skipped += 1
            continue

        # Don't fetch future dates
        if d > date.today():
            log.info(f"[{pct:.0f}%] {ds} — future date, skipping")
            skipped += 1
            continue

        log.info(f"[{pct:.0f}%] Fetching {ds}…")
        df = fetch_day(ds)

        if df is None:
            log.warning(f"  No data for {ds} (market closed or holiday)")
            log_fetch(ds, 0, {}, "failed", "No data returned")
            failed += 1
        else:
            stats = save_day(df, ds)
            log_fetch(ds, len(df), stats, "success")
            log.info(f"  Saved {len(df)} stocks — inserted:{stats['inserted']} updated:{stats['updated']}")
            fetched += 1

        # Wait between requests
        if i < len(trading_days) - 1:
            time.sleep(delay)

    log.info("=" * 50)
    log.info(f"Done! Fetched: {fetched} | Skipped: {skipped} | Failed: {failed}")
    log.info(f"Total dates now in DB: check with: SELECT COUNT(DISTINCT trading_date) FROM stocks;")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NEPSE Historical Data Scraper")
    parser.add_argument("--days",  type=int, default=365,             help="Number of past days (default: 365)")
    parser.add_argument("--from",  dest="from_date", type=str,        help="Start date YYYY-MM-DD")
    parser.add_argument("--to",    dest="to_date",   type=str,        help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--delay", type=float, default=2.0,           help="Seconds between requests (default: 2)")
    parser.add_argument("--force", action="store_true",               help="Re-fetch even if already in DB")
    args = parser.parse_args()

    end_date   = datetime.strptime(args.to_date,   "%Y-%m-%d").date() if args.to_date   else date.today()
    start_date = datetime.strptime(args.from_date, "%Y-%m-%d").date() if args.from_date else end_date - timedelta(days=args.days)

    scrape_range(start_date, end_date, delay=args.delay, force=args.force)