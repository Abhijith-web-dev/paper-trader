/**
 * Client-Side Technical Indicator Engine
 * High-performance vector math for financial time-series.
 * Zero external dependencies, pure JavaScript/TypeScript logic.
 */

function ensureCandleArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.candles)) return data.candles;
  return [];
}

/**
 * Simple Moving Average (SMA)
 * @param {Array<{time: number|string, close: number}>} rawCandles
 * @param {number} period
 * @returns {Array<{time: number|string, value: number}>}
 */
export function calculateSMA(rawCandles, period = 20) {
  const candles = ensureCandleArray(rawCandles);
  if (!candles || candles.length < period) return [];
  const results = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      results.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(2)),
      });
    }
  }
  return results;
}

/**
 * Exponential Moving Average (EMA)
 * @param {Array<{time: number|string, close: number}>} candles
 * @param {number} period
 * @returns {Array<{time: number|string, value: number}>}
 */
export function calculateEMA(rawCandles, period = 20) {
  const candles = ensureCandleArray(rawCandles);
  if (!candles || candles.length < period) return [];
  const results = [];
  const multiplier = 2 / (period + 1);

  // Initial SMA as starting point
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEMA = sum / period;
  results.push({
    time: candles[period - 1].time,
    value: Number(prevEMA.toFixed(2)),
  });

  for (let i = period; i < candles.length; i++) {
    const currentClose = candles[i].close;
    const currentEMA = (currentClose - prevEMA) * multiplier + prevEMA;
    results.push({
      time: candles[i].time,
      value: Number(currentEMA.toFixed(2)),
    });
    prevEMA = currentEMA;
  }
  return results;
}

/**
 * Relative Strength Index (RSI - Wilder's smoothed)
 * @param {Array<{time: number|string, close: number}>} candles
 * @param {number} period
 * @returns {Array<{time: number|string, value: number}>}
 */
export function calculateRSI(rawCandles, period = 14) {
  const candles = ensureCandleArray(rawCandles);
  if (!candles || candles.length <= period) return [];
  const results = [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const initialRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const initialRSI = avgLoss === 0 ? 100 : 100 - (100 / (1 + initialRS));

  results.push({
    time: candles[period].time,
    value: Number(initialRSI.toFixed(2)),
  });

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

    results.push({
      time: candles[i].time,
      value: Number(rsi.toFixed(2)),
    });
  }

  return results;
}

/**
 * Bollinger Bands (Upper, Middle SMA, Lower)
 * @param {Array<{time: number|string, close: number}>} candles
 * @param {number} period
 * @param {number} stdDevMultiplier
 * @returns {{
 *   upper: Array<{time: number|string, value: number}>,
 *   middle: Array<{time: number|string, value: number}>,
 *   lower: Array<{time: number|string, value: number}>
 * }}
 */
export function calculateBollingerBands(rawCandles, period = 20, stdDevMultiplier = 2) {
  const candles = ensureCandleArray(rawCandles);
  if (!candles || candles.length < period) return { upper: [], middle: [], lower: [] };
  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    const mean = sum / period;

    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const time = candles[i].time;
    const upVal = mean + stdDevMultiplier * stdDev;
    const lowVal = mean - stdDevMultiplier * stdDev;

    middle.push({ time, value: Number(mean.toFixed(2)) });
    upper.push({ time, value: Number(upVal.toFixed(2)) });
    lower.push({ time, value: Number(lowVal.toFixed(2)) });
  }

  return { upper, middle, lower };
}

/**
 * Moving Average Convergence Divergence (MACD)
 * @param {Array<{time: number|string, close: number}>} candles
 * @param {number} fastPeriod
 * @param {number} slowPeriod
 * @param {number} signalPeriod
 * @returns {{
 *   macdLine: Array<{time: number|string, value: number}>,
 *   signalLine: Array<{time: number|string, value: number}>,
 *   histogram: Array<{time: number|string, value: number, color: string}>
 * }}
 */
