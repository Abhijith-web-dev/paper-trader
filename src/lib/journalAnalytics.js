/**
 * Institutional Trade Journal Analytics & Execution Accounting Engine
 * Pure mathematical functions for closed trades, open positions, fee modeling,
 * statistical metrics, and disciplined trade plan evaluations.
 */

/**
 * Calculates estimated statutory charges and transaction costs for NSE and US equities.
 *
 * Statutory components:
 * - NSE: Securities Transaction Tax (STT 0.1%), Exchange Turnover Charges (0.00345%),
 *        SEBI Turnover Fees (0.0001%), Stamp Duty (0.015% on BUY), and GST (18% on exchange+SEBI).
 * - US:  SEC Section 31 Transaction Fee ($0.0000278 on SELL), FINRA Trading Activity Fee ($0.000166/share).
 *
 * @param {string} market - 'IN' | 'NSE' | 'US'
 * @param {string} side - 'BUY' | 'SELL'
 * @param {number} tradeValue - Total traded value (price * quantity)
 * @param {number} qty - Number of shares
 * @returns {object} Detailed charges breakdown
 */
export function calculateEstimatedCharges(market, side = 'BUY', tradeValue = 0, qty = 1) {
  const val = Math.max(0, Number(tradeValue) || 0);
  const q = Math.max(1, Number(qty) || 1);
  const isIndia = market === 'IN' || market === 'NSE';
  const isSell = side === 'SELL';

  if (isIndia) {
    // STT: 0.1% on delivery (both buy and sell for equity delivery)
    const stt = Number((val * 0.001).toFixed(2));
    // Exchange Turnover Fee: 0.00345%
    const exchangeTurnover = Number((val * 0.0000345).toFixed(2));
    // SEBI Charges: 0.0001%
    const sebi = Number((val * 0.000001).toFixed(2));
    // Stamp Duty: 0.015% on BUY side only for delivery
    const stampDuty = !isSell ? Number((val * 0.00015).toFixed(2)) : 0;
    // GST: 18% on (Exchange turnover + SEBI)
    const gst = Number(((exchangeTurnover + sebi) * 0.18).toFixed(2));

    const total = Number((stt + exchangeTurnover + sebi + stampDuty + gst).toFixed(2));

    return {
      currency: 'INR',
      currencySymbol: '₹',
      stt,
      exchangeTurnover,
      sebi,
      stampDuty,
      gst,
      total,
      isEstimate: true,
      description: 'Estimated NSE delivery turnover charges, STT, SEBI, and GST (tracked for statistical fidelity)',
    };
  } else {
    // SEC Section 31 Fee: applies to SELL orders ($0.0000278 * value)
    const secFee = isSell ? Number((val * 0.0000278).toFixed(2)) : 0;
    // FINRA TAF: $0.000166 per share (capped at $8.30 per trade)
    const finraFee = isSell ? Number(Math.min(8.30, q * 0.000166).toFixed(2)) : 0;
    // Minimum nominal floor for micro-transactions
    const total = Number(Math.max(val > 0 && isSell ? 0.01 : 0, secFee + finraFee).toFixed(2));

    return {
      currency: 'USD',
      currencySymbol: '$',
      secFee,
      finraFee,
      total,
      isEstimate: true,
      description: 'Estimated SEC Section 31 and FINRA Trading Activity Fees (tracked for statistical fidelity)',
    };
  }
}

/**
 * Computes exact Realized P&L and net return for a closed long trade or partial exit.
 *
 * Formula:
 * grossPnL = (exitFill - matchedEntryCost) * closedQuantity
 * netPnL = grossPnL - allocatedEntryCosts - exitCosts
 * returnPercent = ((exitFill - matchedEntryCost) / matchedEntryCost) * 100
 */
