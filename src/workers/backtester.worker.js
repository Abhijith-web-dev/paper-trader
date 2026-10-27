/**
 * High-Speed Quantitative Strategy Backtesting Web Worker
 * Runs off the main UI thread with sub-millisecond vector math.
 * Analyzes growth & loss patterns, drawdowns, risk-reward ratios, and candle patterns.
 */

self.onmessage = function (e) {
  const { 
    strategy = {}, 
    candles = [], 
    initialCapital = 100000, 
    positionSizePercent = 50, 
    slippagePercent = 0.05, 
    feePerTrade = 10 
  } = e.data;

  // Defensively unwrap if candles is passed directly or inside a container { candles: [...] }
  const candleList = Array.isArray(candles) ? candles : (candles?.candles || []);

  if (!candleList || candleList.length < 25) {
    self.postMessage({ error: `Need at least 25 candles to execute backtesting (received ${candleList?.length || 0}).` });
    return;
  }

  try {
    const results = runBacktestSimulation({
      strategy,
      candles: candleList,
      initialCapital,
      positionSizePercent,
      slippagePercent,
      feePerTrade,
    });
    self.postMessage({ success: true, results });
  } catch (err) {
    self.postMessage({ error: err.message || 'Backtest simulation error' });
  }
};

function runBacktestSimulation({ 
  strategy, 
  candles, 
  initialCapital, 
  positionSizePercent, 
  slippagePercent, 
  feePerTrade 
}) {
  let capital = initialCapital;
  let peakCapital = initialCapital;
  let maxDrawdown = 0;
  let position = null; // { type: 'LONG', entryPrice, qty, entryTime, entryIndex, reason, pattern, highSeen, lowSeen }
  const trades = [];
  const initialTime = candles[0]?.time ?? 'Start';
  const equityCurve = [{ time: initialTime, value: initialCapital, growthPct: 0, drawdownPct: 0 }];

  // Technical Indicator Vector Pre-Computations
  const closes = candles.map(c => c.close);
  const fastEMAs = calcEMAValues(closes, strategy.fastPeriod || 9);
  const slowEMAs = calcEMAValues(closes, strategy.slowPeriod || 21);
  const baselineEMAs = calcEMAValues(closes, 50);
  const rsiValues = calcRSIValues(closes, 14);
  const bbValues = calcBollingerValues(closes, 20, 2);
  const macdValues = calcMACDValues(closes, 12, 26, 9);

  // Pattern Performance Tracking Map: Pattern -> { count, wins, losses, totalPnl }
  const patternStats = {};

  const startIdx = Math.min(25, Math.floor(candles.length / 4));

  for (let i = startIdx; i < candles.length; i++) {
    const bar = candles[i];
    const prevBar = candles[i - 1];
    const prev2Bar = candles[i - 2] || prevBar;
    const currentPrice = bar.close;

    // Detect Candlestick Action Pattern for this bar
    const patternFound = detectBarPattern(bar, prevBar, prev2Bar, candles, i);

    // 1. Manage Active Open Position (Check Stops, Targets, Trailing, & Exits)
    if (position) {
      if (bar.high > position.highSeen) position.highSeen = bar.high;
      if (bar.low < position.lowSeen) position.lowSeen = bar.low;

      let exitReason = null;
      let exitPrice = currentPrice;
      const pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      // Stop-loss trigger
      if (strategy.stopLossPercent && pnlPct <= -strategy.stopLossPercent) {
        exitReason = `Stop-Loss Protected (-${strategy.stopLossPercent}%)`;
        exitPrice = position.entryPrice * (1 - strategy.stopLossPercent / 100);
      }
      // Take-profit target trigger
      else if (strategy.takeProfitPercent && pnlPct >= strategy.takeProfitPercent) {
        exitReason = `Target Reached (+${strategy.takeProfitPercent}%)`;
        exitPrice = position.entryPrice * (1 + strategy.takeProfitPercent / 100);
      }
      // Technical Rule Exit Conditions
      else if (strategy.indicator === 'EMA_CROSSOVER') {
        if (fastEMAs[i - 1] >= slowEMAs[i - 1] && fastEMAs[i] < slowEMAs[i]) {
          exitReason = 'EMA Bearish Cross (9 < 21)';
        }
      } else if (strategy.indicator === 'RSI') {
        if (rsiValues[i] >= (strategy.overboughtThreshold || 70)) {
          exitReason = `RSI Overbought (${rsiValues[i].toFixed(1)})`;
        }
      } else if (strategy.indicator === 'BOLLINGER') {
        if (currentPrice < bbValues.middle[i]) {
          exitReason = 'Reversion Below 20 SMA Basis';
        }
      } else if (strategy.indicator === 'MACD_MOMENTUM') {
        if (macdValues.histogram[i] < 0 && macdValues.histogram[i - 1] >= 0) {
          exitReason = 'MACD Histogram Bearish Turnover';
        }
      } else if (strategy.indicator === 'PATTERN_RECOGNITION') {
        if (patternFound && patternFound.type === 'BEARISH') {
          exitReason = `Bearish Pattern Reversal: ${patternFound.name}`;
        }
      } else if (strategy.indicator === 'QUANT_CONFLUENCE') {
        if (rsiValues[i] >= 72 || (fastEMAs[i] < slowEMAs[i] && macdValues.histogram[i] < 0)) {
          exitReason = 'Multi-Factor Confluence Exit (RSI Extended / Trend Turnover)';
        }
      }

      // Final Candle forced close
      if (!exitReason && i === candles.length - 1) {
        exitReason = 'End of Historical Replay Period';
      }

      if (exitReason) {
        const effectiveExitPrice = exitPrice * (1 - slippagePercent / 100);
        const grossPnl = (effectiveExitPrice - position.entryPrice) * position.qty;
        const netPnl = grossPnl - feePerTrade;
        const netPnlPct = (netPnl / (position.entryPrice * position.qty)) * 100;

        capital += (position.qty * effectiveExitPrice) - feePerTrade;

        const tradeObj = {
          tradeNo: trades.length + 1,
          type: 'LONG',
          pattern: position.pattern || 'Standard Rule',
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: Number(position.entryPrice.toFixed(2)),
          exitPrice: Number(effectiveExitPrice.toFixed(2)),
          qty: position.qty,
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(netPnlPct.toFixed(2)),
          reason: exitReason,
          durationBars: i - position.entryIndex,
          maxRunUpPct: Number((((position.highSeen - position.entryPrice) / position.entryPrice) * 100).toFixed(2)),
          maxDrawdownPct: Number((((position.lowSeen - position.entryPrice) / position.entryPrice) * 100).toFixed(2)),
        };

        trades.push(tradeObj);

        // Update pattern statistics
        const patKey = position.pattern || 'Strategy Core';
        if (!patternStats[patKey]) {
          patternStats[patKey] = { name: patKey, count: 0, wins: 0, losses: 0, totalPnl: 0, totalPnlPct: 0 };
        }
        patternStats[patKey].count++;
        if (netPnl > 0) patternStats[patKey].wins++;
        else patternStats[patKey].losses++;
        patternStats[patKey].totalPnl += netPnl;
        patternStats[patKey].totalPnlPct += netPnlPct;

        position = null;
      }
    }

    // 2. Evaluate Strategy Entry Conditions (If No Active Position)
    if (!position && i < candles.length - 1) {
      let enterLong = false;
      let entryReason = '';
      let triggerPattern = patternFound?.name || 'Algorithmic Signal';

      switch (strategy.indicator) {
        case 'EMA_CROSSOVER':
          // 9 EMA crosses above 21 EMA with optional 50 EMA trend confirmation
          if (fastEMAs[i - 1] <= slowEMAs[i - 1] && fastEMAs[i] > slowEMAs[i]) {
            enterLong = true;
            entryReason = 'Golden Cross: 9 EMA crossed above 21 EMA';
            triggerPattern = '9/21 EMA Bullish Cross';
          }
          break;

        case 'RSI':
          // RSI oversold bounce
          if (rsiValues[i - 1] <= (strategy.oversoldThreshold || 30) && rsiValues[i] > rsiValues[i - 1]) {
            enterLong = true;
            entryReason = `RSI Oversold Mean-Reversion Bounce (${rsiValues[i - 1].toFixed(1)} -> ${rsiValues[i].toFixed(1)})`;
            triggerPattern = 'RSI Mean-Reversion';
          }
          break;

        case 'BOLLINGER':
          // Price breakouts above upper band with RSI > 50
          if (currentPrice > bbValues.upper[i] && rsiValues[i] > 52) {
            enterLong = true;
            entryReason = `Volatility Expansion: Price pierced upper Bollinger Band (${bbValues.upper[i].toFixed(2)})`;
            triggerPattern = 'Bollinger Volatility Breakout';
          }
          break;

        case 'MACD_MOMENTUM':
          // MACD histogram expands upward across 0 line
          if (macdValues.histogram[i - 1] <= 0 && macdValues.histogram[i] > 0) {
            enterLong = true;
            entryReason = 'MACD Momentum Cross: Histogram shifted positive';
            triggerPattern = 'MACD Bullish Histogram';
          }
          break;

        case 'CUSTOM_BUILDER': {
          const rules = strategy.customRules || {};
          let matchRsi = true;
          if (rules.useRsi) {
            matchRsi = rsiValues[i] <= (rules.rsiThreshold || 35);
          }
          let matchEma = true;
          if (rules.useEma) {
            matchEma = fastEMAs[i] > slowEMAs[i];
          }
          let matchMacd = true;
          if (rules.useMacd) {
            matchMacd = macdValues.histogram[i] > 0;
          }
          let matchPattern = true;
          if (rules.usePattern) {
            matchPattern = Boolean(patternFound && patternFound.type === 'BULLISH');
          }

          if (matchRsi && matchEma && matchMacd && matchPattern) {
            enterLong = true;
            entryReason = `Custom Rule Confluence: ${rules.name || 'User Custom Strategy'}`;
            triggerPattern = patternFound ? patternFound.name : 'Custom Confluence';
          }
          break;
        }

        case 'PATTERN_RECOGNITION':
          // High-probability Candlestick Bullish Pattern (Hammer, Bullish Engulfing, Morning Star, 20-Bar Breakout)
          if (patternFound && patternFound.type === 'BULLISH' && patternFound.confidence >= 80) {
            enterLong = true;
            entryReason = `${patternFound.name} (${patternFound.confidence}% Confidence): ${patternFound.description}`;
            triggerPattern = patternFound.name;
          }
          break;

        case 'QUANT_CONFLUENCE':
        default:
          // Multi-factor confluence: Trend + Momentum + Oscillator
          const isGolden = fastEMAs[i] > slowEMAs[i];
          const isRsiHealthy = rsiValues[i] >= 40 && rsiValues[i] <= 65;
          const isMacdPositive = macdValues.histogram[i] > 0;
          const isCandleBull = patternFound && patternFound.type === 'BULLISH';

          if ((isGolden && isRsiHealthy && isMacdPositive) || (isCandleBull && rsiValues[i] <= 45)) {
            enterLong = true;
            entryReason = isCandleBull 
              ? `Pattern + Confluence: ${patternFound.name} with healthy RSI (${rsiValues[i].toFixed(1)})`
              : 'Triple-Indicator Confluence (9/21 EMA + MACD Histogram + RSI 40-65)';
            triggerPattern = isCandleBull ? patternFound.name : 'Triple Confluence';
          }
          break;
      }

      if (enterLong) {
        const effectiveEntryPrice = currentPrice * (1 + slippagePercent / 100);
        const allocatedCapital = capital * (positionSizePercent / 100);
        const qty = Math.floor(allocatedCapital / effectiveEntryPrice);

        if (qty > 0) {
          capital -= (qty * effectiveEntryPrice) + feePerTrade;
          position = {
            type: 'LONG',
            entryPrice: effectiveEntryPrice,
            qty,
            entryTime: bar.time,
            entryIndex: i,
            reason: entryReason,
            pattern: triggerPattern,
            highSeen: bar.high,
            lowSeen: bar.low,
          };
        }
      }
    }

    // 3. Mark-to-Market Portfolio Equity & Drawdown
    const currentEquity = capital + (position ? position.qty * currentPrice : 0);
    if (currentEquity > peakCapital) {
      peakCapital = currentEquity;
    }
    const currentDD = peakCapital > 0 ? ((peakCapital - currentEquity) / peakCapital) * 100 : 0;
    if (currentDD > maxDrawdown) {
      maxDrawdown = currentDD;
    }

    const growthPct = Number((((currentEquity - initialCapital) / initialCapital) * 100).toFixed(2));
    equityCurve.push({ 
      time: bar.time, 
      value: Number(currentEquity.toFixed(2)),
      growthPct,
      drawdownPct: Number(currentDD.toFixed(2))
    });
  }

  // 4. Detailed Growth, Loss, and Streak Analytics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const totalPnl = capital - initialCapital;
  const returnPercent = (totalPnl / initialCapital) * 100;
  const winRatePercent = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const totalGains = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99.0 : 0;

  const avgWinPnl = winningTrades.length > 0 ? totalGains / winningTrades.length : 0;
  const avgLossPnl = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  const avgWinPct = winningTrades.length > 0 ? winningTrades.reduce((a, t) => a + t.pnlPercent, 0) / winningTrades.length : 0;
  const avgLossPct = losingTrades.length > 0 ? losingTrades.reduce((a, t) => a + t.pnlPercent, 0) / losingTrades.length : 0;
  const winLossRatio = avgLossPnl > 0 ? avgWinPnl / avgLossPnl : avgWinPnl > 0 ? 10.0 : 0;

  // Compute Consecutive Win/Loss Streaks
  let currentStreak = 0;
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let runningWins = 0;
  let runningLosses = 0;

  trades.forEach(t => {
    if (t.pnl > 0) {
      runningWins++;
      runningLosses = 0;
      if (runningWins > maxConsecWins) maxConsecWins = runningWins;
    } else {
      runningLosses++;
      runningWins = 0;
      if (runningLosses > maxConsecLosses) maxConsecLosses = runningLosses;
    }
  });

  // Calculate Sharpe Ratio Proxy
  const returnsArray = trades.map(t => t.pnlPercent);
  let sharpeRatio = 0;
  if (returnsArray.length > 1) {
    const mean = returnsArray.reduce((a, b) => a + b, 0) / returnsArray.length;
    const variance = returnsArray.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returnsArray.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      sharpeRatio = Number(((mean / stdDev) * Math.sqrt(252)).toFixed(2));
    }
  }

  // Format Pattern Stats List
  const patternBreakdown = Object.values(patternStats).map(p => ({
    ...p,
    winRate: p.count > 0 ? Number(((p.wins / p.count) * 100).toFixed(1)) : 0,
    totalPnl: Number(p.totalPnl.toFixed(2)),
    avgPnlPct: p.count > 0 ? Number((p.totalPnlPct / p.count).toFixed(2)) : 0,
  })).sort((a, b) => b.totalPnl - a.totalPnl);

  // Calculate 70/30 In-Sample vs Out-of-Sample Split Analysis for Overfitting Detection
  const splitIndex = Math.floor(candles.length * 0.70);
  const inSampleTrades = trades.filter(t => t.entryIndex <= splitIndex);
  const outOfSampleTrades = trades.filter(t => t.entryIndex > splitIndex);
  
  const inSampleWins = inSampleTrades.filter(t => t.pnl > 0);
  const outSampleWins = outOfSampleTrades.filter(t => t.pnl > 0);
  
  const inSamplePnl = inSampleTrades.reduce((acc, t) => acc + t.pnl, 0);
  const outSamplePnl = outOfSampleTrades.reduce((acc, t) => acc + t.pnl, 0);

  const splitAnalysis = {
    splitIndex,
    splitDate: candles[splitIndex]?.time,
    inSample: {
      tradeCount: inSampleTrades.length,
      winRate: inSampleTrades.length > 0 ? Number(((inSampleWins.length / inSampleTrades.length) * 100).toFixed(1)) : 0,
      totalPnl: Number(inSamplePnl.toFixed(2)),
      barsCount: Math.max(1, splitIndex - startIdx),
    },
    outOfSample: {
      tradeCount: outOfSampleTrades.length,
      winRate: outOfSampleTrades.length > 0 ? Number(((outSampleWins.length / outOfSampleTrades.length) * 100).toFixed(1)) : 0,
      totalPnl: Number(outSamplePnl.toFixed(2)),
      barsCount: Math.max(1, candles.length - splitIndex),
    }
  };

  const testedDateRange = {
    startDate: candles[startIdx]?.time || candles[0]?.time,
    endDate: candles[candles.length - 1]?.time,
    totalBars: candles.length,
  };

  return {
    initialCapital,
    finalCapital: Number(capital.toFixed(2)),
    totalPnl: Number(totalPnl.toFixed(2)),
    returnPercent: Number(returnPercent.toFixed(2)),
    tradeCount: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRatePercent: Number(winRatePercent.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdown.toFixed(2)),
    avgWinPnl: Number(avgWinPnl.toFixed(2)),
    avgLossPnl: Number(avgLossPnl.toFixed(2)),
    avgWinPct: Number(avgWinPct.toFixed(2)),
    avgLossPct: Number(avgLossPct.toFixed(2)),
    winLossRatio: Number(winLossRatio.toFixed(2)),
    maxConsecWins,
    maxConsecLosses,
    sharpeRatio,
    patternBreakdown,
    trades,
    equityCurve,
    testedDateRange,
    splitAnalysis,
  };
}

