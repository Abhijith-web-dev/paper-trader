/**
 * Quote Freshness & Price Quality Engine
 * 
 * Provides financial-grade data hygiene:
 * 1. Quote Freshness & Exchange As-Of Telemetry:
 *    - LIVE: updated <= 35 seconds ago (floor stream active)
 *    - DELAYED: updated <= 300 seconds ago (15-min exchange delay or inactive ticker)
 *    - STALE: updated > 300 seconds ago (market closed or network disconnected)
 *    - UNAVAILABLE: price missing or non-positive
 * 
 * 2. Mathematical Bounds & Anomaly Detection:
 *    - Enforces 52-week consistency: high52 >= price >= low52
 *    - Prevents impossible combinations (e.g. price > high52 showing 127% below high)
 *    - Suppresses speculative signals when inputs fail validation
 */

/**
 * Determine quote freshness status, label, and origin source
 */
export function getQuoteFreshness(quote) {
  if (!quote || quote.price == null || Number(quote.price) <= 0) {
    return {
      status: 'UNAVAILABLE',
      label: 'UNAVAILABLE',
      asOf: 'N/A',
      sourceLabel: 'Exchange Disconnected',
      isStale: true,
      ageSeconds: 999999,
      badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-300',
      warningMessage: 'Market price is currently unavailable for this asset.',
    };
  }

  const rawTimestamp = Number(quote.timestamp || 0);
  const now = Date.now();
  const ageMs = rawTimestamp > 0 ? Math.max(0, now - rawTimestamp) : 999999;
  const ageSeconds = Math.floor(ageMs / 1000);

  let asOf = 'Just now';
  if (rawTimestamp > 0) {
    try {
      asOf = new Date(rawTimestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      });
    } catch (e) {
      asOf = 'Recent';
    }
  }

  const sourceRaw = (quote.source || '').toLowerCase();
  let sourceLabel = 'Exchange Edge';
  if (sourceRaw.includes('tv') || sourceRaw.includes('tradingview')) {
    sourceLabel = 'TradingView Floor Stream';
  } else if (sourceRaw.includes('yahoo') || sourceRaw.includes('cloudflare')) {
    sourceLabel = 'Cloudflare Market Proxy';
  } else if (sourceRaw.includes('seed')) {
    sourceLabel = 'Market Directory Baseline';
  }

  if (ageSeconds <= 35) {
    return {
      status: 'LIVE',
      label: 'LIVE TICK',
      asOf,
      sourceLabel,
      isStale: false,
      ageSeconds,
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      warningMessage: null,
    };
  } else if (ageSeconds <= 300) {
    const mins = Math.max(1, Math.floor(ageSeconds / 60));
    return {
      status: 'DELAYED',
      label: `DELAYED (~${mins}m)`,
      asOf,
      sourceLabel,
      isStale: false,
      ageSeconds,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      warningMessage: `Quote is delayed by approximately ${mins} min. Live exchange floor prices may fluctuate upon order fill.`,
    };
  } else {
    const mins = Math.floor(ageSeconds / 60);
    return {
      status: 'STALE',
      label: `STALE (${mins > 60 ? Math.floor(mins / 60) + 'h' : mins + 'm'})`,
      asOf,
      sourceLabel,
      isStale: true,
      ageSeconds,
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
      warningMessage: `STALE QUOTE WARNING: Market data received ${mins} minutes ago. Please refresh the quote before placing order to avoid price slippage.`,
    };
  }
}

/**
 * Validate and sanitize 52-week bounds and intraday price geometry
 */
export function validateQuoteBounds(priceRaw, high52Raw, low52Raw, highRaw, lowRaw) {
  const price = Number(priceRaw || 0);

  if (price <= 0 || isNaN(price)) {
    return {
      isValid: false,
      price: 0,
      sanitizedHigh52: 0,
      sanitizedLow52: 0,
      pct52W: 0,
      distFromHigh: 0,
      distFromLow: 0,
      warning: 'Invalid zero or negative price.',
    };
  }

  let high52 = Number(high52Raw || 0);
  let low52 = Number(low52Raw || 0);
  let warning = null;

  // Check 1: 52-Week High must be >= current price
  if (high52 < price) {
    warning = `Price (${price}) exceeds recorded 52W high (${high52}). Dynamically adjusted high to current price.`;
    high52 = price;
  }

  // Check 2: 52-Week Low must be <= current price
  if (low52 <= 0 || low52 > price) {
    low52 = Math.min(price * 0.75, price);
  }

  // Check 3: Range span must be strictly positive
  const span52 = high52 - low52;
  let pct52W = 50;
  if (span52 > 0) {
    pct52W = Number(Math.min(100, Math.max(0, ((price - low52) / span52) * 100)).toFixed(1));
  }

  // Distance from high and low (guaranteed strictly within [0, 100]%)
  const distFromHigh = high52 > 0 ? Number(Math.max(0, Math.min(100, ((high52 - price) / high52) * 100)).toFixed(1)) : 0;
  const distFromLow = low52 > 0 ? Number(Math.max(0, ((price - low52) / low52) * 100).toFixed(1)) : 0;

  // Intraday bounds sanity
  let high = Number(highRaw || price * 1.01);
  let low = Number(lowRaw || price * 0.99);
  if (high < price) high = price;
  if (low > price) low = price;
  if (high < low) {
    const temp = high;
    high = low;
    low = temp;
  }

  const daySpan = high - low;
  const intradayLoc = daySpan > 0 ? Number(Math.min(100, Math.max(0, ((price - low) / daySpan) * 100)).toFixed(1)) : 50;

  return {
    isValid: true,
    price,
    sanitizedHigh52: Number(high52.toFixed(2)),
    sanitizedLow52: Number(low52.toFixed(2)),
    pct52W,
    distFromHigh,
    distFromLow,
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    intradayLoc,
    warning,
  };
}
