"""
NEPSE Data Fetcher — DBMS Project (5th Sem Computer Engineering)
Fetches NEPSE stock data from Sharesansar and stores it in MySQL.
All database credentials are loaded from a .env file.
"""

import io
import requests
import pandas as pd
import mysql.connector
from mysql.connector import Error
from datetime import date
import time
import logging
import os
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
log.info(f"DB config loaded → host={config['DB_HOST']}:{config['DB_PORT']}  db={config['DB_NAME']}  user={config['DB_USER']}")

def get_connection():
    return mysql.connector.connect(
        host=config["DB_HOST"],
        port=config["DB_PORT"],
        user=config["DB_USER"],
        password=config["DB_PASSWORD"],
        database=config["DB_NAME"],
    )


def init_database():
    conn = mysql.connector.connect(
        host=config["DB_HOST"],
        port=config["DB_PORT"],
        user=config["DB_USER"],
        password=config["DB_PASSWORD"],
    )
    cursor = conn.cursor()
    cursor.execute(
        f"CREATE DATABASE IF NOT EXISTS `{config['DB_NAME']}` "
        f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    )
    cursor.execute(f"USE `{config['DB_NAME']}`;")
    cursor.execute("""
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
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fetch_logs (
            id            INT          AUTO_INCREMENT PRIMARY KEY,
            trading_date  DATE         NOT NULL,
            rows_fetched  INT          DEFAULT 0,
            rows_inserted INT          DEFAULT 0,
            rows_updated  INT          DEFAULT 0,
            status        ENUM('success','failed') NOT NULL,
            error_msg     TEXT,
            fetched_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    """)
    conn.commit()
    cursor.close()
    conn.close()
    log.info("Database initialised ✓")

def fetch_sharesansar(trading_date: str = None) -> pd.DataFrame | None:
    if trading_date is None:
        trading_date = date.today().strftime("%Y-%m-%d")

    url = "https://www.sharesansar.com/today-share-price"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.sharesansar.com/today-share-price",
    }

    log.info(f"Fetching data for {trading_date} …")
    try:
        response = requests.get(url, headers=headers, params={"date": trading_date}, timeout=30)
    except requests.RequestException as e:
        log.error(f"HTTP error: {e}")
        return None

    if response.status_code != 200:
        log.error(f"HTTP {response.status_code} for {trading_date}")
        return None

    try:
        tables = pd.read_html(io.StringIO(response.text))
    except ValueError:
        log.error("No HTML tables found in response.")
        return None

    df = max(tables, key=len)
    log.info(f"Raw columns from site: {list(df.columns)}")


    orig_cols = list(df.columns)
    def find_col(candidates):
        """Return first column name that matches any candidate (exact, then case-insensitive)."""
        for c in candidates:
            if c in orig_cols:
                return c
        for c in candidates:
            for col in orig_cols:
                if col.strip().lower() == c.lower():
                    return col
        return None

    col_symbol   = find_col(["Symbol", "Scrip", "symbol"])
    col_open     = find_col(["Open", "open"])
    col_high     = find_col(["High", "high"])
    col_low      = find_col(["Low", "low"])
    col_close    = find_col(["LTP", "ltp"])
    if col_close is None:
        col_close = find_col(["Close", "close"])
    col_vol      = find_col(["Vol", "Volume", "vol", "volume"])
    col_turnover = find_col(["Turnover", "turnover", "Amount", "amount"])

    log.info(f"Mapped → symbol={col_symbol} open={col_open} high={col_high} "
             f"low={col_low} close={col_close} vol={col_vol} turnover={col_turnover}")

    missing = [k for k, v in {
        "Symbol": col_symbol, "Open": col_open, "High": col_high,
        "Low": col_low, "Close": col_close, "Vol": col_vol, "Turnover": col_turnover
    }.items() if v is None]

    if missing:
        log.error(f"Could not find columns: {missing}")
        log.error(f"Available: {orig_cols}")
        return None

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

    log.info(f"Clean rows ready for DB: {len(out)}")
    return out


def save_to_mysql(df: pd.DataFrame, trading_date: str) -> dict:
    inserted = updated = 0
    conn = get_connection()
    cursor = conn.cursor()

    upsert_sql = """
        INSERT INTO stocks
            (symbol, trading_date, open_price, high_price, low_price,
             close_price, volume, turnover)
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
            row["Symbol"],
            trading_date,
            None if pd.isna(row["Open"])     else float(row["Open"]),
            None if pd.isna(row["High"])     else float(row["High"]),
            None if pd.isna(row["Low"])      else float(row["Low"]),
            None if pd.isna(row["Close"])    else float(row["Close"]),
            None if pd.isna(row["Vol"])      else int(row["Vol"]),
            None if pd.isna(row["Turnover"]) else float(row["Turnover"]),
        )
        cursor.execute(upsert_sql, vals)
        if cursor.rowcount == 1:
            inserted += 1
        else:
            updated += 1

    conn.commit()
    cursor.close()
    conn.close()
    log.info(f"DB write complete — inserted: {inserted}, updated: {updated}")
    return {"inserted": inserted, "updated": updated}


def log_fetch(trading_date: str, rows_fetched: int, stats: dict, status: str, error_msg: str = None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO fetch_logs
               (trading_date, rows_fetched, rows_inserted, rows_updated, status, error_msg)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (trading_date, rows_fetched, stats.get("inserted", 0), stats.get("updated", 0), status, error_msg),
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        log.error(f"Failed to write fetch_log: {e}")


# ─── Main pipeline ────────────────────────────────────────────────────────────
def run_pipeline(trading_date: str = None):
    if trading_date is None:
        trading_date = date.today().strftime("%Y-%m-%d")

    log.info(f"=== Pipeline start | date={trading_date} ===")
    df = fetch_sharesansar(trading_date)
    if df is None or df.empty:
        log_fetch(trading_date, 0, {}, "failed", "No data fetched")
        return False

    try:
        stats = save_to_mysql(df, trading_date)
        log_fetch(trading_date, len(df), stats, "success")
        log.info("=== Pipeline complete ✓ ===")
        return True
    except Error as e:
        log.error(f"DB error: {e}")
        log_fetch(trading_date, len(df), {}, "failed", str(e))
        return False

def run_scheduler(interval_hours: float = 1.0):
    log.info(f"Scheduler started — interval: {interval_hours}h")
    while True:
        run_pipeline()
        log.info(f"Sleeping {interval_hours}h …")
        time.sleep(interval_hours * 3600)


if __name__ == "__main__":
    import sys
    init_database()
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--scheduler":
            run_scheduler()
        else:
            run_pipeline(arg)
    else:
        run_pipeline()