export function computeRealizedTradeAccounting({
  entryPrice = 0,
  exitPrice = 0,
  quantity = 1,
  market = 'IN',
}) {
  const entry = Math.max(0, Number(entryPrice) || 0);
  const exit = Math.max(0, Number(exitPrice) || 0);
  const qty = Math.max(1, Number(quantity) || 1);

  const entryTurnover = entry * qty;
  const exitTurnover = exit * qty;

  const entryCharges = calculateEstimatedCharges(market, 'BUY', entryTurnover, qty);
  const exitCharges = calculateEstimatedCharges(market, 'SELL', exitTurnover, qty);
  const totalCharges = Number((entryCharges.total + exitCharges.total).toFixed(2));

  const grossPnL = Number(((exit - entry) * qty).toFixed(2));
  const netPnL = Number((grossPnL - totalCharges).toFixed(2));
  const returnPercent = entry > 0 ? Number((((exit - entry) / entry) * 100).toFixed(2)) : 0;

  return {
    entryPrice: entry,
    exitPrice: exit,
    quantity: qty,
    grossPnL,
    totalCharges,
    entryCharges: entryCharges.total,
    exitCharges: exitCharges.total,
    netPnL,
    returnPercent,
    isWin: netPnL > 0,
    isLoss: netPnL < 0,
    isBreakEven: netPnL === 0,
  };
}

/**
 * Computes Floating / Unrealized P&L for an active open position.
 *
 * Formula:
 * floatingGrossPnL = (latestValidMark - avgCostBasis) * remainingQuantity
 * floatingNetPnL = floatingGrossPnL - allocatedEntryCosts
 */
export function computeFloatingPositionAccounting({
  avgBuyPrice = 0,
  livePrice = 0,
  quantity = 1,
  market = 'IN',
  quoteTimestamp = null,
  isFresh = true,
}) {
  const costBasisPrice = Math.max(0, Number(avgBuyPrice) || 0);
  const mark = Math.max(0, Number(livePrice) || costBasisPrice);
  const qty = Math.max(1, Number(quantity) || 1);

  const totalCost = Number((costBasisPrice * qty).toFixed(2));
  const currentMarketValue = Number((mark * qty).toFixed(2));
  const entryCharges = calculateEstimatedCharges(market, 'BUY', totalCost, qty).total;

  const floatingGrossPnL = Number((currentMarketValue - totalCost).toFixed(2));
  const floatingNetPnL = Number((floatingGrossPnL - entryCharges).toFixed(2));
  const grossReturnPercent = totalCost > 0 ? Number((((mark - costBasisPrice) / costBasisPrice) * 100).toFixed(2)) : 0;
  const netReturnPercent = totalCost > 0 ? Number(((floatingNetPnL / totalCost) * 100).toFixed(2)) : 0;

  return {
    avgBuyPrice: costBasisPrice,
    livePrice: mark,
    quantity: qty,
    totalCost,
    currentMarketValue,
    allocatedEntryCharges: entryCharges,
    floatingGrossPnL,
    floatingNetPnL,
    grossReturnPercent,
    netReturnPercent,
    returnPercent: grossReturnPercent,
    isProfitable: floatingNetPnL >= 0,
    quoteTimestamp: quoteTimestamp || Date.now(),
    isFresh,
  };
}

/**
 * Aggregates complete Journal Performance Metrics with strict sample validations.
 * Guarantees 'N/A' states for undefined ratios, separates INR and USD, and strictly
 * isolates user-authored plan adherence from default system logs.
 *
 * @param {Array} rawEntries - List of journal/ledger entries
 * @returns {object} Comprehensive statistical diagnostics
 */
