/**
 * Automated Regression Test Suite for Trade Journal & Ledger Accounting
 * Tests:
 * 1. Statutory fee models (NSE STT/Turnover/GST vs US SEC/FINRA)
 * 2. Realized exit P&L vs Floating open position P&L
 * 3. Zero-sample & Buy-only handling (N/A diagnostics, zero division protection)
 * 4. Win rate, Profit factor, Payoff ratio, and Discipline score validation
 * 5. Multi-currency separation (Strict INR vs USD reporting)
 */

import assert from 'node:assert/strict';
import {
  calculateEstimatedCharges,
  computeRealizedTradeAccounting,
  computeFloatingPositionAccounting,
  calculateJournalMetrics,
  createEmptyMetricsState,
} from '../src/lib/journalAnalytics.js';

console.log('🧪 Starting Journal Analytics & Accounting Regression Test Suite...');

// =========================================================================
// TEST 1: Estimated Statutory Charges (NSE & US)
// =========================================================================
console.log('  Testing Statutory Charges Calculation...');
{
  // 1.1 NSE Buy Delivery (₹100,000 value, 100 shares @ ₹1,000)
  const nseBuy = calculateEstimatedCharges('NSE', 'BUY', 100000, 100);
  assert.equal(nseBuy.currency, 'INR');
  assert.equal(nseBuy.stt, 100.00, 'STT should be 0.1% = ₹100');
  assert.equal(nseBuy.exchangeTurnover, 3.45, 'Exchange turnover should be 0.00345% = ₹3.45');
  assert.equal(nseBuy.sebi, 0.10, 'SEBI charge should be 0.0001% = ₹0.10');
  assert.equal(nseBuy.stampDuty, 15.00, 'Stamp duty on BUY should be 0.015% = ₹15.00');
  assert.ok(nseBuy.gst > 0, 'GST should be positive');
  assert.ok(nseBuy.total > 118, 'Total estimated charges should be sum of all components');

  // 1.2 NSE Sell Delivery (no stamp duty on sell)
  const nseSell = calculateEstimatedCharges('NSE', 'SELL', 100000, 100);
  assert.equal(nseSell.stampDuty, 0, 'Stamp duty should not be levied on SELL delivery');

  // 1.3 US Equity Sell ($10,000 value, 50 shares @ $200)
  const usSell = calculateEstimatedCharges('US', 'SELL', 10000, 50);
  assert.equal(usSell.currency, 'USD');
  assert.ok(usSell.secFee >= 0.27, 'SEC Section 31 fee should be calculated on SELL');
  assert.ok(usSell.finraFee > 0, 'FINRA TAF fee should be calculated per share');
  assert.ok(usSell.total >= 0.28, 'US Sell total charges calculated');

  // 1.4 US Equity Buy (no SEC/FINRA charges on buy)
  const usBuy = calculateEstimatedCharges('US', 'BUY', 10000, 50);
  assert.equal(usBuy.secFee, 0);
  assert.equal(usBuy.finraFee, 0);
}
console.log('  ✅ Statutory charges calculation passed.');

// =========================================================================
// TEST 2: Realized Long Trade Accounting (Gross vs Net Return)
// =========================================================================
console.log('  Testing Realized Trade Accounting...');
{
  // User bought 10 shares of RELIANCE at ₹1,150, sold at ₹1,202
  const entryPrice = 1150;
  const exitPrice = 1202;
  const qty = 10;

  const result = computeRealizedTradeAccounting({
    entryPrice,
    exitPrice,
    quantity: qty,
    market: 'NSE',
  });

  // Gross P&L: (1202 - 1150) * 10 = +₹520.00
  assert.equal(result.grossPnL, 520.00);
  assert.ok(result.totalCharges > 0, 'Allocated charges must be deducted from net');
  // Net P&L: 520 - totalCharges
  assert.equal(result.netPnL, Number((520 - result.totalCharges).toFixed(2)));
  assert.equal(result.returnPercent, 4.52);
  assert.equal(result.isWin, true);
  assert.equal(result.isLoss, false);
}
console.log('  ✅ Realized trade accounting passed.');

