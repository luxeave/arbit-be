const cors = require('cors');
const express = require('express');
// const sqlite3 = require('sqlite3').verbose();

const app = express();

require('dotenv').config();
const db = require('./database');
const axios = require('axios');
const cron = require('node-cron');

const URL_INDODAX = process.env.URL_INDODAX;
const URL_BITHUMB = process.env.URL_BITHUMB;
const INTERVAL_INDODAX = process.env.INTERVAL_INDODAX;
const INTERVAL_BITHUMB = process.env.INTERVAL_BITHUMB;
const INTERVAL_RATES = process.env.INTERVAL_RATES;

// Cron job to fetch and update data for worker 1
cron.schedule(INTERVAL_INDODAX, () => {
  console.log('Running a task with the interval ', INTERVAL_INDODAX);
  fetchIndodax();
});

// Cron job to fetch and update data for worker 2
cron.schedule(INTERVAL_BITHUMB, () => {
  console.log('Running a task with the interval ', INTERVAL_BITHUMB);
  fetchBithumb();
});

cron.schedule(INTERVAL_RATES, () => {
  console.log('Running a task with the interval ', INTERVAL_RATES);
  fetchRates();
});

async function fetchRates() {
  try {
      // Fetch USD_IDR rate
      const usdIdrResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      const usdIdrRate = usdIdrResponse.data.rates.IDR;

      // Fetch KRW_IDR rate
      const krwIdrResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/KRW');
      const krwIdrRate = krwIdrResponse.data.rates.IDR;

      // Fetch KRW_USD rate
      const krwUsdRate = krwIdrRate / usdIdrRate;

      // Update rates in the database
      db.db.run('INSERT INTO rates (usd_idr, krw_idr, krw_usd) VALUES (?, ?, ?)', [usdIdrRate, krwIdrRate, krwUsdRate], (err) => {
          if (err) {
              console.error('Error updating rates:', err);
          } else {
              console.log('Rates updated successfully');
          }
      });
  } catch (error) {
      console.error('Failed to fetch or update rates:', error);
  }
}

