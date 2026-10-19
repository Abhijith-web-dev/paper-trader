# Testing & Verification Guide: GlobalTrade Simulator

## 1. Test Strategy Overview

The testing suite covers:
1. **Financial Arithmetic (`packages/shared`)**: Decimal precision, absence of floating-point inaccuracies, percentage calculations.
2. **Order State Machine (`packages/trading-engine`)**: Verification of legal state transitions (`PENDING -> FILLED`, etc.) and terminal state invariants.
3. **Ledger Accounting (`packages/trading-engine`)**: Double-entry ledger reconciliation, fund reservation for orders, and release upon cancellation.
4. **Matching Engine (`packages/trading-engine`)**: Market order execution with slippage, limit order threshold evaluation, and stop loss triggers.
5. **Backtester (`packages/trading-engine`)**: Indicator calculation, deterministic execution ordering without look-ahead bias, and equity curve generation.

## 2. Executing Automated Tests

Run the test suite across all packages:
```bash
pnpm test
```

Or run testing in individual packages:
```bash
# Shared package tests
pnpm --filter @globaltrade/shared test

# Trading engine tests
pnpm --filter @globaltrade/trading-engine test
```

## 3. Manual E2E Verification Checklist

1. **Dashboard & Quotes**:
   - Verify live quotes load for AAPL, TSLA, and RELIANCE.NS with correct market status.
2. **Placing a Simulated Market Buy**:
   - Navigate to `/instrument/AAPL`, choose Buy 10 shares Market order.
   - Confirm balance is debited and position appears in Portfolio.
3. **Placing and Cancelling a Limit Order**:
   - Place a Limit Buy below market price.
   - Verify status is `PENDING` under `/orders`.
   - Click Cancel and verify reserved cash returns to available balance in `/portfolio`.
4. **Forex Rate Conversion**:
   - Navigate to `/forex`, convert 1,000 USD to INR. Verify calculation and historical ECB table.
5. **Backtesting Run**:
   - Navigate to `/backtesting`, run SMA Crossover on AAPL. Verify metrics and trade log.
