# REST & WebSocket API Reference: GlobalTrade Simulator

Base URL: `http://localhost:4000/api/v1`

## 1. Authentication & Preferences
- `GET /auth/me`: Returns user profile, preferences, and virtual account summary.
- `POST /auth/preferences`: Update base currency (`USD`|`INR`|`EUR`), experience level, or timezone.
- `POST /auth/onboarding`: Set initial balance and preferences.

## 2. Market Data
- `GET /markets/instruments`: List supported instruments (search, exchange filter, asset class filter).
- `GET /markets/quotes/:symbol`: Retrieve current real-world quote for a ticker.
- `GET /markets/quotes?symbols=AAPL,TSLA`: Batch quotes for multiple tickers.
- `GET /markets/candles/:symbol?interval=1d&days=30`: Historical OHLCV candle series.

## 3. Orders & Paper Trading
- `POST /orders`: Place simulated order.
  ```json
  {
    "symbol": "AAPL",
    "side": "BUY",
    "type": "MARKET",
    "quantity": 10,
    "idempotencyKey": "uuid-here"
  }
  ```
- `POST /orders/:id/cancel`: Cancel pending limit/stop order and release held capital.
- `GET /orders`: List active and past simulated orders.

## 4. Portfolio & Ledger
- `GET /portfolio`: Full portfolio valuation, cash balances, unrealized/realized P&L, positions.
- `GET /portfolio/ledger`: Chronological double-entry transaction ledger.
- `POST /portfolio/reset`: Reset portfolio to clean $100,000 state.

## 5. Currency & Forex
- `GET /forex/rate?base=USD&quote=INR`: European Central Bank reference rate.
- `POST /forex/convert`: Calculate conversion amount with optional spread simulation.
- `GET /forex/history?base=USD&quote=INR&days=30`: Historical exchange rate series.

## 6. Backtesting
- `POST /backtest/run`: Run quantitative simulation against historical candles.
- `GET /backtest/history`: Retrieve saved backtest runs.

## 7. WebSocket Streaming Gateway
- Endpoint: `ws://localhost:4001/ws/quotes`
- Subscribe Payload:
  ```json
  {
    "action": "SUBSCRIBE",
    "symbols": ["AAPL", "RELIANCE.NS", "BTC-USD"]
  }
  ```
- Receive Message:
  ```json
  {
    "type": "QUOTE_UPDATE",
    "quote": { "symbol": "AAPL", "price": 224.50, ... }
  }
  ```
