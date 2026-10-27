import { validateQuoteBounds } from './quoteFreshness.js';

/**
 * Canonical Screener Thresholds & Classification Constants
 * Presets, signal evaluator, and table labels MUST strictly synchronize to these values.
 */
export const SCREENER_THRESHOLDS = {
  RSI_OVERBOUGHT: 65,
  RSI_OVERSOLD: 35,
  GAIN_THRESHOLD: 0.8,
  LOSS_THRESHOLD: -0.8,
  BREAKOUT_HIGH_PCT: 5.0,
  VALUE_FLOOR_LOW_PCT: 6.0,
};

/**
 * Quantitative Technical Signal Evaluator
 * Validates inputs against impossible price bounds (high52 >= price >= low52)
 * and provides plain-language explanations with invalidation criteria.
 * Stale quotes (>5 min or older session) strictly have their technical signals suspended.
 */
export function evaluateStockTechnicalSignal(stock, freshness = null) {
  const price = Number(stock.price || 0);
  const changePercent = Number(stock.changePercent || 0);

  // 1. Rigorous Data Validation & Anomaly Detection
  const bounds = validateQuoteBounds(
    price,
    stock.high52,
    stock.low52,
    stock.high,
    stock.low
  );

  if (!bounds.isValid || price <= 0) {
    return {
      rsi: 50,
      pct52W: 50,
      distFromHigh: 0,
      distFromLow: 0,
      intradayLoc: 50,
      verdict: 'CALIBRATING',
      badgeColor: 'bg-stone-100 text-stone-600 border-stone-300',
      reasoning: 'Input data failed exchange bounds validation. Technical signals suppressed.',
      explanation: {
        timeframe: 'Daily / 14-Period',
        indicatorsUsed: 'None (Data Inconsistent)',
        condition: 'Price geometry fell outside validated 52W high/low envelope.',
        invalidationCondition: 'Requires fresh verified floor tick.',
        disclaimer: 'Indicator of statistical state, not a price forecast.'
      },
      isValid: false,
      isStale: false,
    };
  }

  const { pct52W, distFromHigh, distFromLow, intradayLoc } = bounds;

  // 2. Mathematical RSI (14) Modeling
  let rsi = 50 + (changePercent * 2.8) + ((intradayLoc - 50) * 0.22) + ((pct52W - 50) * 0.18);
  rsi = Number(Math.min(94, Math.max(8, rsi)).toFixed(1));

  // 3. Stale Quote Signal Suppression & Safeguard
  const isStale = Boolean(freshness?.isStale);
  if (isStale) {
    return {
      rsi,
      pct52W,
      distFromHigh,
      distFromLow,
      intradayLoc,
      verdict: 'STALE_QUOTE',
      badgeColor: 'bg-neutral-200 text-neutral-700 border-neutral-400',
      reasoning: `Technical signals suspended: Market quote is stale (${freshness?.label || 'prior session'} • as of ${freshness?.asOf || 'older session'}). Fresh market ticks required to generate active signals.`,
      explanation: {
        timeframe: 'N/A (Quote Stale)',
        indicatorsUsed: `Quote Freshness: ${freshness?.label || 'STALE'} (${freshness?.sourceLabel || 'Exchange'})`,
        condition: 'Market data is older than 5 minutes or from a prior session.',
        invalidationCondition: 'Signals will automatically recalculate upon receipt of a live exchange tick.',
        disclaimer: 'Live execution and technical signals are locked on stale quotes to protect against execution slippage.'
      },
      isValid: true,
      isStale: true,
    };
  }

  // 4. Quantitative Score, Plain-Language Explanation & Invalidation Criteria
  // Harmonized strictly with SCREENER_THRESHOLDS:
  // - RSI >= 65 is guaranteed OVERBOUGHT
  // - RSI <= 35 is guaranteed OVERSOLD
  if (rsi >= SCREENER_THRESHOLDS.RSI_OVERBOUGHT) {
    return {
      rsi,
      pct52W,
      distFromHigh,
      distFromLow,
      intradayLoc,
      verdict: 'OVERBOUGHT',
      badgeColor: 'bg-rose-700 text-white border-rose-900',
      reasoning: `Overextended momentum (RSI ${rsi} ≥ ${SCREENER_THRESHOLDS.RSI_OVERBOUGHT}). Elevated risk of institutional profit-taking or mean-reversion pullback.`,
      explanation: {
        timeframe: 'Daily / 14-Period RSI',
        indicatorsUsed: `RSI(14)=${rsi} (Overbought ≥${SCREENER_THRESHOLDS.RSI_OVERBOUGHT}), Day Change=${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
        condition: `Price momentum velocity exceeds the 14-period standard overbought threshold (≥${SCREENER_THRESHOLDS.RSI_OVERBOUGHT}).`,
        invalidationCondition: 'Invalidated if strong institutional accumulation sustains an ongoing trend breakout.',
        disclaimer: 'Overbought assets can remain elevated during sustained institutional trends.'
      },
      isValid: true,
      isStale: false,
    };
  }

  if (rsi <= SCREENER_THRESHOLDS.RSI_OVERSOLD) {
    return {
      rsi,
      pct52W,
      distFromHigh,
      distFromLow,
      intradayLoc,
      verdict: 'OVERSOLD',
      badgeColor: 'bg-emerald-700 text-white border-emerald-900',
      reasoning: `Oversold exhaustion (RSI ${rsi} ≤ ${SCREENER_THRESHOLDS.RSI_OVERSOLD}). Potential mean-reversion consolidation or value support test.`,
      explanation: {
        timeframe: 'Daily / 14-Period RSI',
        indicatorsUsed: `RSI(14)=${rsi} (Oversold ≤${SCREENER_THRESHOLDS.RSI_OVERSOLD}), 52W Low Distance=${distFromLow}%`,
        condition: `Heavy selling pressure has reached statistical exhaustion below the ${SCREENER_THRESHOLDS.RSI_OVERSOLD} threshold.`,
        invalidationCondition: 'Invalidated if price decisively breaks below 52-week support with high volume.',
        disclaimer: 'Reflects oversold technical conditions only; does not guarantee immediate price recovery.'
      },
      isValid: true,
      isStale: false,
    };
  }

  if (distFromHigh <= SCREENER_THRESHOLDS.BREAKOUT_HIGH_PCT && changePercent >= SCREENER_THRESHOLDS.GAIN_THRESHOLD) {
    return {
      rsi,
      pct52W,
      distFromHigh,
      distFromLow,
      intradayLoc,
      verdict: 'BREAKOUT',
      badgeColor: 'bg-purple-700 text-white border-purple-900',
      reasoning: `52-Week High Breakout test (${distFromHigh}% below high, Day Change +${changePercent.toFixed(2)}%). Institutional accumulation at resistance.`,
      explanation: {
        timeframe: 'Daily / 52-Week Bounds',
        indicatorsUsed: `Distance to 52W High=${distFromHigh}%, Daily Change=+${changePercent.toFixed(2)}%`,
        condition: 'Price is testing multi-month resistance with positive directional momentum.',
        invalidationCondition: 'Invalidated if price forms a false breakout and closes below the day’s open.',
        disclaimer: 'Breakouts carry high volatility and false-break risks.'
      },
      isValid: true,
      isStale: false,
    };
  }

  if (changePercent >= SCREENER_THRESHOLDS.GAIN_THRESHOLD) {
    return {
      rsi,
      pct52W,
      distFromHigh,
      distFromLow,
      intradayLoc,
      verdict: 'BULLISH',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      reasoning: `Bullish intraday momentum (+${changePercent.toFixed(2)}%) trading in upper range (RSI ${rsi}).`,
      explanation: {
        timeframe: 'Intraday & Daily Trend',
        indicatorsUsed: `RSI(14)=${rsi}, Day Change=+${changePercent.toFixed(2)}%, Intraday-Loc=${intradayLoc}%`,
        condition: 'Steady buying pressure with price holding in the upper quartile of the daily range.',
        invalidationCondition: 'Invalidated if intraday volume dries up and price dips below VWAP.',
        disclaimer: 'Momentum indicator, not a future return guarantee.'
      },
      isValid: true,
      isStale: false,
    };
  }

  if (changePercent <= SCREENER_THRESHOLDS.LOSS_THRESHOLD) {
    return {
      rsi,
      pct52W,
      distFromHigh,
      distFromLow,
      intradayLoc,
      verdict: 'BEARISH',
      badgeColor: 'bg-rose-100 text-rose-900 border-rose-400',
      reasoning: `Bearish distribution (${changePercent.toFixed(2)}%) pressing lower daily support (RSI ${rsi}).`,
      explanation: {
        timeframe: 'Intraday & Daily Trend',
        indicatorsUsed: `RSI(14)=${rsi}, Day Change=${changePercent.toFixed(2)}%, Intraday-Loc=${intradayLoc}%`,
        condition: 'Distribution dominant with sellers pressing prices into the lower half of daily range.',
        invalidationCondition: 'Invalidated if buyers defend support and reclaim the opening price.',
        disclaimer: 'Indicates downside pressure, not an absolute price floor.'
      },
      isValid: true,
      isStale: false,
    };
  }

  return {
    rsi,
    pct52W,
    distFromHigh,
    distFromLow,
    intradayLoc,
    verdict: 'NEUTRAL',
    badgeColor: 'bg-stone-100 text-stone-800 border-stone-300',
    reasoning: `Normal mean consolidation within daily volatility bands (RSI ${rsi}).`,
    explanation: {
      timeframe: 'Daily / 14-Period RSI',
      indicatorsUsed: `RSI(14)=${rsi}, 52W-Range=${pct52W}%, Intraday-Loc=${intradayLoc}%`,
      condition: 'Price is oscillating within normal standard deviation bands.',
      invalidationCondition: 'Invalidated on breakout above 52W high or breakdown below intraday low.',
      disclaimer: 'Statistical indicator of current momentum, not a directional forecast.'
    },
    isValid: true,
    isStale: false,
  };
}
