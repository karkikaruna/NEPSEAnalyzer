"""
NEPSE Data Fetcher v2 — DBMS Project
- Fetches daily OHLCV data from Sharesansar
- Stores in MySQL with duplicate prevention
- Scheduler: auto-fetches every day at 4PM Nepal time (market closes 3PM)
- Logs every run in fetch_logs table
"""

import io
import requests
import pandas as pd
import mysql.connector
from mysql.connector import Error
from datetime import date, datetime, timedelta
import time
import logging
import os
import schedule
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("fetcher.log"),
    ],
)
log = logging.getLogger(__name__)

config = {
    "DB_HOST":     os.getenv("DB_HOST",     "localhost"),
    "DB_PORT":     int(os.getenv("DB_PORT", 3306)),
    "DB_USER":     os.getenv("DB_USER",     "root"),
    "DB_PASSWORD": os.getenv("DB_PASSWORD", ""),
    "DB_NAME":     os.getenv("DB_NAME",     "nepse_db"),
}
log.info(f"DB: {config['DB_HOST']}:{config['DB_PORT']} / {config['DB_NAME']}")

def get_connection():
    return mysql.connector.connect(
        host=config["DB_HOST"], port=config["DB_PORT"],
        user=config["DB_USER"], password=config["DB_PASSWORD"],
        database=config["DB_NAME"],
    )


