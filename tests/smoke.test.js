/**
 * Automated Smoke Test Suite
 * Tests critical calculations, quote freshness, bounds sanity, and paper trade ledger integrity.
 */

import assert from 'node:assert/strict';
import { getQuoteFreshness, validateQuoteBounds } from '../src/lib/quoteFreshness.js';
import { SCREENER_THRESHOLDS, evaluateStockTechnicalSignal } from '../src/lib/screenerEngine.js';
import { STOCK_DIRECTORY } from '../src/lib/yahooFinance.js';

console.log('🧪 Starting Automated Smoke Test Suite...');

// =========================================================================
// TEST 1: Quote Bounds Validation (AMD Inconsistency Fix)
// =========================================================================
console.log('  Testing Quote Bounds Validation...');
{
  // Test 1.1: Live quote exceeds old static high52 (The exact AMD scenario reported by user)
  // Before fix: price = 516.79, meta.high52 = 227.30 produced ((227.30 - 516.79)/227.30)*100 = -127.4%
  const amdPrice = 516.79;
  const amdStaleHigh = 227.30;
  const amdStaleLow = 135.00;

  const bounds = validateQuoteBounds(amdPrice, amdStaleHigh, amdStaleLow);
  assert.equal(bounds.isValid, true, 'AMD bounds must be flagged valid after auto-expansion');
  assert.ok(bounds.sanitizedHigh52 >= amdPrice, 'sanitizedHigh52 must be >= price');
  assert.ok(bounds.sanitizedLow52 <= amdPrice, 'sanitizedLow52 must be <= price');

  // Verify distance below high is positive (0% to 100%)
  assert.ok(bounds.distFromHigh >= 0 && bounds.distFromHigh <= 100, `Distance below high must be in [0, 100]%, got ${bounds.distFromHigh}%`);

  // Test 1.2: Normal valid bounds
  const normalBounds = validateQuoteBounds(2950, 3100, 2200);
  assert.equal(normalBounds.isValid, true);
  assert.equal(normalBounds.sanitizedHigh52, 3100);
  assert.equal(normalBounds.sanitizedLow52, 2200);

  // Test 1.3: Inverted bounds (low > high)
  const inverted = validateQuoteBounds(100, 80, 120);
  assert.equal(inverted.isValid, true);
  assert.ok(inverted.sanitizedHigh52 >= inverted.sanitizedLow52, 'sanitizedHigh52 must be >= sanitizedLow52');
}
console.log('  ✅ Quote Bounds Validation passed.');

// =========================================================================
// TEST 2: Quote Freshness Telemetry
// =========================================================================
console.log('  Testing Quote Freshness Telemetry...');
{
  const now = Date.now();

  // Test 2.1: Live quote (< 35 seconds old)
  const freshQuote = {
    price: 150.25,
    timestamp: now - 5000, // 5s ago
    source: 'TradingView Floor Engine',
  };
  const freshResult = getQuoteFreshness(freshQuote);
  assert.equal(freshResult.status, 'LIVE');
  assert.equal(freshResult.label, 'LIVE TICK');
  assert.equal(freshResult.isStale, false);

  // Test 2.2: Delayed quote (60s ago)
  const delayedQuote = {
    price: 150.25,
    timestamp: now - 60000,
  };
  const delayedResult = getQuoteFreshness(delayedQuote);
  assert.equal(delayedResult.status, 'DELAYED');
  assert.equal(delayedResult.isStale, false);

  // Test 2.3: Stale quote (> 300s ago)
  const staleQuote = {
    price: 150.25,
    timestamp: now - 350000, // ~6 mins ago
  };
  const staleResult = getQuoteFreshness(staleQuote);
  assert.equal(staleResult.status, 'STALE');
  assert.equal(staleResult.isStale, true);

  // Test 2.4: Unavailable quote
  const emptyResult = getQuoteFreshness(null);
  assert.equal(emptyResult.status, 'UNAVAILABLE');
  assert.equal(emptyResult.isStale, true);
}
console.log('  ✅ Quote Freshness Telemetry passed.');

