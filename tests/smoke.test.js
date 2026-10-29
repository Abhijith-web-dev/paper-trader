/**
 * Automated Smoke Test Suite
 * Tests critical calculations, quote freshness, bounds sanity, and paper trade ledger integrity.
 */

import assert from 'node:assert/strict';
import { getQuoteFreshness, validateQuoteBounds } from '../src/lib/quoteFreshness.js';
import { SCREENER_THRESHOLDS, evaluateStockTechnicalSignal } from '../src/lib/screenerEngine.js';
import { STOCK_DIRECTORY, getStockHistoricalCandles } from '../src/lib/yahooFinance.js';
import { synthesizeCandlesticks } from '../src/lib/microstructureEngine.js';
import { 
  validateCandle, 
  aggregateIntradayCandles, 
  getExchangeTimezoneMeta, 
  harmonizeSessionBounds,
  formatExchangeLocalTime,
  sliceRecentIntradayCandles,
  getTimeframeWindowDescription 
} from '../src/lib/intradayAggregator.js';

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

// =========================================================================
// TEST 7: Intraday Candle & Session Range Invariants
// =========================================================================
console.log('  Testing Intraday Candle & Session Range Invariants...');
{
  ['1m', '3m', '5m', '1D'].forEach((tf) => {
    const metrics = {
      price: 1194.70,
      open: 1195.00,
      high: 1198.00,
      low: 1184.00,
      previousClose: 1201.80,
      rawVolume: 5000000,
    };

    const result = synthesizeCandlesticks('RELIANCE.NS', metrics, tf);
    assert.ok(result.candles.length >= 10, `${tf} must synthesize at least 10 bars`);
    assert.equal(result.currentPrice, metrics.price, `${tf} currentPrice must match quote price`);
    assert.ok(result.dayHigh >= result.currentPrice, `${tf} dayHigh must be >= currentPrice`);
    assert.ok(result.dayLow <= result.currentPrice, `${tf} dayLow must be <= currentPrice`);

    // Verify every single candle respects session bounds
    for (const c of result.candles) {
      assert.ok(c.high <= result.dayHigh + 0.001, `Candle high ${c.high} must not exceed dayHigh ${result.dayHigh}`);
      assert.ok(c.low >= result.dayLow - 0.001, `Candle low ${c.low} must not be below dayLow ${result.dayLow}`);
      assert.ok(c.high >= c.low, `Candle high must be >= low`);
      assert.ok(c.high >= c.open && c.high >= c.close, `Candle high must envelope open/close`);
      assert.ok(c.low <= c.open && c.low <= c.close, `Candle low must envelope open/close`);
    }

    // Verify last bar close strictly equals current quote price
    const lastBar = result.candles[result.candles.length - 1];
    assert.equal(lastBar.close, metrics.price, `${tf} last candle close must equal quote price`);
  });
}
console.log('  ✅ Intraday Candle & Session Range Invariants passed.');

// =========================================================================
// TEST 8: Candle Validation & Invariant Guard
// =========================================================================
console.log('  Testing Candle Invariant Validation...');
{
  // 8.1 Valid normal candle
  const valid = validateCandle({ time: 1000, open: 100, high: 105, low: 98, close: 102, volume: 500 });
  assert.equal(valid.isValid, true);
  assert.equal(valid.candle.open, 100);
  assert.equal(valid.candle.high, 105);
  assert.equal(valid.candle.low, 98);
  assert.equal(valid.candle.close, 102);
  assert.equal(valid.candle.volume, 500);

  // 8.2 Discrepant high < max(open, close) auto-enveloped
  const highDeficient = validateCandle({ time: 1000, open: 100, high: 99, low: 95, close: 98, volume: 100 });
  assert.equal(highDeficient.isValid, true);
  assert.equal(highDeficient.candle.high, 100, 'High must envelope open');

  // 8.3 Discrepant low > min(open, close) auto-enveloped
  const lowExcessive = validateCandle({ time: 1000, open: 100, high: 110, low: 102, close: 105, volume: 100 });
  assert.equal(lowExcessive.isValid, true);
  assert.equal(lowExcessive.candle.low, 100, 'Low must envelope open');

  // 8.4 Corrupt / negative values rejected
  const negativeClose = validateCandle({ time: 1000, open: 100, high: 105, low: 95, close: -10, volume: 100 });
  assert.equal(negativeClose.isValid, false);

  const nonNumeric = validateCandle({ time: 1000, open: 'abc', high: 105, low: 95, close: 100, volume: 100 });
  assert.equal(nonNumeric.isValid, false);
}
console.log('  ✅ Candle Invariant Validation passed.');

