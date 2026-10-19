# Market Data Architecture: GlobalTrade Simulator

## 1. Provider Integrations

### Yahoo Finance Adapter (`YahooFinanceAdapter`)
- **Library**: `yahoo-finance2`
- **Instruments Covered**:
  - US Equities: AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL.
  - Indian Equities (NSE): RELIANCE.NS, TCS.NS, INFY.NS, HDFCBANK.NS.
  - Global Indices: S&P 500 (^GSPC), NASDAQ (^IXIC), Nifty 50 (^NSEI), BSE Sensex (^BSESN).
- **Data Retrieved**:
  - Real-time regularMarketPrice, bid/ask, day high/low, open, previous close, volume.
  - Historical OHLCV candles across 1m, 5m, 15m, 1h, 1d, 1wk, 1mo intervals.

### Frankfurter ECB Forex Adapter (`FrankfurterAdapter`)
- **API**: `https://api.frankfurter.app` (European Central Bank Reference Rates)
- **Characteristics**: Free, official, zero API keys required, reliable.
- **Currencies**: EUR, USD, INR, GBP, JPY, CAD, AUD, CHF, SGD.
- **Cache TTL**: 60 seconds.

### CoinGecko Crypto Adapter (`CoinGeckoAdapter`)
- **API**: `https://api.coingecko.com/api/v3`
- **Pairs**: BTC-USD, ETH-USD, SOL-USD.
- **Cache TTL**: 15 seconds.

## 2. Ingestion & Fanout Pipeline

```
Upstream Providers (Yahoo / ECB / CoinGecko)
                 |
                 v
   MarketWorker Ingestion Engine
                 |
                 +--> In-Memory Cache (TTL: 5s Quotes / 60s FX)
                 |
                 +--> WebSocket Gateway (/ws/quotes)
                            |
           +----------------+----------------+
           v                                 v
     Client Browser 1                  Client Browser 2
```

1. **Shared Subscriptions**: When multiple users view `AAPL`, the server maintains one upstream polling loop, distributing normalized ticks to all subscribers over WebSockets.
2. **Stale Data Handling**: If an upstream provider fails, the quote is marked with `isStale: true` and the elapsed time since the last valid tick is displayed.
