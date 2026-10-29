/**
 * OmniFeed Nexus™ - Unified Single-Source-of-Truth Market Pipeline
 * 100% Free • Direct CORS • Zero Backend • Anti-Ban Protected
 * 
 * Features:
 * 1. Single Source of Truth: All UI components (Dashboard, Chart, Order Book, Journal)
 *    listen to the exact same reactive stream.
 * 2. Dynamic Anti-Ban Request Batching: All Indian stocks in 1 request, all US stocks in 1 request.
 *    Supports unlimited custom and dynamic symbols without flooding APIs.
 * 3. Market-Hours Aware Adaptive Polling:
 *    - Active market sessions (NSE or US): Snappy 18-second refresh cadence.
 *    - Off-hours (nights, weekends, official exchange holidays): 120-second background cadence.
 *    - Hidden tab: 100% paused (0 network requests).
 * 4. Resilient Circuit Breakers & In-Flight Coalescing: Prevents cascading 429 errors.
 */

import { STOCK_DIRECTORY, getInstantInitialQuotes, runtimePriceStore } from './yahooFinance.js';
import { getNSEMarketStatus, getUSMarketStatus } from './marketHours.js';

// Map internal tickers to official TradingView scanner exchange symbols
export const TV_SYMBOL_MAP = {
  // Indian Stocks (NSE)
  'RELIANCE.NS': 'NSE:RELIANCE',
  'TCS.NS': 'NSE:TCS',
  'HDFCBANK.NS': 'NSE:HDFCBANK',
  'INFY.NS': 'NSE:INFY',
  'ICICIBANK.NS': 'NSE:ICICIBANK',
  'TATAMOTORS.NS': 'NSE:TATAMOTORS',
  'SBIN.NS': 'NSE:SBIN',
  'BHARTIARTL.NS': 'NSE:BHARTIARTL',
  'ITC.NS': 'NSE:ITC',
  'LT.NS': 'NSE:LT',
  'AGOL.NS': 'NSE:AGOL',
  'RTNPOWER.NS': 'NSE:RTNPOWER',
  'GOLDSTAR-SM.NS': 'NSE:GOLDSTAR',
  'GOLDSTAR.NS': 'NSE:GOLDSTAR',
  'HATHWAY.NS': 'NSE:HATHWAY',
  'TATAPOWER.NS': 'NSE:TATAPOWER',
  'SUZLON.NS': 'NSE:SUZLON',
  'IDEA.NS': 'NSE:IDEA',
  'YESBANK.NS': 'NSE:YESBANK',
  'IRFC.NS': 'NSE:IRFC',
  'MARUTI.NS': 'NSE:MARUTI',
  'SUNPHARMA.NS': 'NSE:SUNPHARMA',
  'AXISBANK.NS': 'NSE:AXISBANK',
  'KOTAKBANK.NS': 'NSE:KOTAKBANK',
  'BAJFINANCE.NS': 'NSE:BAJFINANCE',
  'HINDUNILVR.NS': 'NSE:HINDUNILVR',
  'ONGC.NS': 'NSE:ONGC',
  'NTPC.NS': 'NSE:NTPC',
  'POWERGRID.NS': 'NSE:POWERGRID',
  'COALINDIA.NS': 'NSE:COALINDIA',

  // US Stocks (NASDAQ / NYSE / AMEX)
  'AAPL': 'NASDAQ:AAPL',
  'NVDA': 'NASDAQ:NVDA',
  'MSFT': 'NASDAQ:MSFT',
  'GOOGL': 'NASDAQ:GOOGL',
  'AMZN': 'NASDAQ:AMZN',
  'TSLA': 'NASDAQ:TSLA',
  'META': 'NASDAQ:META',
  'AMD': 'NASDAQ:AMD',
  'NFLX': 'NASDAQ:NFLX',
  'SPY': 'AMEX:SPY',
  'PLTR': 'NASDAQ:PLTR',
  'BRK-B': 'NYSE:BRK.B',
  'V': 'NYSE:V',
  'JNJ': 'NYSE:JNJ',
  'WMT': 'NYSE:WMT',
  'JPM': 'NYSE:JPM',
  'UNH': 'NYSE:UNH',
  'MA': 'NYSE:MA',
  'PG': 'NYSE:PG',
  'HD': 'NYSE:HD',
  'DIS': 'NYSE:DIS',
  'INTC': 'NASDAQ:INTC',
  'COIN': 'NASDAQ:COIN',
  'QCOM': 'NASDAQ:QCOM',
  'BABA': 'NYSE:BABA',
};