// Candlestick Pattern Detector within Worker
function detectBarPattern(curr, prev, prev2, candles, i) {
  if (!curr || !prev) return null;

  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low;
  const isGreen = curr.close >= curr.open;
  const isRed = curr.close < curr.open;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;

  // 1. Hammer (Bullish Reversal)
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  if (range > 0 && body > 0 && lowerWick >= 2 * body && upperWick <= body * 0.5) {
    return { name: 'Hammer', type: 'BULLISH', confidence: 85, description: 'Long lower wick rejecting intraday low' };
  }

  // 2. Bullish Engulfing
  if (prevIsRed && isGreen && curr.open <= prev.close && curr.close >= prev.open && body > prevBody) {
    return { name: 'Bullish Engulfing', type: 'BULLISH', confidence: 90, description: 'Bull candle body engulfs previous red bar' };
  }

  // 3. Morning Star (3-Bar Bull Reversal)
  if (prev2 && prev2.close < prev2.open && Math.abs(prev.close - prev.open) < body * 0.5 && curr.close > curr.open && curr.close > (prev2.open + prev2.close) / 2) {
    return { name: 'Morning Star', type: 'BULLISH', confidence: 95, description: '3-candle classic bottom exhaustion & reversal' };
  }

  // 4. 20-Period High Breakout
  if (i >= 20) {
    const priorSlice = candles.slice(i - 20, i);
    const priorHigh = Math.max(...priorSlice.map(c => c.high));
    if (curr.close > priorHigh) {
      return { name: '20-Period High Breakout', type: 'BULLISH', confidence: 88, description: `Closed above 20-bar peak (${priorHigh.toFixed(2)})` };
    }
  }

  // 5. Shooting Star (Bearish Exhaustion)
  if (range > 0 && body > 0 && upperWick >= 2 * body && lowerWick <= body * 0.5) {
    return { name: 'Shooting Star', type: 'BEARISH', confidence: 85, description: 'Long upper wick rejecting highs' };
  }

  return null;
}