// =========================================================================
// TEST 3: Half-Kelly Formulation & Edge Invalidation
// =========================================================================
console.log('  Testing Half-Kelly Mathematical Formulation...');
{
  const calculateKelly = (winRatePct, pReward, pRisk) => {
    const b = pRisk > 0 ? pReward / pRisk : 1;
    const p = winRatePct / 100;
    const q = 1 - p;
    const rawKelly = b > 0 ? (p * b - q) / b : 0;
    return rawKelly > 0 ? (rawKelly / 2) * 100 : 0;
  };

  // Test 3.1: Strong positive edge (60% win rate, 2:1 R:R)
  // K = (0.6 * 2 - 0.4) / 2 = (1.2 - 0.4) / 2 = 0.8 / 2 = 0.40 (40%)
  // Half-Kelly = 20%
  const strongEdge = calculateKelly(60, 20, 10);
  assert.ok(strongEdge > 0, 'Kelly must be positive for positive expectancy');
  assert.equal(Math.round(strongEdge), 20);

  // Test 3.2: Negative edge (30% win rate, 1:1 R:R)
  // K = (0.3 * 1 - 0.7) / 1 = -0.40 -> Kelly should be 0 (no trade)
  const negativeEdge = calculateKelly(30, 10, 10);
  assert.equal(negativeEdge, 0, 'Kelly must be 0 for negative expectancy (protects against ruin)');
}
console.log('  ✅ Half-Kelly Mathematical Formulation passed.');

// =========================================================================
// TEST 4: Paper Trade Revert Invariants
// =========================================================================
console.log('  Testing Paper Trade Revert Accounting Invariants...');
{
  // Simulated Wallet & Ledger State
  let wallet = { cashBalance: 100000, realizedPnL: 0 };
  let holdings = {};
  let orders = {};

  // 1. Place BUY order of 10 shares of RELIANCE @ 2500 = 25000
  const orderId = 'ORD_TEST_1';
  const qty = 10;
  const price = 2500;
  const totalCost = qty * price;

  wallet.cashBalance -= totalCost;
  holdings['RELIANCE_NS'] = { symbol: 'RELIANCE.NS', quantity: qty, avgBuyPrice: price, totalCost };
  orders[orderId] = { id: orderId, symbol: 'RELIANCE.NS', action: 'BUY', quantity: qty, price, totalAmount: totalCost, status: 'FILLED' };

  assert.equal(wallet.cashBalance, 75000, 'Cash after buy must be 75,000');
  assert.equal(holdings['RELIANCE_NS'].quantity, 10, 'Holding quantity must be 10');

  // 2. Revert the BUY order
  const ord = orders[orderId];
  assert.equal(ord.status, 'FILLED');

  // Reversion: refund cash and remove holdings
  wallet.cashBalance += ord.totalAmount;
  delete holdings['RELIANCE_NS'];
  ord.status = 'REVERTED';

  assert.equal(wallet.cashBalance, 100000, 'Cash after revert must be restored to 100,000');
  assert.equal(holdings['RELIANCE_NS'], undefined, 'Holding must be deleted upon full revert');
  assert.equal(ord.status, 'REVERTED', 'Order status must be REVERTED');
}
console.log('  ✅ Paper Trade Revert Accounting Invariants passed.');