// =========================================================================
// TEST 3: Floating / Unrealized Position Accounting (Gross vs Net Separation)
// =========================================================================
console.log('  Testing Floating Position Accounting...');
{
  // 3.1 US Holding Test
  const holding = computeFloatingPositionAccounting({
    avgBuyPrice: 200,
    livePrice: 210,
    quantity: 50,
    market: 'US',
    quoteTimestamp: Date.now(),
  });

  assert.equal(holding.totalCost, 10000);
  assert.equal(holding.currentMarketValue, 10500);
  assert.equal(holding.floatingGrossPnL, 500);
  assert.equal(holding.grossReturnPercent, 5.00);
  assert.ok(holding.netReturnPercent <= 5.00, 'Net return percent must be <= gross return');
  assert.equal(holding.isProfitable, true);

  // 3.2 Goldstar Power Case (Exact user reported scenario: 10 shares @ 9.15, marked @ 9.30)
  const goldstar = computeFloatingPositionAccounting({
    avgBuyPrice: 9.15,
    livePrice: 9.30,
    quantity: 10,
    market: 'IN',
    quoteTimestamp: Date.now(),
  });

  assert.equal(goldstar.totalCost, 91.50);
  assert.equal(goldstar.currentMarketValue, 93.00);
  // Gross P&L: (9.30 - 9.15) * 10 = +₹1.50
  assert.equal(goldstar.floatingGrossPnL, 1.50);
  // Gross return: (1.50 / 91.50) * 100 = 1.64%
  assert.equal(goldstar.grossReturnPercent, 1.64);
  // Entry charges allocated: ~0.10
  assert.ok(goldstar.allocatedEntryCharges > 0);
  // Net P&L: 1.50 - 0.10 = 1.40
  assert.equal(goldstar.floatingNetPnL, 1.40);
  // Net return: (1.40 / 91.50) * 100 = 1.53%
  assert.equal(goldstar.netReturnPercent, 1.53);
  assert.notEqual(goldstar.grossReturnPercent, goldstar.netReturnPercent, 'Gross and net percentage must not be mixed');
}
console.log('  ✅ Floating position accounting passed.');

// =========================================================================
// TEST 4: Empty & Buy-Only Sample States (The Exact Bug Reported by User)
// =========================================================================
console.log('  Testing Empty & Buy-Only Metrics Diagnostics...');
{
  // 4.1 Completely empty journal
  const empty = calculateJournalMetrics([]);
  assert.equal(empty.closedCount, 0);
  assert.equal(empty.winRate.display, 'N/A');
  assert.equal(empty.profitFactor.display, 'N/A');
  assert.equal(empty.avgWin.display, 'N/A');
  assert.equal(empty.avgLoss.display, 'N/A');
  assert.equal(empty.payoffRatio.display, 'N/A');
  assert.equal(empty.disciplineScore.display, 'N/A');

  // 4.2 Five open BUY orders with no exit fill (User's exact scenario)
  const fiveBuys = [
    { id: '1', action: 'BUY', symbol: 'RELIANCE.NS', currency: 'INR', qty: 10, entryPrice: 1200, isSystemGenerated: true, emotion: 'Disciplined' },
    { id: '2', action: 'BUY', symbol: 'TCS.NS', currency: 'INR', qty: 5, entryPrice: 3500, isSystemGenerated: true, emotion: 'Disciplined' },
    { id: '3', action: 'BUY', symbol: 'AAPL', currency: 'USD', qty: 15, entryPrice: 220, isSystemGenerated: true, emotion: 'Disciplined' },
    { id: '4', action: 'BUY', symbol: 'NVDA', currency: 'USD', qty: 20, entryPrice: 130, isSystemGenerated: true, emotion: 'Disciplined' },
    { id: '5', action: 'BUY', symbol: 'INFY.NS', currency: 'INR', qty: 25, entryPrice: 1800, isSystemGenerated: true, emotion: 'Disciplined' },
  ];

  const metrics = calculateJournalMetrics(fiveBuys);

  // Closed trades count MUST be 0!
  assert.equal(metrics.closedCount, 0, 'Open buy orders must NOT be counted as closed trades');
  assert.equal(metrics.openCount, 5, 'All five entries must be classified as open positions');

  // Metrics MUST show N/A and not 0% or 0 or 1:0!
  assert.equal(metrics.winRate.display, 'N/A', 'Win rate must be N/A when 0 closed trades');
  assert.equal(metrics.profitFactor.display, 'N/A', 'Profit factor must be N/A when 0 closed trades');
  assert.equal(metrics.avgWin.display, 'N/A', 'Avg win must be N/A');
  assert.equal(metrics.avgLoss.display, 'N/A', 'Avg loss must be N/A');
  assert.equal(metrics.payoffRatio.display, 'N/A', 'Payoff ratio must be N/A');

  // Discipline score must NOT be 100% just because auto-generated BUY records had a default tag!
  assert.equal(metrics.disciplineScore.display, 'N/A', 'Discipline score must be N/A until user explicitly reviews plan');
}
console.log('  ✅ Empty & Buy-only metrics diagnostics passed.');