// High-speed indicator math arrays
function calcEMAValues(closes, period) {
  const k = 2 / (period + 1);
  const res = new Array(closes.length).fill(0);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  let prev = sum / period;
  res[period - 1] = prev;
  for (let i = period; i < closes.length; i++) {
    const cur = closes[i] * k + prev * (1 - k);
    res[i] = cur;
    prev = cur;
  }
  return res;
}

function calcRSIValues(closes, period = 14) {
  const res = new Array(closes.length).fill(50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgL = (avgL * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    const rs = avgL === 0 ? 100 : avgG / avgL;
    res[i] = avgL === 0 ? 100 : 100 - (100 / (1 + rs));
  }
  return res;
}

function calcBollingerValues(closes, period = 20, multiplier = 2) {
  const middle = new Array(closes.length).fill(0);
  const upper = new Array(closes.length).fill(0);
  const lower = new Array(closes.length).fill(0);

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closes[i - j];
    const mean = sum / period;
    middle[i] = mean;

    let sumSq = 0;
    for (let j = 0; j < period; j++) sumSq += Math.pow(closes[i - j] - mean, 2);
    const stdDev = Math.sqrt(sumSq / period);
    upper[i] = mean + (multiplier * stdDev);
    lower[i] = mean - (multiplier * stdDev);
  }

  return { middle, upper, lower };
}

function calcMACDValues(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMAValues(closes, fast);
  const emaSlow = calcEMAValues(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = calcEMAValues(macdLine, signal);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);
  return { macdLine, signalLine, histogram };
}
