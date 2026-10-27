# 🏛️ Paper Trader Terminal

> **Institutional-Grade Multi-Market Paper Trading Platform (NSE & US Equities)**  
> Real-time simulated execution, algorithmic screener, trade journal post-mortems, quantitative backtester with walk-forward replay, and mathematical risk management.

[![Live Application](https://img.shields.io/badge/Live%20App-paper--trader--001.web.app-blue?style=flat&logo=googlechrome)](https://paper-trader-001.web.app)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20RTDB-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Edge%20Worker-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌐 Live Deployment

Access the production deployment:  
👉 **[https://paper-trader-001.web.app](https://paper-trader-001.web.app)**

---

## 📖 Overview

**Paper Trader Terminal** is a high-speed, zero-backend-cost financial simulation platform tailored for retail traders, quantitative researchers, and active swing traders. Designed with a classic broadsheet vintage aesthetic (`#111111`, `#FAF8F3`, `#F6F4EE`), it combines institutional-grade execution mechanics with zero-cost serverless infrastructure.

### Why Paper Trader?
- **Realistic Friction**: Simulates real exchange slippage, liquidity caps, and accurate statutory charges (NSE STT, SEBI turnover, GST, Stamp Duty vs. US SEC Section 31, FINRA TAF).
- **100% Free & Scalable**: Runs on client-side Web Workers, Dexie.js (IndexedDB), and Cloudflare Edge Proxy with Firebase Firestore/RTDB free quotas.
- **Auditable Ledger**: Immutable order execution history with 1-click trade reversion and balance reconciliation.
- **Strict Accounting Parity**: Unifies Gross P&L, Statutory Deductions, and Net Return across the Dashboard, Holdings, and Journal.

---

## ✨ Key Features

### 1. 📈 Real-Time Multi-Market Terminal
- **NSE (Indian Rupee - INR)**: Pre-configured with top Nifty 50 constituents, mid-caps, and SME listings (e.g. `RELIANCE.NS`, `TCS.NS`, `TATAMOTORS.NS`, `GOLDSTAR-SM.NS`).
- **US Equities (US Dollar - USD)**: Pre-configured with megacap tech and blue-chip equities (`AAPL`, `MSFT`, `NVDA`, `AMZN`, `GOOGL`, `TSLA`).
- **Dynamic Cross-Market Search**: Global search engine resolving symbols, tickers, and companies with alias auto-redirection.
- **Quote Telemetry & Freshness**: Real-time staleness monitoring (`LIVE TICK`, `DELAYED`, `STALE DATA • 24h old`) with automatic trade suppression on expired quotes.

### 2. 🔍 Quantitative Technical Screener
- **Harmonized Technical Presets**:
  - `Overbought (RSI ≥ 65)`
  - `Oversold (RSI ≤ 35)`
  - `High Momentum (+0.8% Gain)`
  - `Heavy Distribution (-0.8% Drop)`
  - `52-Week High Breakout (Within 5%)`
  - `52-Week Value Floor (Within 6%)`
- **Plain-Language Explanations**: Every signal provides its indicators, mathematical condition, timeframe, and explicit invalidation criteria.
- **Instrument Deduplication**: Excludes aliases from listings while maintaining seamless search navigation.

### 3. 📓 Trade Journal & Post-Mortem Analytics
- **Categorical Separation**: Explicitly isolates Open Positions, Closed Trades, and Execution Order History.
- **Accurate Mathematical Sampling**: Empty metric states display `N/A (0 closed trades)` and `AWAITING CLOSED EXITS` instead of misleading 0% results.
- **Performance Ratios**: Calculates Win Rate %, Profit Factor, Payoff Ratio, Expectancy, Sharpe Ratio, and Sortino Ratio.
- **Discipline Auditing**: Tracks trading emotion, thesis adherence, and plan execution score.

### 4. 🧪 Quantitative Backtester & Bar-by-Bar Replay
- **Client-Side Web Worker**: Computes multi-period backtests off the main UI thread in under 15ms.
- **Timeframe Spans**: Test strategies across `6M`, `1Y`, and `2Y` historical daily datasets.
- **Custom Strategy Builder**: Interactive rule editor allowing traders to toggle and combine RSI thresholds, 9/21 EMA crossover, MACD histogram, and candlestick patterns with `localStorage` persistence.
- **Quantitative Audit & Overfitting Guard**:
  - Exact tested date range and total bars.
  - 70% In-Sample training vs. 30% Out-of-Sample walk-forward validation split.
  - Overfitting protection warnings.
- **Interactive Step Replay**: Visual bar-by-bar historical simulator (`BacktestReplayChart`) with step controls, variable speeds (1x, 2x, 5x), and live trade execution markers.

### 5. ⚖️ Mathematical Risk & Kelly Position Sizing
- **Half-Kelly Advisory Formulation**: Calculates recommended risk capital allocation based on historical or strategy win rate and payoff ratio.
- **Win-Rate Sensitivity Badge**: Prominently displays `Assumes X% WR` directly beside the advisory calculation.
- **Risk Budget Guardrails**: Computes maximum shares based on hard account risk tolerance (e.g. 1%, 2%) and stop-loss distance.

### 6. 📊 Portfolio Sector Allocation & Combined Risk Exposure
- **Macro Exposure Strip**: Real-time breakdown of INR vs. USD equity exposure %, Top Asset Concentration % with single-asset risk alerts, and Cash vs. Equity reserve ratio.
- **Visual Segmented Sector Bar**: Broadsheet style proportional sector distribution.
- **Sector Weighting Cards**: Categorized by `Core`, `Overweight`, and `Diversified`.

---

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                 Paper Trader Client (React 19)             │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Dashboard & Nav │  │ Screener Engine  │  │ Trade Modal │ │
│  └────────┬────────┘  └────────┬─────────┘  └──────┬──────┘ │
│           │                    │                   │        │
│  ┌────────▼────────────────────▼───────────────────▼──────┐ │
│  │                State & Synchronization                 │ │
│  │  - AuthContext (Session persistence & Cloud sync)       │ │
│  │  - Dexie.js / IndexedDB (0ms instant offline recall)   │ │
│  └────────┬────────────────────────────────────────┬──────┘ │
└───────────┼────────────────────────────────────────┼────────┘
            │                                        │
    ┌───────▼────────────────────────┐       ┌───────▼──────────────┐
    │     Cloudflare Edge Worker     │       │   Firebase Backend   │
    │  - Yahoo Finance / Market Data │       │  - Authentication    │
    │  - CORS Bypass & Caching       │       │  - Firestore DB      │
    │  - Free Quota Preservation     │       │  - Realtime Database │
    └────────────────────────────────┘       └──────────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Framework & UI** | React 19, Vite 8, Tailwind CSS v4, Lucide React |
| **Charts & Microstructure** | Lightweight Charts v5, Canvas 2D Sparklines |
| **Local Cache & Storage** | Dexie.js (IndexedDB), LocalStorage, Web Crypto API |
| **Cloud Synchronization** | Firebase Authentication, Cloud Firestore, Realtime Database |
| **Edge Proxy** | Cloudflare Workers (CORS & rate limit bypass) |
| **Background Processing** | Web Workers (`backtester.worker.js`) |
| **Linting & Code Quality** | Oxlint (0 errors across 65 files) |
| **Automated Testing** | Node.js native assert test runner (Smoke, Security Rules, Journal Metrics) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.0.0 or higher
- npm (or pnpm / yarn)

### 1. Clone the Repository
```bash
git clone https://github.com/Abhijith-web-dev/paper-trader.git
cd paper-trader
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` (or configure your Firebase credentials):
```bash
cp .env.example .env
```

Fill in your Firebase project configuration:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

The project includes automated regression and smoke test suites using Node's native `assert` module:

```bash
# Run all automated test suites
npm test
```

### Test Coverage:
1. **`tests/smoke.test.js`**:
   - Quote bounds validation (preventing impossible 52-week envelope calculations)
   - Quote freshness telemetry (`LIVE`, `DELAYED`, `STALE`)
   - Half-Kelly criterion mathematical formulations
   - Paper trade ledger reversion and wallet accounting invariants
   - Screener signal threshold harmonization (RSI ≥ 65, RSI ≤ 35)
   - Stock directory deduplication & alias resolution
2. **`tests/security_rules.test.js`**:
   - Multi-account Firestore isolation
   - User ownership verification on private documents
3. **`tests/journal_metrics.test.js`**:
   - Statutory fee calculation (NSE STT, GST, Stamp Duty vs US SEC, FINRA)
   - Realized vs floating P&L calculations
   - Zero-sample & buy-only metric guards

### Linting
```bash
npm run lint
```

### Production Build
```bash
npm run build
```

---

## 🚢 Deployment

### Firebase Hosting
To deploy to Firebase Hosting:
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy hosting
npm run build
npx firebase deploy --only hosting
```

### Cloudflare Worker (Market Proxy)
The directory [`cloudflare-market-worker/`](cloudflare-market-worker/) contains the serverless edge proxy:
```bash
cd cloudflare-market-worker
# Deploy with Wrangler
npx wrangler deploy
```

---

## 📁 Repository Structure

```
├── .github/
│   └── workflows/              # CI/CD automated test & build workflows
├── cloudflare-market-worker/   # Cloudflare Edge Worker for market data proxying
├── public/                     # Static icons, manifest, and favicon assets
├── src/
│   ├── components/             # Reusable UI components & modals
│   │   ├── BacktesterModal.jsx
│   │   ├── BacktestReplayChart.jsx
│   │   ├── ScreenerView.jsx
│   │   ├── TradingPerformance.jsx
│   │   ├── RiskCalculatorModal.jsx
│   │   ├── TradeModal.jsx
│   │   └── TradeJournalView.jsx
│   ├── context/                # React Contexts (AuthContext)
│   ├── lib/                    # Core financial, telemetry & mathematical logic
│   │   ├── journalAnalytics.js # P&L, fees & performance metrics
│   │   ├── quoteFreshness.js   # Freshness & bounds validation
│   │   ├── screenerEngine.js   # Canonical quantitative signals
│   │   ├── yahooFinance.js     # Market directory & pricing feeds
│   │   ├── omniFeed.js         # Streaming market tick orchestrator
│   │   └── localDb.js          # Dexie.js IndexedDB schema
│   ├── pages/                  # Top-level view routes
│   │   ├── DashboardPage.jsx
│   │   ├── JournalPage.jsx
│   │   ├── ScreenerPage.jsx
│   │   └── TransactionsPage.jsx
│   └── workers/
│       └── backtester.worker.js # Multi-threaded quantitative backtester
├── tests/                      # Automated smoke & regression test suites
├── database.rules.json         # Firebase Realtime Database security rules
├── firestore.rules             # Cloud Firestore security rules
├── package.json
└── vite.config.js
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
