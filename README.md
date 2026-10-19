# GlobalTrade Simulator 🌐📈

> Production-quality, responsive international financial-market education and simulated trading platform inspired by INDmoney, Groww, and TradingView.

GlobalTrade Simulator empowers users to explore global financial markets (US equities, Indian NSE/BSE equities, global indices, ETFs, Forex, and crypto), monitor real-time and provider-delayed market prices, inspect multi-timeframe interactive candlestick charts with technical indicators, convert currencies with decimal-safe FX rates, manage virtual portfolios, execute simulated market/limit/stop orders against **real market quotes**, test strategies via a historical backtesting engine, and practice risk management without capital risk.

---

## ⚡ Architectural Highlights

1. **Genuine Market Feeds (Zero Fabrication)**:
   - Equities, Indices & ETFs via **Yahoo Finance (`yahoo-finance2`)** (AAPL, MSFT, NVDA, RELIANCE.NS, TCS.NS, ^NSEI, ^GSPC).
   - Foreign Exchange via **Frankfurter API (European Central Bank)** reference cross-rates.
   - Cryptocurrencies via **CoinGecko API** (BTC, ETH, SOL).
2. **Deterministic Virtual Matching & Double-Entry Ledger**:
   - Backend-validated order execution against real quotes.
   - Append-only transactional ledger with idempotency keys and row locking.
3. **Decoupled Identity & Storage**:
   - **Firebase Authentication & Firestore**: User identity, virtual accounts, orders, positions, and backtest results.
   - **Supabase Storage**: Object storage for user avatars, trade receipts, and educational materials.
4. **Monorepo Architecture**:
   - `apps/web`: React 19 + TypeScript + Vite + Tailwind CSS + Lightweight Charts + TanStack Query.
   - `apps/api`: Fastify API server with route plugins, Firebase Admin, and Supabase integration.
   - `apps/market-worker`: Shared subscription worker with 5-second in-memory quote cache and WebSocket broadcasting.
   - `packages/shared`, `packages/market-data`, `packages/trading-engine`: Core mathematical, domain, and adapter packages.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)

### 1. Installation
```bash
# Clone and enter directory
cd "c:/tmp/foregin trading"

# Install all dependencies across monorepo
pnpm install
```

### 2. Environment Configuration
```bash
# Copy example template
cp .env.example .env
```

### 3. Run Development Services
```bash
# Run Market Worker (Port 4001)
pnpm --filter @globaltrade/market-worker dev

# Run Backend API (Port 4000)
pnpm --filter @globaltrade/api dev

# Run Web Client (Port 5173)
pnpm --filter @globaltrade/web dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing

Run comprehensive unit and integration tests across financial math, order state transitions, matching engine, and backtester:
```bash
pnpm test
```

---

## 📚 Complete Technical Documentation

- 📋 [Product Requirements Document (PRD)](./docs/PRD.md)
- 🏗️ [System Architecture](./docs/ARCHITECTURE.md)
- 🗄️ [Database & Firestore Schema](./docs/DATABASE_SCHEMA.md)
- 🔒 [Security & Compliance](./docs/SECURITY.md)
- 📊 [Market Data Ingestion Pipeline](./docs/MARKET_DATA.md)
- 💼 [Paper Trading & Ledger Engine](./docs/PAPER_TRADING.md)
- 🚢 [Self-Hosting & Deployment](./docs/DEPLOYMENT.md)
- 🔌 [REST & WebSocket API Reference](./docs/API_REFERENCE.md)
- 🧪 [Testing & Verification Guide](./docs/TESTING.md)

---

## ⚖️ Legal & Educational Disclaimer

GlobalTrade Simulator is strictly designed for educational and strategy testing purposes. All trading activities use 100% virtual funds. We do not accept real-money deposits, execute orders on real brokerages, or provide financial advice.