// Function for worker 1
async function fetchIndodax() {
  try {
      const response = await axios.get(URL_INDODAX);
      
      const tickers = Object.entries(response.data.tickers).map(([ticker_symbol, ticker_data]) => {
          return { ticker_symbol, ...ticker_data };
      });

      tickers.forEach(ticker => {
          const data = Object.entries(ticker);

          db.db.get('SELECT * FROM indodax WHERE ticker_symbol = ?', [ticker.ticker_symbol], (err, row) => {
              if (row) {
                  db.db.run('UPDATE indodax SET high = ?, low = ?, vol_quote = ?, vol_base = ?, last = ?, buy = ?, sell = ?, server_time = ?, updated_at = STRFTIME(\'%Y-%m-%d %H:%M:%f\', \'now\') WHERE ticker_symbol = ?', 
                      [ticker.high, ticker.low, data[3][1], data[4][1], ticker.last, ticker.buy, ticker.sell, ticker.server_time, ticker.ticker_symbol]);
              } else {
                  db.db.run('INSERT INTO indodax (ticker_symbol, high, low, vol_quote, vol_base, last, buy, sell, server_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                      [ticker.ticker_symbol, ticker.high, ticker.low, data[3][1], data[4][1], ticker.last, ticker.buy, ticker.sell, ticker.server_time]);
              }
          });
      });
  } catch (error) {
      console.error('Failed to fetch or update data:', error);
  }
}

function isValidItem(item) {
  const requiredProperties = [
      'opening_price',
      'closing_price',
      'min_price',
      'max_price',
      'units_traded',
      'acc_trade_value',
      'prev_closing_price',
      'units_traded_24H',
      'acc_trade_value_24H',
      'fluctate_24H',
      'fluctate_rate_24H'
  ];

  return requiredProperties.every(property => property in item);
}

// Function for worker 2
async function fetchBithumb() {
  try {
      const response = await axios.get(URL_BITHUMB);

      // console.log(response.data);

      const data = Object.entries(response.data.data).map(([currency, data]) => {
          return { currency, ...data };
      });

      data.forEach(item => {
          if (!isValidItem(item)) {
              // console.error('Invalid item structure:', item);
              return;
          }

          db.db.get('SELECT * FROM bithumb WHERE currency = ?', [item.currency], (err, row) => {
              if (row) {
                  db.db.run('UPDATE bithumb SET opening_price = ?, closing_price = ?, min_price = ?, max_price = ?, units_traded = ?, acc_trade_value = ?, prev_closing_price = ?, units_traded_24H = ?, acc_trade_value_24H = ?, fluctate_24H = ?, fluctate_rate_24H = ?, updated_at = STRFTIME(\'%Y-%m-%d %H:%M:%f\', \'now\') WHERE currency = ?', 
                      [item.opening_price, item.closing_price, item.min_price, item.max_price, item.units_traded, item.acc_trade_value, item.prev_closing_price, item.units_traded_24H, item.acc_trade_value_24H, item.fluctate_24H, item.fluctate_rate_24H, item.currency]);
              } else {
                  db.db.run('INSERT INTO bithumb (currency, opening_price, closing_price, min_price, max_price, units_traded, acc_trade_value, prev_closing_price, units_traded_24H, acc_trade_value_24H, fluctate_24H, fluctate_rate_24H) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                      [item.currency, item.opening_price, item.closing_price, item.min_price, item.max_price, item.units_traded, item.acc_trade_value, item.prev_closing_price, item.units_traded_24H, item.acc_trade_value_24H, item.fluctate_24H, item.fluctate_rate_24H]);
              }
          });
      });
  } catch (error) {
      console.error('Failed to fetch or update data:', error);
  }
}

// Function to retrieve mutual base currencies
function mutual_base_ccy(callback) {
  const query = `
    SELECT DISTINCT LOWER(SUBSTR(indodax.ticker_symbol, 1, INSTR(indodax.ticker_symbol, '_') - 1)) AS base_currency
    FROM indodax
    INNER JOIN bithumb ON UPPER(SUBSTR(indodax.ticker_symbol, 1, INSTR(indodax.ticker_symbol, '_') - 1)) = UPPER(bithumb.currency)
  `;

  db.db.all(query, (err, rows) => {
    if (err) {
      console.error('Error retrieving mutual base currencies:', err);
      callback(err, null);
    } else {
      const baseCurrencies = rows.map(row => row.base_currency);
      callback(null, baseCurrencies);
    }
  });
}

// add middlewares
app.use(cors());

// Function to retrieve indodax tickers based on mutual base currencies
function indodax_tickers(callback) {
  mutual_base_ccy((err, baseCurrencies) => {
    if (err) {
      callback(err, null);
    } else {
      const placeholders = baseCurrencies.map(() => '?').join(',');
      const query = `SELECT * FROM indodax WHERE LOWER(SUBSTR(ticker_symbol, 1, INSTR(ticker_symbol, '_') - 1)) IN (${placeholders})`;

      db.db.all(query, baseCurrencies, (err, rows) => {
        if (err) {
          console.error('Error retrieving indodax tickers:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      });
    }
  });
}

// Function to retrieve bithumb tickers based on mutual base currencies
function bithumb_tickers(callback) {
  mutual_base_ccy((err, baseCurrencies) => {
    if (err) {
      callback(err, null);
    } else {
      const placeholders = baseCurrencies.map(() => '?').join(',');
      const query = `SELECT * FROM bithumb WHERE LOWER(currency) IN (${placeholders})`;

      db.db.all(query, baseCurrencies, (err, rows) => {
        if (err) {
          console.error('Error retrieving bithumb tickers:', err);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      });
    }
  });
}

// Function to retrieve rates
function get_rates(callback) {
    const query = 'SELECT * FROM rates ORDER BY created_at DESC LIMIT 1';
  
    db.db.get(query, (err, row) => {
      if (err) {
        console.error('Error retrieving rates:', err);
        callback(err, null);
      } else {
        callback(null, row);
      }
    });
  }

// Express GET API for mutual base currencies
app.get('/mutual_base_ccy', (req, res) => {
  mutual_base_ccy((err, baseCurrencies) => {
    if (err) {
      res.status(500).json({ error: 'Error retrieving mutual base currencies' });
    } else {
      res.json(baseCurrencies);
    }
  });
});

// Express GET API for indodax tickers
app.get('/indodax_tickers', (req, res) => {
  indodax_tickers((err, tickers) => {
    if (err) {
      res.status(500).json({ error: 'Error retrieving indodax tickers' });
    } else {
      res.json(tickers);
    }
  });
});

// Express GET API for bithumb tickers
app.get('/bithumb_tickers', (req, res) => {
  bithumb_tickers((err, tickers) => {
    if (err) {
      res.status(500).json({ error: 'Error retrieving bithumb tickers' });
    } else {
      res.json(tickers);
    }
  });
});

// Express GET API for rates
app.get('/rates', (req, res) => {
  get_rates((err, rates) => {
    if (err) {
      res.status(500).json({ error: 'Error retrieving rates' });
    } else {
      res.json(rates);
    }
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});