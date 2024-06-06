const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
const db = new sqlite3.Database('./tickers.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        db.run('CREATE TABLE IF NOT EXISTS indodax (\
            ticker_symbol TEXT NOT NULL,\
            high INTEGER NOT NULL,\
            low INTEGER NOT NULL,\
            vol_quote REAL NOT NULL,\
            vol_base BIGINT NOT NULL,\
            last INTEGER NOT NULL,\
            buy INTEGER NOT NULL,\
            sell INTEGER NOT NULL,\
            server_time INTEGER NOT NULL,\
            created_at DATETIME DEFAULT (STRFTIME(\'%Y-%m-%d %H:%M:%f\', \'now\')),\
            updated_at DATETIME DEFAULT (STRFTIME(\'%Y-%m-%d %H:%M:%f\', \'now\'))\
        );', (err) => {
            if (err) {
                console.error('Error creating table ' + err.message);
            }
        });

        db.run('CREATE TABLE IF NOT EXISTS bithumb (\
            currency TEXT NOT NULL,\
            opening_price TEXT,\
            closing_price TEXT,\
            min_price TEXT,\
            max_price TEXT,\
            units_traded REAL NOT NULL,\
            acc_trade_value REAL,\
            prev_closing_price TEXT,\
            units_traded_24H REAL,\
            acc_trade_value_24H REAL,\
            fluctate_24H INTEGER,\
            fluctate_rate_24H REAL,\
            created_at DATETIME NOT NULL DEFAULT (STRFTIME(\'%Y-%m-%d %H:%M:%f\', \'now\')),\
            updated_at DATETIME NOT NULL DEFAULT (STRFTIME(\'%Y-%m-%d %H:%M:%f\', \'now\'))\
        );', (err) => {
            if (err) {
                console.error('Error creating table ' + err.message);
            }
        });

        db.run('CREATE TABLE IF NOT EXISTS rates (\
            usd_idr INTEGER,\
            krw_idr INTEGER,\
            krw_usd INTEGER,\
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\
        );', (err) => {
            if (err) {
                console.error('Error creating table ' + err.message);
            }
        });
    }
});

module.exports = {
    db
};