// Reverse map: TV Symbol -> Internal Ticker (Registers candidate exchanges for 100% resolution reliability)
export const REVERSE_TV_MAP = {};

function registerReverseCandidateMappings(internalSymbol, tvPreferred) {
  const sym = internalSymbol.toUpperCase();
  const isIndian = sym.endsWith('.NS') || sym.endsWith('.BO') || STOCK_DIRECTORY[sym]?.market === 'NSE';
  const clean = sym.replace(/\.(NS|BO)$/, '');

  if (tvPreferred) {
    REVERSE_TV_MAP[tvPreferred] = sym;
  }
  if (isIndian) {
    REVERSE_TV_MAP[`NSE:${clean}`] = sym;
    REVERSE_TV_MAP[`BSE:${clean}`] = sym;
  } else {
    REVERSE_TV_MAP[`NASDAQ:${clean}`] = sym;
    REVERSE_TV_MAP[`NYSE:${clean}`] = sym;
    REVERSE_TV_MAP[`AMEX:${clean}`] = sym;
  }
}

Object.entries(TV_SYMBOL_MAP).forEach(([internal, tv]) => {
  registerReverseCandidateMappings(internal, tv);
});

// Event-driven reactive store
const listeners = new Set();
let omniFeedMemoryStore = getInstantInitialQuotes();
let inFlightSyncPromise = null;
let activeEngine = 'TradingView Global Edge';

// Circuit breaker state
let tvCircuitBrokenUntil = 0;
let tvConsecutiveFailures = 0;

// Central polling timer reference
let centralPollingTimer = null;

/**
 * Dynamically register arbitrary symbols into the central batch scanner
 * Ensures user-added stocks, portfolio holdings, and watchlists are fetched in single multi-ticker requests
 */
export function registerLiveSymbols(symbols = []) {
  if (!symbols) return;
  const list = Array.isArray(symbols) ? symbols : [symbols];
  let hasNew = false;

  list.forEach((raw) => {
    if (!raw) return;
    const sym = String(raw).trim().toUpperCase();
    if (!sym) return;

    if (!TV_SYMBOL_MAP[sym]) {
      const isIndian =
        sym.endsWith('.NS') ||
        sym.endsWith('.BO') ||
        STOCK_DIRECTORY[sym]?.market === 'NSE';

      const clean = sym.replace(/\.(NS|BO)$/, '');

      if (isIndian) {
        const nseTv = `NSE:${clean}`;
        const bseTv = `BSE:${clean}`;
        TV_SYMBOL_MAP[sym] = nseTv;
        REVERSE_TV_MAP[nseTv] = sym;
        REVERSE_TV_MAP[bseTv] = sym;
        hasNew = true;
      } else {
        const nasTv = `NASDAQ:${clean}`;
        const nyseTv = `NYSE:${clean}`;
        const amexTv = `AMEX:${clean}`;
        TV_SYMBOL_MAP[sym] = nasTv;
        REVERSE_TV_MAP[nasTv] = sym;
        REVERSE_TV_MAP[nyseTv] = sym;
        REVERSE_TV_MAP[amexTv] = sym;
        hasNew = true;
      }
    }
  });

  if (hasNew) {
    // Immediate background batch sync for newly registered symbols
    syncTradingViewScanner();
  }
}

// Pre-register all universe symbols from directory on init
if (typeof STOCK_DIRECTORY === 'object') {
  registerLiveSymbols(Object.keys(STOCK_DIRECTORY));
}

/**
 * Returns current quote synchronously from L1 RAM (0.00ms latency)
 */
export function getQuoteSync(rawSymbol) {
  if (!rawSymbol) return null;
  const sym = rawSymbol.trim().toUpperCase();
  return omniFeedMemoryStore[sym] || runtimePriceStore.get(sym) || null;
}

/**
 * Subscribes a component to real-time market updates
 */
export function subscribeToMarketStream(callback) {
  listeners.add(callback);
  
  // Immediately dispatch current memory snapshot (0ms initial UI paint)
  try {
    callback({ prices: omniFeedMemoryStore, engine: activeEngine });
  } catch (e) {
    console.error('Subscriber initial dispatch error:', e);
  }

  // Ensure central polling is active
  startCentralPolling();

  return () => {
    listeners.delete(callback);
  };
}

function broadcast(updates, engineName) {
  if (engineName) activeEngine = engineName;
  omniFeedMemoryStore = { ...omniFeedMemoryStore, ...updates };

  if (updates) {
    Object.entries(updates).forEach(([k, v]) => {
      runtimePriceStore.set(k, v);
    });
  }

  listeners.forEach((callback) => {
    try {
      callback({ prices: omniFeedMemoryStore, updates, engine: activeEngine });
    } catch (e) {
      console.error('Subscriber notify error:', e);
    }
  });
}

