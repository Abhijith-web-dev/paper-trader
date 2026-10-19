# Product Requirements Document (PRD): GlobalTrade Simulator

## 1. Executive Summary
GlobalTrade Simulator is an institutional-grade, responsive international financial-market education and simulated trading platform. It bridges the gap between educational content and realistic market practice by enabling users to trade international equities, foreign exchange, and crypto using virtual funds against real-time and historical market data.

## 2. Target Audience
- Beginners seeking to understand how stock exchanges, order types, and currency conversions function.
- Intermediate traders practicing position sizing, risk-to-reward discipline, and stop-loss execution.
- Quantitative traders and hobbyists testing technical indicator strategies (SMA crossover, RSI) without capital exposure.

## 3. Product Principles
- **No Real Capital**: 100% simulated transactions.
- **Genuine Market Quotes**: Sourced directly from Yahoo Finance, Frankfurter (ECB), and CoinGecko.
- **Zero Fabrication**: When data is stale or delayed, timestamps and latency badges are transparently displayed.
- **Auditability**: All balance changes must be backed by an immutable double-entry ledger entry.

## 4. Key Functional Modules
1. **Global Market Dashboard**: Indices (^GSPC, ^NSEI, ^BSESN), US equities (AAPL, NVDA, MSFT), Indian equities (RELIANCE.NS, TCS.NS), Forex, and Crypto.
2. **Interactive TradingView Candlestick Charting**: Multi-timeframe charts (1D, 5D, 1M, 6M, 1Y) with SMA and indicator overlays.
3. **Paper Trading Engine**: Market, Limit, Stop, and Stop-Limit orders executed against validated quotes.
4. **Foreign Exchange Converter**: Official European Central Bank reference rates with simulated spread calculation.
5. **Backtesting Lab**: Quantitative strategy evaluation (Total Return %, Win Rate, Max Drawdown %, Profit Factor, Trade Log).
6. **Educational Academy**: Structured lessons and interactive quizzes.
