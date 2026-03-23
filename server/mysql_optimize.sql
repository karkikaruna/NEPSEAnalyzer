USE nepse_db;

CREATE INDEX IF NOT EXISTS idx_date_close
    ON stocks (trading_date, close_price, open_price, volume, turnover);

CREATE INDEX IF NOT EXISTS idx_sym_date_ohlcv
    ON stocks (symbol, trading_date, open_price, high_price, low_price, close_price, volume);

SHOW INDEX FROM stocks;

ANALYZE TABLE stocks;
ANALYZE TABLE fetch_logs;

SELECT
    table_name,
    ROUND(data_length / 1024 / 1024, 2)  AS data_MB,
    ROUND(index_length / 1024 / 1024, 2) AS index_MB,
    table_rows
FROM information_schema.tables
WHERE table_schema = 'nepse_db'
ORDER BY data_length DESC;

SET GLOBAL innodb_buffer_pool_size = 134217728;  
SET GLOBAL query_cache_type = 1;
SET GLOBAL query_cache_size = 16777216;        

SELECT 'MySQL optimization complete!' AS status;