/**
 * Public export to broadcast verified quote updates from chart or proxy to all subscribers
 */
export function broadcastQuoteUpdates(updates, engineName = 'Normalized Exchange Stream') {
  broadcast(updates, engineName);
}

/**
 * Calculates adaptive polling interval based on official market hours
 */
function getAdaptivePollingInterval() {
  try {
    const nse = getNSEMarketStatus();
    const us = getUSMarketStatus();
    const anyMarketOpen = Boolean((nse && nse.isOpen) || (us && us.isOpen));

    // When an exchange is actively trading: snappy 18s updates
    // When both exchanges are closed: 120s background updates (saves 85% bandwidth/calls)
    return anyMarketOpen ? 18000 : 120000;
  } catch (e) {
    return 20000;
  }
}

/**
 * Central Batch-Sync from TradingView Scanner API
 * Coalesces concurrent calls into a single network operation
 */
export async function syncTradingViewScanner() {
  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  // Respect circuit breaker if tripped
  if (Date.now() < tvCircuitBrokenUntil) {
    return omniFeedMemoryStore;
  }

  inFlightSyncPromise = (async () => {
    // Partition tickers into Indian and US sets
    const nseTickers = [];
    const usTickers = [];

    Object.entries(TV_SYMBOL_MAP).forEach(([internal, tv]) => {
      const isIndian = internal.endsWith('.NS') || internal.endsWith('.BO') || STOCK_DIRECTORY[internal]?.market === 'NSE';
      if (isIndian) {
        nseTickers.push(tv);
      } else {
        usTickers.push(tv);
      }
    });

    const updates = {};

    try {
      // Execute both Indian and US scans in parallel (1 batch request each)
      const [nseRes, usRes] = await Promise.allSettled([
        fetchTVScanner('india', nseTickers),
        fetchTVScanner('america', usTickers),
      ]);

      let hadSuccess = false;

      if (nseRes.status === 'fulfilled' && nseRes.value && Object.keys(nseRes.value).length > 0) {
        Object.assign(updates, nseRes.value);
        hadSuccess = true;
      }
      if (usRes.status === 'fulfilled' && usRes.value && Object.keys(usRes.value).length > 0) {
        Object.assign(updates, usRes.value);
        hadSuccess = true;
      }

      if (hadSuccess) {
        tvConsecutiveFailures = 0;
        tvCircuitBrokenUntil = 0;
        broadcast(updates, 'TradingView Global Edge');

        // Persist to localStorage for 0ms startup on subsequent visits
        try {
          localStorage.setItem('paper_trading_market_store_v3', JSON.stringify(omniFeedMemoryStore));
        } catch (e) {}
      } else {
        tvConsecutiveFailures++;
        const backoffMs = Math.min(30000 * Math.pow(2, tvConsecutiveFailures - 1), 180000);
        tvCircuitBrokenUntil = Date.now() + backoffMs;
      }
    } catch (err) {
      tvConsecutiveFailures++;
      const backoffMs = Math.min(30000 * Math.pow(2, tvConsecutiveFailures - 1), 180000);
      tvCircuitBrokenUntil = Date.now() + backoffMs;
    } finally {
      inFlightSyncPromise = null;
    }

    return omniFeedMemoryStore;
  })();

  return inFlightSyncPromise;
}

/**
 * Fetch a single market batch from TradingView Scanner via direct CORS POST
 * Chunks requests if ticker count exceeds 60 for ultra-reliable transport
 */