export function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!candles || candles.length < slowPeriod) {
    return { macdLine: [], signalLine: [], histogram: [] };
  }

  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  // Align timestamps
  const slowMap = new Map(slowEMA.map(item => [item.time, item.value]));
  const rawMACD = [];

  for (const fast of fastEMA) {
    if (slowMap.has(fast.time)) {
      rawMACD.push({
        time: fast.time,
        close: fast.value - slowMap.get(fast.time), // using close key for calculateEMA compatibility
        value: fast.value - slowMap.get(fast.time),
      });
    }
  }

  const signalEMA = calculateEMA(rawMACD, signalPeriod);
  const signalMap = new Map(signalEMA.map(item => [item.time, item.value]));

  const macdLine = [];
  const signalLine = [];
  const histogram = [];

  for (const m of rawMACD) {
    if (signalMap.has(m.time)) {
      const sigVal = signalMap.get(m.time);
      const histVal = m.value - sigVal;
      macdLine.push({ time: m.time, value: Number(m.value.toFixed(2)) });
      signalLine.push({ time: m.time, value: Number(sigVal.toFixed(2)) });
      histogram.push({
        time: m.time,
        value: Number(histVal.toFixed(2)),
        color: histVal >= 0 ? '#10B981' : '#EF4444',
      });
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Average True Range (ATR)
 * @param {Array<{time: number|string, high: number, low: number, close: number}>} candles
 * @param {number} period
 * @returns {Array<{time: number|string, value: number}>}
 */
export function calculateATR(rawCandles, period = 14) {
  const candles = ensureCandleArray(rawCandles);
  if (!candles || candles.length <= period) return [];
  const trs = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const hl = current.high - current.low;
    const hc = Math.abs(current.high - prev.close);
    const lc = Math.abs(current.low - prev.close);
    const tr = Math.max(hl, hc, lc);
    trs.push({ time: current.time, tr });
  }

  const results = [];
  let sumTR = trs.slice(0, period).reduce((acc, t) => acc + t.tr, 0);
  let prevATR = sumTR / period;

  results.push({
    time: trs[period - 1].time,
    value: Number(prevATR.toFixed(2)),
  });

  for (let i = period; i < trs.length; i++) {
    const currentATR = (prevATR * (period - 1) + trs[i].tr) / period;
    results.push({
      time: trs[i].time,
      value: Number(currentATR.toFixed(2)),
    });
    prevATR = currentATR;
  }

  return results;
}

/**
 * Automated Technical Signal Analyzer (Explainable Rules)
 * Evaluates available indicators to produce a unified signal verdict
 * with explicit contributing reasons.
 *
 * @param {Array<{open: number, high: number, low: number, close: number, volume: number, time: number|string}>} candles
 * @param {number} currentPrice
 * @returns {{
 *   verdict: 'STRONG_BUY'|'BUY'|'NEUTRAL'|'SELL'|'STRONG_SELL',
 *   score: number, // -100 to +100
 *   reasons: Array<{ type: 'BULLISH'|'BEARISH'|'NEUTRAL', indicator: string, detail: string }>,
 *   metrics: {
 *     rsi: number|null,
 *     ema20: number|null,
 *     ema50: number|null,
 *     bbPosition: string|null,
 *     macdHist: number|null,
 *     atr: number|null
 *   }
 * }}
 */
export function analyzeTechnicalSignals(rawCandles, currentPrice) {
  const candles = ensureCandleArray(rawCandles);
  if (!candles || candles.length < 30) {
    return {
      verdict: 'NEUTRAL',
      score: 0,
      reasons: [{ type: 'NEUTRAL', indicator: 'Data', detail: 'Insufficient candles for technical signal analysis.' }],
      metrics: { rsi: null, ema20: null, ema50: null, bbPosition: null, macdHist: null, atr: null },
    };
  }

  const price = currentPrice || candles[candles.length - 1].close;
  const reasons = [];
  let score = 0;

  // 1. RSI (14)
  const rsiSeries = calculateRSI(candles, 14);
  const latestRSI = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1].value : null;

  if (latestRSI !== null) {
    if (latestRSI <= 30) {
      score += 30;
      reasons.push({
        type: 'BULLISH',
        indicator: 'RSI(14)',
        detail: `RSI is ${latestRSI} (≤ 30 Oversold threshold) — high probability bounce zone.`,
      });
    } else if (latestRSI >= 70) {
      score -= 30;
      reasons.push({
        type: 'BEARISH',
        indicator: 'RSI(14)',
        detail: `RSI is ${latestRSI} (≥ 70 Overbought threshold) — risk of near-term exhaustion.`,
      });
    } else if (latestRSI > 50) {
      score += 10;
      reasons.push({
        type: 'BULLISH',
        indicator: 'RSI(14)',
        detail: `RSI is ${latestRSI} (above neutral 50 center line) — positive momentum.`,
      });
    } else {
      score -= 10;
      reasons.push({
        type: 'BEARISH',
        indicator: 'RSI(14)',
        detail: `RSI is ${latestRSI} (below neutral 50 center line) — negative momentum.`,
      });
    }
  }

  // 2. EMA Trend (20 vs 50)
  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const latestEMA20 = ema20.length > 0 ? ema20[ema20.length - 1].value : null;
  const latestEMA50 = ema50.length > 0 ? ema50[ema50.length - 1].value : null;

  if (latestEMA20 !== null) {
    if (price > latestEMA20) {
      score += 15;
      reasons.push({
        type: 'BULLISH',
        indicator: 'EMA(20)',
        detail: `Price (${price}) trades above 20 EMA (${latestEMA20}) — short-term trend is upward.`,
      });
    } else {
      score -= 15;
      reasons.push({
        type: 'BEARISH',
        indicator: 'EMA(20)',
        detail: `Price (${price}) trades below 20 EMA (${latestEMA20}) — short-term resistance.`,
      });
    }
  }

  if (latestEMA20 !== null && latestEMA50 !== null) {
    if (latestEMA20 > latestEMA50) {
      score += 20;
      reasons.push({
        type: 'BULLISH',
        indicator: 'Golden Cross (20/50)',
        detail: `20 EMA (${latestEMA20}) is above 50 EMA (${latestEMA50}) — medium-term bullish structure.`,
      });
    } else {
      score -= 20;
      reasons.push({
        type: 'BEARISH',
        indicator: 'Death Cross (20/50)',
        detail: `20 EMA (${latestEMA20}) is below 50 EMA (${latestEMA50}) — medium-term bearish trend.`,
      });
    }
  }

  // 3. Bollinger Bands (20, 2)
  const bb = calculateBollingerBands(candles, 20, 2);
  let bbPosition = 'INSIDE';
  if (bb.upper.length > 0) {
    const up = bb.upper[bb.upper.length - 1].value;
    const low = bb.lower[bb.lower.length - 1].value;
    const mid = bb.middle[bb.middle.length - 1].value;

    if (price <= low) {
      bbPosition = 'LOWER_BAND';
      score += 25;
      reasons.push({
        type: 'BULLISH',
        indicator: 'Bollinger Bands',
        detail: `Price is at/below the lower band (${low}) — statistical support extension.`,
      });
    } else if (price >= up) {
      bbPosition = 'UPPER_BAND';
      score -= 25;
      reasons.push({
        type: 'BEARISH',
        indicator: 'Bollinger Bands',
        detail: `Price is at/above the upper band (${up}) — statistical resistance extension.`,
      });
    } else {
      bbPosition = 'INSIDE_BANDS';
      reasons.push({
        type: 'NEUTRAL',
        indicator: 'Bollinger Bands',
        detail: `Price is fluctuating comfortably within bands [${low} – ${up}] around basis ${mid}.`,
      });
    }
  }

  // 4. MACD (12, 26, 9)
  const macdData = calculateMACD(candles, 12, 26, 9);
  let latestMacdHist = null;
  if (macdData.histogram.length > 0) {
    latestMacdHist = macdData.histogram[macdData.histogram.length - 1].value;
    if (latestMacdHist > 0) {
      score += 15;
      reasons.push({
        type: 'BULLISH',
        indicator: 'MACD',
        detail: `MACD Histogram is positive (+${latestMacdHist}) indicating expanding bullish momentum.`,
      });
    } else {
      score -= 15;
      reasons.push({
        type: 'BEARISH',
        indicator: 'MACD',
        detail: `MACD Histogram is negative (${latestMacdHist}) indicating expanding downward momentum.`,
      });
    }
  }

  // 5. ATR for Volatility
  const atrSeries = calculateATR(candles, 14);
  const latestATR = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1].value : null;

  // Determine Verdict
  let verdict = 'NEUTRAL';
  if (score >= 45) verdict = 'STRONG_BUY';
  else if (score >= 20) verdict = 'BUY';
  else if (score <= -45) verdict = 'STRONG_SELL';
  else if (score <= -20) verdict = 'SELL';

  return {
    verdict,
    score: Math.max(-100, Math.min(100, score)),
    reasons,
    metrics: {
      rsi: latestRSI,
      ema20: latestEMA20,
      ema50: latestEMA50,
      bbPosition,
      macdHist: latestMacdHist,
      atr: latestATR,
    },
  };
}