export function calculateJournalMetrics(rawEntries = []) {
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return createEmptyMetricsState();
  }

  // 1. Isolate Closed Trades (completed exits) vs Open Execution Records
  const closedTrades = [];
  const openPositions = [];
  const userReviewedTrades = [];

  rawEntries.forEach((entry) => {
    const isClosed = entry.action === 'SELL' || (Number(entry.exitPrice) > 0 && entry.action !== 'BUY');
    const isSystemGenerated = Boolean(entry.isSystemGenerated);
    const hasUserReview = Boolean(entry.hasUserReview || (!isSystemGenerated && entry.notes && entry.notes.trim().length > 0));

    if (isClosed) {
      closedTrades.push(entry);
    } else if (entry.action === 'BUY') {
      openPositions.push(entry);
    }

    // Only count as reviewed if a user has explicitly authored or confirmed the plan review
    if (hasUserReview && entry.emotion && entry.emotion !== 'NONE' && entry.emotion !== '') {
      userReviewedTrades.push(entry);
    }
  });

  const closedCount = closedTrades.length;

  // 2. Win / Loss / Breakeven counts on closed trades (Using true net P&L)
  const winningTrades = closedTrades.filter((t) => (t.netPnl !== undefined ? t.netPnl > 0 : (t.pnl || 0) > 0));
  const losingTrades = closedTrades.filter((t) => (t.netPnl !== undefined ? t.netPnl < 0 : (t.pnl || 0) < 0));
  const breakEvenTrades = closedTrades.filter((t) => (t.netPnl !== undefined ? t.netPnl === 0 : (t.pnl || 0) === 0));

  // 3. Win Rate
  let winRate = {
    value: null,
    display: 'N/A',
    subtext: 'No closed trades yet',
    closedCount: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
  };

  if (closedCount > 0) {
    const rateVal = Number(((winningTrades.length / closedCount) * 100).toFixed(1));
    winRate = {
      value: rateVal,
      display: `${rateVal}%`,
      subtext: `${winningTrades.length} Wins • ${losingTrades.length} Losses${breakEvenTrades.length > 0 ? ` • ${breakEvenTrades.length} BE` : ''}`,
      closedCount,
      wins: winningTrades.length,
      losses: losingTrades.length,
      breakeven: breakEvenTrades.length,
    };
  }

  // 4. Gains and Losses totals
  const totalNetGains = winningTrades.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : t.pnl || 0), 0);
  const totalNetLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : t.pnl || 0), 0));

  // 5. Profit Factor
  let profitFactor = {
    value: null,
    display: 'N/A',
    subtext: 'Requires closed trades',
  };

  if (closedCount === 0) {
    profitFactor = { value: null, display: 'N/A', subtext: 'No closed trades' };
  } else if (totalNetLosses === 0 && totalNetGains > 0) {
    profitFactor = { value: Infinity, display: 'N/A (100% Win Run)', subtext: '0 Closed Losses' };
  } else if (totalNetLosses === 0 && totalNetGains === 0) {
    profitFactor = { value: null, display: 'N/A', subtext: '0.00 Net P&L' };
  } else if (totalNetLosses > 0) {
    const pfVal = Number((totalNetGains / totalNetLosses).toFixed(2));
    profitFactor = {
      value: pfVal,
      display: pfVal.toFixed(2),
      subtext: `₹/$${totalNetGains.toFixed(0)} Gains / ₹/$${totalNetLosses.toFixed(0)} Losses`,
    };
  }

  // 6. Average Win & Average Loss
  let avgWin = { value: null, display: 'N/A' };
  if (winningTrades.length > 0) {
    const val = Number((totalNetGains / winningTrades.length).toFixed(2));
    avgWin = { value: val, display: val.toFixed(2) };
  }

  let avgLoss = { value: null, display: 'N/A' };
  if (losingTrades.length > 0) {
    const val = Number((totalNetLosses / losingTrades.length).toFixed(2));
    avgLoss = { value: val, display: val.toFixed(2) };
  }

  // 7. Payoff Ratio (Average Win / Average Loss)
  let payoffRatio = {
    value: null,
    display: 'N/A',
    subtext: 'Requires both wins & losses',
  };

  if (avgWin.value !== null && avgLoss.value !== null && avgLoss.value > 0) {
    const ratio = Number((avgWin.value / avgLoss.value).toFixed(2));
    payoffRatio = {
      value: ratio,
      display: `1:${ratio}`,
      subtext: `Avg Win: ${avgWin.display} / Avg Loss: ${avgLoss.display}`,
    };
  } else if (avgWin.value !== null && avgLoss.value === null) {
    payoffRatio = { value: null, display: 'N/A', subtext: 'No losing trades to calculate ratio' };
  } else if (avgWin.value === null && avgLoss.value !== null) {
    payoffRatio = { value: null, display: 'N/A', subtext: 'No winning trades to calculate ratio' };
  }

  // 8. Discipline Score: Evaluated ONLY on user-authored reviews with explicit checklist or plan confirmation
  let disciplineScore = {
    value: null,
    display: 'N/A',
    subtext: 'No plan reviews logged yet',
    reviewedCount: 0,
    adherentCount: 0,
  };

  if (userReviewedTrades.length > 0) {
    const adherentTrades = userReviewedTrades.filter((t) => {
      // True plan adherence checklist or explicit disciplined tag
      if (t.planFollowed === true) return true;
      const emo = String(t.emotion || '').toLowerCase();
      const tags = (Array.isArray(t.tags) ? t.tags : []).map((x) => String(x).toLowerCase());
      return emo.includes('disciplined') || emo.includes('followed') || tags.includes('disciplined') || tags.includes('plan followed');
    });

    const score = Math.round((adherentTrades.length / userReviewedTrades.length) * 100);
    disciplineScore = {
      value: score,
      display: `${score}%`,
      subtext: `${adherentTrades.length} of ${userReviewedTrades.length} reviews adhered to plan`,
      reviewedCount: userReviewedTrades.length,
      adherentCount: adherentTrades.length,
    };
  }

  // 9. Multi-Currency Separation (Strict INR and USD aggregation)
  const inrClosed = closedTrades.filter((t) => t.currency === 'INR' || t.market === 'IN' || t.market === 'NSE');
  const usdClosed = closedTrades.filter((t) => t.currency === 'USD' || t.market === 'US');

  const inrRealizedGross = inrClosed.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const inrRealizedNet = inrClosed.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : t.pnl || 0), 0);
  const inrTotalCharges = inrClosed.reduce((sum, t) => sum + (t.fees || 0), 0);

  const usdRealizedGross = usdClosed.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const usdRealizedNet = usdClosed.reduce((sum, t) => sum + (t.netPnl !== undefined ? t.netPnl : t.pnl || 0), 0);
  const usdTotalCharges = usdClosed.reduce((sum, t) => sum + (t.fees || 0), 0);

  // 10. Quantitative Insights
  const insights = [];
  if (closedCount === 0) {
    insights.push('No closed trades in journal. Log a trade exit or close a paper position to generate statistical edge analysis.');
  } else {
    if (winRate.value >= 50 && payoffRatio.value >= 1.5) {
      insights.push(`Strong Edge: High win rate (${winRate.display}) coupled with asymmetric payoff (1:${payoffRatio.value}).`);
    } else if (winRate.value < 40 && (payoffRatio.value === null || payoffRatio.value < 2.0)) {
      insights.push('Edge Degradation Warning: Low win rate without high payoff ratio. Review trade entries and risk stops.');
    }
    if (disciplineScore.value !== null && disciplineScore.value < 70) {
      insights.push(`Discipline Alert: Plan adherence is ${disciplineScore.display}. Avoid emotional or premature trade exits.`);
    }
  }

  return {
    closedCount,
    openCount: openPositions.length,
    userReviewedCount: userReviewedTrades.length,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    payoffRatio,
    disciplineScore,
    inr: {
      closedCount: inrClosed.length,
      realizedGross: Number(inrRealizedGross.toFixed(2)),
      realizedNet: Number(inrRealizedNet.toFixed(2)),
      totalCharges: Number(inrTotalCharges.toFixed(2)),
    },
    usd: {
      closedCount: usdClosed.length,
      realizedGross: Number(usdRealizedGross.toFixed(2)),
      realizedNet: Number(usdRealizedNet.toFixed(2)),
      totalCharges: Number(usdTotalCharges.toFixed(2)),
    },
    insights,
  };
}

/**
 * Returns default empty state for zero records with explicit 'N/A' diagnostics
 */
export function createEmptyMetricsState() {
  return {
    closedCount: 0,
    openCount: 0,
    userReviewedCount: 0,
    winRate: { value: null, display: 'N/A', subtext: 'No closed trades yet', closedCount: 0, wins: 0, losses: 0, breakeven: 0 },
    profitFactor: { value: null, display: 'N/A', subtext: 'No closed trades' },
    avgWin: { value: null, display: 'N/A' },
    avgLoss: { value: null, display: 'N/A' },
    payoffRatio: { value: null, display: 'N/A', subtext: 'Requires closed trades' },
    disciplineScore: { value: null, display: 'N/A', subtext: 'No plan reviews logged yet', reviewedCount: 0, adherentCount: 0 },
    inr: { closedCount: 0, realizedGross: 0, realizedNet: 0, totalCharges: 0 },
    usd: { closedCount: 0, realizedGross: 0, realizedNet: 0, totalCharges: 0 },
    insights: ['Log your first completed trade exit to unlock quantitative post-mortem analytics.'],
  };
}