async function fetchTVScanner(market, tickers) {
  if (!tickers || tickers.length === 0) return {};

  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const candidateUrls = isDev
    ? [`/api/tv-scanner/${market}/scan`, `https://scanner.tradingview.com/${market}/scan`]
    : [`https://scanner.tradingview.com/${market}/scan`];

  // Chunk tickers into batches of 60 max for stability
  const chunks = [];
  const chunkSize = 60;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    chunks.push(tickers.slice(i, i + chunkSize));
  }

  const combinedParsed = {};

  for (const chunk of chunks) {
    const body = JSON.stringify({
      symbols: { tickers: chunk },
      columns: [
        'name', 'close', 'change', 'change_abs', 'volume', 'high', 'low', 'open',
        'price_52_week_high', 'price_52_week_low',
        'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.Y',
        'SMA20', 'SMA50', 'SMA200', 'RSI'
      ],
    });

    let json = null;
    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          json = await res.json();
          if (Array.isArray(json?.data)) {
            break;
          }
        } else if (res.status === 429) {
          tvCircuitBrokenUntil = Date.now() + 60000;
          break;
        }
      } catch (err) {
        // Try fallback candidate url
      }
    }

    if (json?.data && Array.isArray(json.data)) {
      json.data.forEach((item) => {
        const tvSymbol = item.s;
        const internalSymbol = REVERSE_TV_MAP[tvSymbol];
        if (!internalSymbol) return;

        const [
          name, close, changePercent, changeAbs, volume, high, low, open,
          high52, low52,
          perfW, perf1M, perf3M, perf6M, perfY,
          sma20, sma50, sma200, rsi
        ] = item.d || [];

        const stockInfo = STOCK_DIRECTORY[internalSymbol] || {};

        combinedParsed[internalSymbol] = {
          symbol: internalSymbol,
          name: stockInfo.name || name,
          market: stockInfo.market || (internalSymbol.endsWith('.NS') ? 'NSE' : 'US'),
          currency: stockInfo.currency || (internalSymbol.endsWith('.NS') ? 'INR' : 'USD'),
          price: Number(close != null ? close.toFixed(2) : stockInfo.basePrice),
          change: Number(changeAbs != null ? changeAbs.toFixed(2) : 0),
          changePercent: Number(changePercent != null ? changePercent.toFixed(2) : 0),
          high: Number((high || close || stockInfo.basePrice).toFixed(2)),
          low: Number((low || close || stockInfo.basePrice).toFixed(2)),
          open: Number((open || close || stockInfo.basePrice).toFixed(2)),
          previousClose: Number(((close || stockInfo.basePrice) - (changeAbs || 0)).toFixed(2)),
          volume: formatVolume(volume),
          rawVolume: volume || 0,
          marketCap: stockInfo.marketCap || 'N/A',
          peRatio: stockInfo.peRatio || 'N/A',
          high52: high52 || stockInfo.high52,
          low52: low52 || stockInfo.low52,
          perfW: perfW != null ? Number(perfW.toFixed(2)) : 0,
          perf1M: perf1M != null ? Number(perf1M.toFixed(2)) : 0,
          perf3M: perf3M != null ? Number(perf3M.toFixed(2)) : 0,
          perf6M: perf6M != null ? Number(perf6M.toFixed(2)) : 0,
          perfY: perfY != null ? Number(perfY.toFixed(2)) : 0,
          sma20: sma20 != null ? Number(sma20.toFixed(2)) : null,
          sma50: sma50 != null ? Number(sma50.toFixed(2)) : null,
          sma200: sma200 != null ? Number(sma200.toFixed(2)) : null,
          rsi: rsi != null ? Number(rsi.toFixed(2)) : null,
          sector: stockInfo.sector || 'Equities',
          timestamp: Date.now(),
          source: 'tradingview_edge',
        };
      });
    }
  }

  return combinedParsed;
}

/**
 * Adaptive Central Polling Scheduler
 */
function scheduleNextPoll() {
  if (centralPollingTimer != null) {
    clearTimeout(centralPollingTimer);
    centralPollingTimer = null;
  }

  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.hidden) return;

  const intervalMs = getAdaptivePollingInterval();
  centralPollingTimer = setTimeout(async () => {
    try {
      await syncTradingViewScanner();
    } finally {
      scheduleNextPoll();
    }
  }, intervalMs);
}

/**
 * Starts Central Polling with Page Visibility API guards
 */
function startCentralPolling() {
  if (centralPollingTimer != null || typeof window === 'undefined') return;

  // Immediate background sync
  syncTradingViewScanner();

  // Schedule next adaptive poll
  scheduleNextPoll();
}

/**
 * Stops Central Polling
 */
function stopCentralPolling() {
  if (centralPollingTimer != null) {
    clearTimeout(centralPollingTimer);
    centralPollingTimer = null;
  }
}

// Page Visibility API: Stop polling when tab is hidden, resume immediately when tab is reopened
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCentralPolling();
    } else {
      syncTradingViewScanner();
      startCentralPolling();
    }
  });
}

// Initialize on module load
if (typeof window !== 'undefined') {
  startCentralPolling();
}

/**
 * Real-Time Market Sync Trigger (Explicit button or manual pull-to-refresh)
 */
export async function triggerRealTimeSync() {
  const result = await syncTradingViewScanner();
  scheduleNextPoll();
  return result;
}

function formatVolume(vol) {
  if (!vol) return '1.2M';
  return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(vol);
}
