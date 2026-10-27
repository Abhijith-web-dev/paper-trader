/**
 * Client-Side Candlestick Pattern Recognition Engine
 * Detects classic price action and candlestick patterns on historical/live candle series.
 * 100% vector math, zero server requirements.
 */

/**
 * Detect patterns on the latest candle compared to recent price history
 * @param {Array<{open: number, high: number, low: number, close: number, time: number|string}>} candles
 * @param {number} index - Index of candle to evaluate (defaults to last candle)
 * @returns {Array<{ name: string, type: 'BULLISH'|'BEARISH'|'NEUTRAL', confidence: number, description: string }>}
 */
export function detectCandlePatterns(candles, index = null) {
  if (!candles || candles.length < 3) return [];

  const i = index !== null ? index : candles.length - 1;
  if (i < 2 || i >= candles.length) return [];

  const curr = candles[i];
  const prev = candles[i - 1];
  const prev2 = candles[i - 2];

  const patterns = [];

  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low;
  const isGreen = curr.close >= curr.open;
  const isRed = curr.close < curr.open;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevRange = prev.high - prev.low;
  const prevIsGreen = prev.close >= prev.open;
  const prevIsRed = prev.close < prev.open;

  // 1. DOJI (Indecision / Reversal Warning)
  if (range > 0 && body / range < 0.1) {
    patterns.push({
      name: 'Doji',
      type: 'NEUTRAL',
      confidence: 75,
      description: 'Open and close are virtually identical, indicating equilibrium between buyers and sellers.',
    });
  }

  // 2. HAMMER (Bullish Reversal after downtrend)
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  if (range > 0 && body > 0 && lowerWick >= 2 * body && upperWick <= body * 0.5) {
    patterns.push({
      name: 'Hammer',
      type: 'BULLISH',
      confidence: 85,
      description: 'Long lower shadow with small body near the high — aggressive buyer absorption at lows.',
    });
  }

  // 3. SHOOTING STAR (Bearish Reversal after uptrend)
  if (range > 0 && body > 0 && upperWick >= 2 * body && lowerWick <= body * 0.5) {
    patterns.push({
      name: 'Shooting Star',
      type: 'BEARISH',
      confidence: 85,
      description: 'Long upper shadow with rejection of intraday highs — aggressive seller supply.',
    });
  }

  // 4. BULLISH ENGULFING
  if (prevIsRed && isGreen && curr.open <= prev.close && curr.close >= prev.open && body > prevBody) {
    patterns.push({
      name: 'Bullish Engulfing',
      type: 'BULLISH',
      confidence: 90,
      description: 'Green candle completely engulfs the previous red candle body — strong buyer takeover.',
    });
  }

  // 5. BEARISH ENGULFING
  if (prevIsGreen && isRed && curr.open >= prev.close && curr.close <= prev.open && body > prevBody) {
    patterns.push({
      name: 'Bearish Engulfing',
      type: 'BEARISH',
      confidence: 90,
      description: 'Red candle completely engulfs previous green candle body — sharp seller liquidation.',
    });
  }

  // 6. MORNING STAR (3-Candle Major Bullish Reversal)
  if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < body * 0.5 && curr.close > curr.open && curr.close > (prev2.open + prev2.close) / 2) {
    patterns.push({
      name: 'Morning Star',
      type: 'BULLISH',
      confidence: 95,
      description: '3-candle bottom reversal: Large bear bar, small consolidation star, followed by strong bull confirmation.',
    });
  }

  // 7. EVENING STAR (3-Candle Major Bearish Reversal)
  if (prev2.close > prev2.open && Math.abs(prev.close - prev.open) < body * 0.5 && curr.close < curr.open && curr.close < (prev2.open + prev2.close) / 2) {
    patterns.push({
      name: 'Evening Star',
      type: 'BEARISH',
      confidence: 95,
      description: '3-candle top reversal: Large bull bar, exhausted star, followed by strong bear confirmation.',
    });
  }

  // 8. 20-BAR BREAKOUT HIGH
  const recentSlice = candles.slice(Math.max(0, i - 20), i);
  if (recentSlice.length >= 10) {
    const highestHigh = Math.max(...recentSlice.map(c => c.high));
    const lowestLow = Math.min(...recentSlice.map(c => c.low));

    if (curr.close > highestHigh) {
      patterns.push({
        name: '20-Period High Breakout',
        type: 'BULLISH',
        confidence: 88,
        description: `Price closed above previous ${recentSlice.length}-period high (${highestHigh.toFixed(2)}) on expanding momentum.`,
      });
    } else if (curr.close < lowestLow) {
      patterns.push({
        name: '20-Period Low Breakdown',
        type: 'BEARISH',
        confidence: 88,
        description: `Price closed below previous ${recentSlice.length}-period low (${lowestLow.toFixed(2)}) on downward breakdown.`,
      });
    }
  }

  return patterns;
}