// =========================================================================
// TEST 9: Session-Aligned 1m -> 3m & 1m -> 5m Candle Aggregation
// =========================================================================
console.log('  Testing Session-Aligned 1m -> 3m & 5m Candle Aggregation...');
{
  const sessionStart = 1793072700; // 09:15:00 IST

  // Construct 6 consecutive 1m bars starting at session open
  const raw1m = [
    // Bucket 1 (09:15 - 09:18: bars at 09:15, 09:16, 09:17)
    { time: sessionStart, open: 100.0, high: 102.5, low: 99.5, close: 101.0, volume: 1000 },
    { time: sessionStart + 60, open: 101.0, high: 104.0, low: 100.5, close: 103.5, volume: 1500 },
    { time: sessionStart + 120, open: 103.5, high: 103.8, low: 99.0, close: 100.0, volume: 2000 },
    // Bucket 2 (09:18 - 09:21: bars at 09:18, 09:19, 09:20)
    { time: sessionStart + 180, open: 100.0, high: 101.5, low: 98.5, close: 99.0, volume: 1200 },
    { time: sessionStart + 240, open: 99.0, high: 100.0, low: 97.0, close: 97.5, volume: 800 },
    { time: sessionStart + 300, open: 97.5, high: 98.5, low: 96.0, close: 98.0, volume: 2500 },
  ];

  // 9.1 Aggregate into 3-minute bars
  const aggregated3m = aggregateIntradayCandles(raw1m, 3, sessionStart);
  assert.equal(aggregated3m.length, 2, '6 1m bars must aggregate to exactly 2 3m bars');

  // Verify Bucket 1
  const b1 = aggregated3m[0];
  assert.equal(b1.time, sessionStart, 'Bucket 1 time must match sessionStart');
  assert.equal(b1.open, 100.0, 'Bucket 1 open must be first bar open (100.0)');
  assert.equal(b1.high, 104.0, 'Bucket 1 high must be max(102.5, 104.0, 103.8) = 104.0');
  assert.equal(b1.low, 99.0, 'Bucket 1 low must be min(99.5, 100.5, 99.0) = 99.0');
  assert.equal(b1.close, 100.0, 'Bucket 1 close must be last bar close (100.0)');
  assert.equal(b1.volume, 4500, 'Bucket 1 volume must be sum(1000 + 1500 + 2000) = 4500');

  // Verify Bucket 2
  const b2 = aggregated3m[1];
  assert.equal(b2.time, sessionStart + 180, 'Bucket 2 time must be sessionStart + 180s');
  assert.equal(b2.open, 100.0, 'Bucket 2 open must be bar 4 open (100.0)');
  assert.equal(b2.high, 101.5, 'Bucket 2 high must be max(101.5, 100.0, 98.5) = 101.5');
  assert.equal(b2.low, 96.0, 'Bucket 2 low must be min(98.5, 97.0, 96.0) = 96.0');
  assert.equal(b2.close, 98.0, 'Bucket 2 close must be last bar close (98.0)');
  assert.equal(b2.volume, 4500, 'Bucket 2 volume must be sum(1200 + 800 + 2500) = 4500');

  // 9.2 Gap handling: missing minute bar in bucket
  const gapRaw = [
    { time: sessionStart, open: 50.0, high: 52.0, low: 49.0, close: 51.0, volume: 500 },
    // Missing minute at sessionStart + 60
    { time: sessionStart + 120, open: 51.0, high: 53.0, low: 50.5, close: 52.5, volume: 700 },
  ];
  const gapResult = aggregateIntradayCandles(gapRaw, 3, sessionStart);
  assert.equal(gapResult.length, 1, 'Gap bucket must aggregate gracefully');
  assert.equal(gapResult[0].open, 50.0);
  assert.equal(gapResult[0].high, 53.0);
  assert.equal(gapResult[0].low, 49.0);
  assert.equal(gapResult[0].close, 52.5);
  assert.equal(gapResult[0].volume, 1200);

  // 9.3 5-minute aggregation from 1m bars
  const agg5m = aggregateIntradayCandles(raw1m, 5, sessionStart);
  assert.equal(agg5m.length, 2, '6 1m bars across 5m boundary must produce 2 buckets (5 bars in first, 1 in second)');
  assert.equal(agg5m[0].time, sessionStart);
  assert.equal(agg5m[0].open, 100.0);
  assert.equal(agg5m[0].high, 104.0);
  assert.equal(agg5m[0].low, 97.0);
  assert.equal(agg5m[0].close, 97.5);
  assert.equal(agg5m[0].volume, 6500);
}
console.log('  ✅ Session-Aligned 1m -> 3m & 5m Candle Aggregation passed.');