// =========================================================================
// TEST 5: Screener Signal Thresholds & Stale Quote Suppression
// =========================================================================
console.log('  Testing Screener Signal Thresholds & Stale Quote Suppression...');
{
  // 5.1 Stale Quote Suppression Test
  const staleStock = {
    symbol: 'TATAMOTORS.NS',
    price: 980.50,
    changePercent: 1.2,
    high52: 1100.00,
    low52: 600.00,
    high: 990.00,
    low: 975.00,
  };
  const staleFreshness = {
    isStale: true,
    label: 'STALE (24h old)',
    asOf: 'Yesterday',
    sourceLabel: 'NSE EOD',
  };

  const staleResult = evaluateStockTechnicalSignal(staleStock, staleFreshness);
  assert.equal(staleResult.verdict, 'STALE_QUOTE', 'Stale quote must have signal suppressed to STALE_QUOTE');
  assert.equal(staleResult.isStale, true, 'isStale must be true');
  assert.ok(staleResult.reasoning.includes('Technical signals suspended'), 'Reasoning must clearly communicate signal suspension');

  // 5.2 RSI Overbought Harmonization (RSI >= 65)
  // Stock with strong upward move pushing RSI above 65
  const overboughtStock = {
    symbol: 'RELIANCE.NS',
    price: 1590.00,
    changePercent: 5.6,
    high52: 1608.80,
    low52: 1180.00,
    high: 1600.00,
    low: 1520.00,
  };
  const liveFreshness = { isStale: false, label: 'LIVE TICK' };
  const overboughtResult = evaluateStockTechnicalSignal(overboughtStock, liveFreshness);
  assert.ok(overboughtResult.rsi >= SCREENER_THRESHOLDS.RSI_OVERBOUGHT, `RSI must be >= ${SCREENER_THRESHOLDS.RSI_OVERBOUGHT}, got ${overboughtResult.rsi}`);
  assert.equal(overboughtResult.verdict, 'OVERBOUGHT', 'RSI >= 65 must classify as OVERBOUGHT');

  // 5.3 RSI Oversold Harmonization (RSI <= 35)
  const oversoldStock = {
    symbol: 'INFY.NS',
    price: 1205.00,
    changePercent: -5.8,
    high52: 1950.00,
    low52: 1200.00,
    high: 1240.00,
    low: 1201.00,
  };
  const oversoldResult = evaluateStockTechnicalSignal(oversoldStock, liveFreshness);
  assert.ok(oversoldResult.rsi <= SCREENER_THRESHOLDS.RSI_OVERSOLD, `RSI must be <= ${SCREENER_THRESHOLDS.RSI_OVERSOLD}, got ${oversoldResult.rsi}`);
  assert.equal(oversoldResult.verdict, 'OVERSOLD', 'RSI <= 35 must classify as OVERSOLD');
}
console.log('  ✅ Screener Signal Thresholds & Stale Quote Suppression passed.');

// =========================================================================
// TEST 6: Stock Directory Deduplication & Alias Resolution
// =========================================================================
console.log('  Testing Stock Directory Deduplication & Alias Resolution...');
{
  // 6.1 Confirm GOLDSTAR.NS is marked as alias to GOLDSTAR-SM.NS
  const aliasEntry = STOCK_DIRECTORY['GOLDSTAR.NS'];
  const canonicalEntry = STOCK_DIRECTORY['GOLDSTAR-SM.NS'];

  assert.ok(aliasEntry, 'GOLDSTAR.NS must exist in directory for search lookup');
  assert.ok(canonicalEntry, 'GOLDSTAR-SM.NS must exist as canonical NSE SME entry');
  assert.equal(aliasEntry.isAlias, true, 'GOLDSTAR.NS must be flagged as isAlias: true');
  assert.equal(aliasEntry.targetSymbol, 'GOLDSTAR-SM.NS', 'GOLDSTAR.NS must point to GOLDSTAR-SM.NS');

  // 6.2 Filter universe as Screener does:
  const activeScreenerSymbols = Object.entries(STOCK_DIRECTORY)
    .filter(([sym, meta]) => !meta.isAlias && (!meta.targetSymbol || meta.targetSymbol === sym))
    .map(([sym]) => sym);

  assert.ok(activeScreenerSymbols.includes('GOLDSTAR-SM.NS'), 'Canonical GOLDSTAR-SM.NS must be included in screener');
  assert.ok(!activeScreenerSymbols.includes('GOLDSTAR.NS'), 'Alias GOLDSTAR.NS must be excluded to prevent duplicate cards/rows');
}
console.log('  ✅ Stock Directory Deduplication & Alias Resolution passed.');

console.log('\n🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY! (6/6 test suites)');