def init_database():
    conn = mysql.connector.connect(
        host=config["DB_HOST"], port=config["DB_PORT"],
        user=config["DB_USER"], password=config["DB_PASSWORD"],
    )
    cur = conn.cursor()
    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{config['DB_NAME']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    cur.execute(f"USE `{config['DB_NAME']}`;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS stocks (
            id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
            symbol        VARCHAR(20)  NOT NULL,
            trading_date  DATE         NOT NULL,
            open_price    DECIMAL(12,2),
            high_price    DECIMAL(12,2),
            low_price     DECIMAL(12,2),
            close_price   DECIMAL(12,2),
            volume        BIGINT,
            turnover      DECIMAL(20,2),
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_symbol_date (symbol, trading_date),
            INDEX idx_symbol       (symbol),
            INDEX idx_trading_date (trading_date)
        ) ENGINE=InnoDB;
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS fetch_logs (
            id            INT          AUTO_INCREMENT PRIMARY KEY,
            trading_date  DATE         NOT NULL,
            rows_fetched  INT          DEFAULT 0,
            rows_inserted INT          DEFAULT 0,
            rows_updated  INT          DEFAULT 0,
            status        ENUM('success','failed','skipped') NOT NULL,
            error_msg     TEXT,
            fetched_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    """)

    conn.commit(); cur.close(); conn.close()
    log.info("Database initialised ✓")

def already_fetched(trading_date: str) -> bool:
    """Return True if we already have data for this date."""
    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stocks WHERE trading_date = %s", (trading_date,))
    count = cur.fetchone()[0]
    cur.close(); conn.close()
    return count > 0


def is_weekday(trading_date: str) -> bool:
    """NEPSE trades Mon–Fri. Skip weekends."""
    d = datetime.strptime(trading_date, "%Y-%m-%d")
    return d.weekday() < 5 

def fetch_sharesansar(trading_date: str = None) -> pd.DataFrame | None:
    if trading_date is None:
        trading_date = date.today().strftime("%Y-%m-%d")

    url = "https://www.sharesansar.com/today-share-price"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.sharesansar.com/today-share-price",
    }

    log.info(f"Fetching {trading_date} from Sharesansar…")
    try:
        resp = requests.get(url, headers=headers, params={"date": trading_date}, timeout=30)
    except requests.RequestException as e:
        log.error(f"HTTP error: {e}"); return None

    if resp.status_code != 200:
        log.error(f"HTTP {resp.status_code}"); return None

    try:
        tables = pd.read_html(io.StringIO(resp.text))
    except ValueError:
        log.error("No HTML tables found"); return None

    df = max(tables, key=len)
    orig_cols = list(df.columns)
    log.info(f"Raw columns: {orig_cols}")

    def find_col(candidates):
        for c in candidates:
            if c in orig_cols: return c
        for c in candidates:
            for col in orig_cols:
                if col.strip().lower() == c.lower(): return col
        return None

    col_symbol   = find_col(["Symbol", "Scrip"])
    col_open     = find_col(["Open"])
    col_high     = find_col(["High"])
    col_low      = find_col(["Low"])
    col_close    = find_col(["LTP", "ltp"]) or find_col(["Close"])
    col_vol      = find_col(["Vol", "Volume"])
    col_turnover = find_col(["Turnover", "Amount"])

    missing = [k for k, v in {
        "Symbol": col_symbol, "Open": col_open, "High": col_high,
        "Low": col_low, "Close": col_close, "Vol": col_vol, "Turnover": col_turnover
    }.items() if v is None]

    if missing:
        log.error(f"Missing columns: {missing}"); return None

    log.info(f"Using close column: '{col_close}'")

    out = pd.DataFrame()
    out["Symbol"]   = df[col_symbol].astype(str).str.strip()
    out["Open"]     = pd.to_numeric(df[col_open].astype(str).str.replace(",", "", regex=False).str.strip(),     errors="coerce")
    out["High"]     = pd.to_numeric(df[col_high].astype(str).str.replace(",", "", regex=False).str.strip(),     errors="coerce")
    out["Low"]      = pd.to_numeric(df[col_low].astype(str).str.replace(",", "", regex=False).str.strip(),      errors="coerce")
    out["Close"]    = pd.to_numeric(df[col_close].astype(str).str.replace(",", "", regex=False).str.strip(),    errors="coerce")
    out["Vol"]      = pd.to_numeric(df[col_vol].astype(str).str.replace(",", "", regex=False).str.strip(),      errors="coerce")
    out["Turnover"] = pd.to_numeric(df[col_turnover].astype(str).str.replace(",", "", regex=False).str.strip(), errors="coerce")

    out = out.dropna(subset=["Symbol", "Close"])
    out = out[out["Symbol"] != "nan"]
    log.info(f"Clean rows: {len(out)}")
    return out

def save_to_mysql(df: pd.DataFrame, trading_date: str) -> dict:
    inserted = updated = 0
    conn = get_connection(); cur = conn.cursor()

    upsert = """
        INSERT INTO stocks
            (symbol, trading_date, open_price, high_price, low_price, close_price, volume, turnover)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            open_price  = VALUES(open_price),
            high_price  = VALUES(high_price),
            low_price   = VALUES(low_price),
            close_price = VALUES(close_price),
            volume      = VALUES(volume),
            turnover    = VALUES(turnover)
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
        cur.execute(upsert, vals)
        if cur.rowcount == 1: inserted += 1
        else:                 updated  += 1

    conn.commit(); cur.close(); conn.close()
    log.info(f"Saved → inserted: {inserted}, updated: {updated}")
    return {"inserted": inserted, "updated": updated}


def log_fetch(trading_date, rows_fetched, stats, status, error_msg=None):
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO fetch_logs
              (trading_date, rows_fetched, rows_inserted, rows_updated, status, error_msg)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (trading_date, rows_fetched, stats.get("inserted", 0), stats.get("updated", 0), status, error_msg))
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        log.error(f"fetch_log write failed: {e}")

def run_pipeline(trading_date: str = None, force: bool = False):
    if trading_date is None:
        trading_date = date.today().strftime("%Y-%m-%d")

    log.info(f"=== Pipeline | date={trading_date} force={force} ===")

 
    if not force and not is_weekday(trading_date):
        log.info(f"Skipping {trading_date} — weekend (NEPSE closed)")
        log_fetch(trading_date, 0, {}, "skipped", "Weekend — market closed")
        return False

 
    if not force and already_fetched(trading_date):
        log.info(f"Data for {trading_date} already in DB. Use --force to re-fetch.")
        log_fetch(trading_date, 0, {}, "skipped", "Already in database")
        return False

    df = fetch_sharesansar(trading_date)
    if df is None or df.empty:
        log_fetch(trading_date, 0, {}, "failed", "No data returned")
        return False

    try:
        stats = save_to_mysql(df, trading_date)
        log_fetch(trading_date, len(df), stats, "success")
        log.info(f"=== Pipeline complete ✓ ===")
        return True
    except Error as e:
        log.error(f"DB error: {e}")
        log_fetch(trading_date, 0, {}, "failed", str(e))
        return False


def backfill(days: int = 30):
    """Fetch the last N trading days worth of data."""
    log.info(f"Backfilling last {days} calendar days…")
    today = date.today()
    fetched = 0
    for i in range(days):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        if not is_weekday(d):
            continue
        if already_fetched(d):
            log.info(f"  {d} already in DB, skipping")
            continue
        success = run_pipeline(d, force=True)
        if success:
            fetched += 1
            time.sleep(2) 
    log.info(f"Backfill done — fetched {fetched} new dates")


def scheduled_job():
    today = date.today().strftime("%Y-%m-%d")
    log.info(f"Scheduled job triggered for {today}")
    run_pipeline(today)


def run_scheduler():
    """
    Auto-fetch every day at 16:00 Nepal time (NPT = UTC+5:45).
    NEPSE closes at 15:00 NPT; data is usually up by 16:00.
    """
    log.info("Scheduler started — will fetch daily at 16:00")

    run_pipeline()

    schedule.every().day.at("16:00").do(scheduled_job)

    log.info("Waiting for next scheduled run… (Ctrl+C to stop)")
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    import sys
    init_database()

    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--scheduler":
            run_scheduler()
        elif arg == "--backfill":
            days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
            backfill(days)
        elif arg == "--force":
            d = sys.argv[2] if len(sys.argv) > 2 else date.today().strftime("%Y-%m-%d")
            run_pipeline(d, force=True)
        else:
            run_pipeline(arg)
    else:
        run_pipeline()