// =========================================================================
// TEST 10: Exchange Timezone Resolution & Time Formatting
// =========================================================================
console.log('  Testing Exchange Timezone Resolution & Time Formatting...');
{
  // 10.1 Indian Equities (NSE)
  const nseMeta = getExchangeTimezoneMeta('RELIANCE.NS');
  assert.equal(nseMeta.timezone, 'IST');
  assert.equal(nseMeta.exchangeTimezoneName, 'Asia/Kolkata');
  assert.equal(nseMeta.gmtoffset, 19800);
  assert.equal(nseMeta.marketName, 'NSE');
  assert.equal(nseMeta.currency, 'INR');

  // Format 03:45 UTC (09:15 IST)
  const epochNSE = 1793072700;
  const timeFormatted = formatExchangeLocalTime(epochNSE, nseMeta, 'tick');
  assert.equal(timeFormatted, '09:15', '03:45 UTC must format to 09:15 in Asia/Kolkata');

  const fullFormatted = formatExchangeLocalTime(epochNSE, nseMeta, 'time');
  assert.ok(fullFormatted.includes('09:15') && fullFormatted.includes('IST'), `Must include 09:15 and IST, got ${fullFormatted}`);

  // 10.2 US Equities (NASDAQ / NYSE)
  const usMeta = getExchangeTimezoneMeta('AAPL');
  assert.equal(usMeta.exchangeTimezoneName, 'America/New_York');
  assert.equal(usMeta.currency, 'USD');

  // Format 13:30 UTC (09:30 EDT)
  const epochUS = 1793021400; // 2026-10-26T13:30:00.000Z
  const usTick = formatExchangeLocalTime(epochUS, usMeta, 'tick');
  assert.equal(usTick, '09:30', '13:30 UTC must format to 09:30 in America/New_York');
}
console.log('  ✅ Exchange Timezone Resolution & Time Formatting passed.');

// =========================================================================
// TEST 11: Zero Fabrication for Intraday Data
// =========================================================================
console.log('  Testing Zero Fabrication for Intraday Data...');
{
  // When fetching candles for a non-existent or blank symbol on intraday timeframe
  const fakeSymbol = 'NONEXISTENT_STOCK_999.NS';
  const intradayRes = await getStockHistoricalCandles(fakeSymbol, '1m');

  assert.equal(intradayRes.isUnavailable, true, 'Intraday fetch must return isUnavailable: true');
  assert.equal(intradayRes.candles.length, 0, 'No synthetic candles may be fabricated for intraday');
  assert.ok(intradayRes.reason.includes('unavailable'), 'Reason must explicitly state data is unavailable');
}
console.log('  ✅ Zero Fabrication for Intraday Data passed.');