// =========================================================================
// TEST 5: Closed Trades with User Reviews & Edge Cases
// =========================================================================
console.log('  Testing Closed Trade Metrics & User Reviews...');
{
  const tradeHistory = [
    // Win in INR
    {
      id: 'T1',
      action: 'SELL',
      symbol: 'RELIANCE.NS',
      currency: 'INR',
      market: 'IN',
      qty: 10,
      entryPrice: 1150,
      exitPrice: 1202,
      pnl: 520,
      netPnl: 495.50,
      fees: 24.50,
      hasUserReview: true,
      planFollowed: true,
      emotion: 'Disciplined',
      notes: 'Executed clean breakout exit at predetermined R2 resistance.',
    },
    // Loss in INR
    {
      id: 'T2',
      action: 'SELL',
      symbol: 'TATASTEEL.NS',
      currency: 'INR',
      market: 'IN',
      qty: 100,
      entryPrice: 150,
      exitPrice: 145,
      pnl: -500,
      netPnl: -515.20,
      fees: 15.20,
      hasUserReview: true,
      planFollowed: true,
      emotion: 'Disciplined',
      notes: 'Hit stop loss cleanly, preserved capital.',
    },
    // Win in USD
    {
      id: 'T3',
      action: 'SELL',
      symbol: 'NVDA',
      currency: 'USD',
      market: 'US',
      qty: 10,
      entryPrice: 120,
      exitPrice: 135,
      pnl: 150,
      netPnl: 148.50,
      fees: 1.50,
      hasUserReview: true,
      planFollowed: false,
      emotion: 'FOMO / Chased',
      notes: 'Exited early before target.',
    },
  ];

  const m = calculateJournalMetrics(tradeHistory);

  assert.equal(m.closedCount, 3);
  // Win rate: 2 wins / 3 trades = 66.7%
  assert.equal(m.winRate.display, '66.7%');
  assert.equal(m.winRate.wins, 2);
  assert.equal(m.winRate.losses, 1);

  // Profit factor: (495.50 + 148.50) / 515.20 = 644 / 515.20 = 1.25
  assert.equal(m.profitFactor.display, '1.25');

  // Discipline score: 2 out of 3 adhered to plan = 67%
  assert.equal(m.disciplineScore.display, '67%');

  // Separated INR vs USD
  assert.equal(m.inr.closedCount, 2);
  assert.equal(m.inr.realizedNet, Number((495.50 - 515.20).toFixed(2))); // -19.70
  assert.equal(m.usd.closedCount, 1);
  assert.equal(m.usd.realizedNet, 148.50);
}
console.log('  ✅ Closed trade metrics & user reviews passed.');

console.log('\n🎉 ALL JOURNAL ANALYTICS TESTS PASSED SUCCESSFULLY! (5/5 suites)');
