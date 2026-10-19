# System Architecture: GlobalTrade Simulator

## 1. High-Level Architecture Overview

GlobalTrade Simulator adopts a decoupled, multi-tier reactive architecture designed for high throughput, free-tier optimization, and strict data consistency:

```
[ Web Client: React 19 + Lightweight Charts ]
      |                      ^
   (HTTPS)               (WebSocket)
      v                      |
[ Fastify REST API ] <---> [ Market Worker (Quote Cache & PubSub) ]
      |                                  |
      v                                  v
[ Firebase Auth & Firestore ]      [ Yahoo Finance / ECB / CoinGecko ]
      |
      v
[ Supabase Storage (Buckets: avatars, learning, receipts) ]
```

## 2. Component Breakdown

### A. Frontend (`apps/web`)
- **Framework**: React 19 + TypeScript + Vite.
- **Styling**: Tailwind CSS with custom fintech dark/light palette.
- **Charting**: TradingView Lightweight Charts with canvas acceleration and responsive resizing.
- **State & Server Cache**: TanStack Query for request deduplication and client-side caching.

### B. Core API (`apps/api`)
- **Server**: Fastify with HTTP/2 and low-overhead routing.
- **Authentication**: Firebase Admin SDK token verification with mock test session fallback.
- **Database Engine**: Firebase Firestore with atomic `runTransaction` batching for double-entry ledger and order matching.
- **File Storage**: Supabase Storage client for avatars and trade receipts.

### C. Market Data Worker (`apps/market-worker`)
- **Provider Adapters**: Yahoo Finance (`yahoo-finance2`), Frankfurter API (ECB FX), CoinGecko.
- **In-Memory Cache**: 5-second TTL for equity/crypto quotes, 60-second TTL for FX cross-rates.
- **WebSocket Gateway**: Single upstream polling loop per active ticker shared among all connected frontend clients.

### D. Packages Core
- `@globaltrade/shared`: Type contracts, Zod schemas, decimal-safe arithmetic.
- `@globaltrade/market-data`: Provider adapters, normalizer, health telemetry.
- `@globaltrade/trading-engine`: Matching engine, order state machine, P&L calculator, backtester.