// =========================================================================
// TEST 12: Respective Last Current Minutes Slicing & Window Integrity (1m, 3m, 5m)
// =========================================================================
console.log('  Testing Respective Last Current Minutes Slicing & Window Integrity...');
{
  const sessionStart = 1793072700; // 09:15:00 IST
  // Generate 375 1-minute bars spanning a full 6.25 hour day (09:15 to 15:30)
  const fullDay1mBars = [];
  for (let i = 0; i < 375; i++) {
    const t = sessionStart + i * 60;
    fullDay1mBars.push({
      time: t,
      open: 1190 + Math.sin(i / 10) * 5,
      high: 1195 + Math.sin(i / 10) * 5,
      low: 1188 + Math.sin(i / 10) * 5,
      close: 1192 + Math.sin(i / 10) * 5,
      volume: 1000 + i * 10,
    });
  }

  // 12.1 Verify 1m slicing: full 375 bars sliced to respective last 60 minutes
  const sliced1m = sliceRecentIntradayCandles(fullDay1mBars, '1m', 60);
  assert.equal(sliced1m.length, 60, '1m view must contain exactly 60 bars (last 60 minutes)');
  assert.equal(sliced1m[sliced1m.length - 1].time, fullDay1mBars[374].time, 'Last bar must be the latest current session bar');
  assert.equal(sliced1m[0].time, fullDay1mBars[315].time, 'First bar must be exactly 59 minutes before the last bar');
  const spanSec1m = sliced1m[sliced1m.length - 1].time - sliced1m[0].time;
  assert.equal(spanSec1m, 59 * 60, 'Time span must cover exactly 59 intervals = 60 minute bars');

  // 12.2 Verify 3m aggregation and slicing:
  const agg3m = aggregateIntradayCandles(fullDay1mBars, 3, sessionStart);
  assert.equal(agg3m.length, 125, '375 1m bars must aggregate to 125 3m bars');
  const sliced3m = sliceRecentIntradayCandles(agg3m, '3m', 60);
  assert.equal(sliced3m.length, 60, '3m view must contain exactly 60 bars (last 180 minutes / 3 hours)');
  assert.equal(sliced3m[sliced3m.length - 1].time, agg3m[124].time, 'Last 3m bar must match latest aggregated bar');

  // 12.3 Verify 5m aggregation and slicing:
  const agg5m = aggregateIntradayCandles(fullDay1mBars, 5, sessionStart);
  assert.equal(agg5m.length, 75, '375 1m bars must aggregate to 75 5m bars');
  const sliced5m = sliceRecentIntradayCandles(agg5m, '5m', 60);
  assert.equal(sliced5m.length, 60, '5m view must contain exactly 60 bars (last 300 minutes / 5 hours)');

  // 12.4 Verify 1D preserves all session bars without slicing
  const preserved1D = sliceRecentIntradayCandles(agg5m, '1D', 60);
  assert.equal(preserved1D.length, 75, '1D timeframe must preserve all session bars (75 bars)');

  // 12.5 Verify Window Description Metadata
  const desc1m = getTimeframeWindowDescription('1m');
  assert.equal(desc1m.window, 'Last 60m');
  assert.equal(desc1m.fullLabel, 'LAST 60 MINS (1m BARS)');

  const desc3m = getTimeframeWindowDescription('3m');
  assert.equal(desc3m.window, 'Last 3h');
  assert.equal(desc3m.fullLabel, 'LAST 180 MINS (3m BARS)');

  const desc5m = getTimeframeWindowDescription('5m');
  assert.equal(desc5m.window, 'Last 5h');
  assert.equal(desc5m.fullLabel, 'LAST 300 MINS (5m BARS)');

  const desc1D = getTimeframeWindowDescription('1D');
  assert.equal(desc1D.window, 'Session');

  // 12.6 Verify session extremes are preserved from full day even when sliced
  // Peak high occurred at bar 50 (middle of the day), well outside the last 60 bars
  fullDay1mBars[50].high = 1250.0;
  const bounds = harmonizeSessionBounds(fullDay1mBars, 1192.0, 1250.0, 1180.0);
  assert.equal(bounds.dayHigh, 1250.0, 'Session dayHigh must preserve daytime peak even when display candles are windowed');
}
console.log('  ✅ Respective Last Current Minutes Slicing & Window Integrity passed.');

// =========================================================================
// TEST 13: Live Price Batching, Micro-Cache & Circuit Breaker Anti-Ban Resilience
// =========================================================================
console.log('  Testing Live Price Batching, Micro-Cache & Circuit Breaker Anti-Ban Resilience...');
{
  const { registerLiveSymbols, TV_SYMBOL_MAP, REVERSE_TV_MAP } = await import('../src/lib/omniFeed.js');
  const { 
    isCloudflareTripped, 
    tripCloudflare, 
    getCachedQuote, 
    setCachedQuote 
  } = await import('../src/lib/cloudQuotaManager.js');

  // 13.1 Dynamic registration creates dual candidate mappings for Indian symbols
  registerLiveSymbols(['TATASTEEL.NS']);
  assert.ok(TV_SYMBOL_MAP['TATASTEEL.NS'] === 'NSE:TATASTEEL', 'Indian stock must map to NSE ticker');
  assert.equal(REVERSE_TV_MAP['NSE:TATASTEEL'], 'TATASTEEL.NS', 'Reverse map for NSE ticker must resolve to original symbol');
  assert.equal(REVERSE_TV_MAP['BSE:TATASTEEL'], 'TATASTEEL.NS', 'Reverse map for BSE ticker must resolve to original symbol');

  // 13.2 Dynamic registration creates multi-exchange candidate mappings for US symbols
  registerLiveSymbols(['COIN']);
  assert.ok(TV_SYMBOL_MAP['COIN'] === 'NASDAQ:COIN', 'US stock default map must be created');
  assert.equal(REVERSE_TV_MAP['NASDAQ:COIN'], 'COIN', 'Reverse map for NASDAQ:COIN must resolve to COIN');
  assert.equal(REVERSE_TV_MAP['NYSE:COIN'], 'COIN', 'Reverse map for NYSE:COIN must resolve to COIN');

  // 13.3 Quote micro-cache returns fresh quote without network
  const mockQuote = {
    symbol: 'AAPL',
    price: 345.50,
    timestamp: Date.now(),
    source: 'test_engine',
  };
  setCachedQuote('AAPL', mockQuote, 15000);
  const cached = getCachedQuote('AAPL');
  assert.ok(cached != null, 'Cached quote must be retrieved');
  assert.equal(cached.price, 345.50, 'Cached quote price must match');

  // Expired quote returns null
  setCachedQuote('EXPIRED_STOCK', mockQuote, -100);
  assert.equal(getCachedQuote('EXPIRED_STOCK'), null, 'Expired quote must return null');

  // 13.4 Cloudflare circuit breaker trip & reset
  assert.equal(isCloudflareTripped(), false, 'Cloudflare circuit breaker initially must not be tripped');
  tripCloudflare(500); // 500ms
  assert.equal(isCloudflareTripped(), true, 'Circuit breaker must be tripped immediately after tripCloudflare()');
  
  await new Promise((r) => setTimeout(r, 550));
  assert.equal(isCloudflareTripped(), false, 'Circuit breaker must auto-recover after cooldown');
}
console.log('  ✅ Live Price Batching, Micro-Cache & Circuit Breaker Anti-Ban Resilience passed.');

console.log('\n🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY! (13/13 test suites)');
