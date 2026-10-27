import { synthesizeCandlesticks } from './microstructureEngine.js';
import { saveCandlesCache, getCandlesCache } from './localDb.js';
import { recordCloudflareCall, coalesceAsync } from './cloudQuotaManager.js';

/**
 * High-Speed Financial Market Engine (0ms Instant Load + Real-Time Ticks)
 * Solves proxy lag & rate limits:
 * 1. Instant Seeded Cache: 0ms initial render with realistic market prices.
 * 2. Background Parallel Non-Blocking Fetcher: Never locks the UI thread.
 * 3. High-Frequency Live Market Ticker: Sub-second micro-fluctuations (Bloomberg terminal style).
 * 4. Fast Historical Candlestick Generator: Generates 60-day OHLCV data in < 3ms for TradingView charts.
 */

// Comprehensive Stock Universe with pre-seeded market fundamentals
export const STOCK_DIRECTORY = {
  // --- Indian Equities (NSE) ---
  'RELIANCE.NS': {
    symbol: 'RELIANCE.NS',
    ticker: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 1192.50,
    sector: 'Energy & Retail',
    peRatio: '24.8',
    marketCap: '₹18.5 Lakh Cr',
    high52: 1608.80,
    low52: 1180.00,
    volume: '14.8M',
  },
  'TCS.NS': {
    symbol: 'TCS.NS',
    ticker: 'TCS',
    name: 'Tata Consultancy Services',
    market: 'NSE',
    currency: 'INR',
    basePrice: 3820.00,
    sector: 'Information Technology',
    peRatio: '31.2',
    marketCap: '₹14.9 Lakh Cr',
    high52: 4592.25,
    low52: 3313.00,
    volume: '2.8M',
  },
  'HDFCBANK.NS': {
    symbol: 'HDFCBANK.NS',
    ticker: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 1740.00,
    sector: 'Banking & Financials',
    peRatio: '19.4',
    marketCap: '₹13.2 Lakh Cr',
    high52: 1794.00,
    low52: 1363.55,
    volume: '18.2M',
  },
  'INFY.NS': {
    symbol: 'INFY.NS',
    ticker: 'INFY',
    name: 'Infosys Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 1885.00,
    sector: 'Information Technology',
    peRatio: '28.1',
    marketCap: '₹7.8 Lakh Cr',
    high52: 1991.45,
    low52: 1358.35,
    volume: '6.4M',
  },
  'ICICIBANK.NS': {
    symbol: 'ICICIBANK.NS',
    ticker: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 1245.00,
    sector: 'Banking & Financials',
    peRatio: '18.2',
    marketCap: '₹8.7 Lakh Cr',
    high52: 1300.00,
    low52: 910.00,
    volume: '11.2M',
  },
  'TATAMOTORS.NS': {
    symbol: 'TATAMOTORS.NS',
    ticker: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 890.00,
    sector: 'Automotive & EV',
    peRatio: '16.5',
    marketCap: '₹3.5 Lakh Cr',
    high52: 1179.00,
    low52: 621.00,
    volume: '9.5M',
  },
  'SBIN.NS': {
    symbol: 'SBIN.NS',
    ticker: 'SBIN',
    name: 'State Bank of India',
    market: 'NSE',
    currency: 'INR',
    basePrice: 810.00,
    sector: 'Public Sector Banking',
    peRatio: '10.8',
    marketCap: '₹7.2 Lakh Cr',
    high52: 912.00,
    low52: 543.00,
    volume: '15.6M',
  },
  'BHARTIARTL.NS': {
    symbol: 'BHARTIARTL.NS',
    ticker: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 1875.20,
    sector: 'Telecommunications',
    peRatio: '48.2',
    marketCap: '₹10.5 Lakh Cr',
    high52: 1910.00,
    low52: 1080.00,
    volume: '6.2M',
  },
  'ITC.NS': {
    symbol: 'ITC.NS',
    ticker: 'ITC',
    name: 'ITC Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 472.00,
    sector: 'FMCG & Consumer Goods',
    peRatio: '28.4',
    marketCap: '₹5.9 Lakh Cr',
    high52: 528.00,
    low52: 399.00,
    volume: '12.1M',
  },
  'LT.NS': {
    symbol: 'LT.NS',
    ticker: 'LT',
    name: 'Larsen & Toubro Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 3660.00,
    sector: 'Infrastructure & Engineering',
    peRatio: '32.6',
    marketCap: '₹4.9 Lakh Cr',
    high52: 3919.90,
    low52: 2860.00,
    volume: '2.4M',
  },
  'AGOL.NS': {
    symbol: 'AGOL.NS',
    ticker: 'AGOL',
    name: 'Agro Phos India Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 6.71,
    sector: 'Fertilizers & Chemicals',
    peRatio: '14.2',
    marketCap: '₹138 Cr',
    high52: 14.50,
    low52: 6.71,
    volume: '3.8M',
  },
  'RTNPOWER.NS': {
    symbol: 'RTNPOWER.NS',
    ticker: 'RTNPOWER',
    name: 'RattanIndia Power Limited',
    market: 'NSE',
    currency: 'INR',
    basePrice: 6.11,
    sector: 'Power Generation & Utilities',
    peRatio: '18.4',
    marketCap: '₹3,280 Cr',
    high52: 11.68,
    low52: 5.88,
    volume: '28.5M',
  },
  'GOLDSTAR-SM.NS': {
    symbol: 'GOLDSTAR-SM.NS',
    ticker: 'GOLDSTAR',
    name: 'Goldstar Power Limited',
    market: 'NSE',
    currency: 'INR',
    basePrice: 9.15,
    sector: 'Energy & Battery Tech',
    peRatio: '22.1',
    marketCap: '₹225 Cr',
    high52: 12.80,
    low52: 6.90,
    volume: '1.2M',
  },
  'GOLDSTAR.NS': {
    symbol: 'GOLDSTAR.NS',
    ticker: 'GOLDSTAR',
    name: 'Goldstar Power Limited (NSE SME)',
    targetSymbol: 'GOLDSTAR-SM.NS',
    isAlias: true,
    market: 'NSE',
    currency: 'INR',
    basePrice: 9.15,
    sector: 'Energy & Battery Tech',
    peRatio: '22.1',
    marketCap: '₹225 Cr',
    high52: 12.80,
    low52: 6.90,
    volume: '1.2M',
  },
  'HATHWAY.NS': {
    symbol: 'HATHWAY.NS',
    ticker: 'HATHWAY',
    name: 'Hathway Cable & Datacom Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 8.98,
    sector: 'Telecommunications & Media',
    peRatio: '21.0',
    marketCap: '₹1,590 Cr',
    high52: 24.80,
    low52: 8.50,
    volume: '6.4M',
  },
  'TATAPOWER.NS': {
    symbol: 'TATAPOWER.NS',
    ticker: 'TATAPOWER',
    name: 'Tata Power Company Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 344.80,
    sector: 'Power & Renewable Energy',
    peRatio: '31.5',
    marketCap: '₹1.10 Lakh Cr',
    high52: 494.85,
    low52: 320.00,
    volume: '8.9M',
  },
  'SUZLON.NS': {
    symbol: 'SUZLON.NS',
    ticker: 'SUZLON',
    name: 'Suzlon Energy Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 55.40,
    sector: 'Renewable & Wind Energy',
    peRatio: '48.2',
    marketCap: '₹75,600 Cr',
    high52: 86.04,
    low52: 36.80,
    volume: '45.2M',
  },
  'IDEA.NS': {
    symbol: 'IDEA.NS',
    ticker: 'IDEA',
    name: 'Vodafone Idea Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 7.20,
    sector: 'Telecommunications',
    peRatio: 'N/A',
    marketCap: '₹48,200 Cr',
    high52: 19.18,
    low52: 6.50,
    volume: '110.0M',
  },
  'YESBANK.NS': {
    symbol: 'YESBANK.NS',
    ticker: 'YESBANK',
    name: 'Yes Bank Ltd.',
    market: 'NSE',
    currency: 'INR',
    basePrice: 19.45,
    sector: 'Banking & Financials',
    peRatio: '45.0',
    marketCap: '₹61,000 Cr',
    high52: 32.85,
    low52: 17.20,
    volume: '58.0M',
  },
  'IRFC.NS': {
    symbol: 'IRFC.NS',
    ticker: 'IRFC',
    name: 'Indian Railway Finance Corporation',
    market: 'NSE',
    currency: 'INR',
    basePrice: 135.00,
    sector: 'Railway Infrastructure & Finance',
    peRatio: '28.5',
    marketCap: '₹1.76 Lakh Cr',
    high52: 229.00,
    low52: 120.00,
    volume: '18.4M',
  },

  // --- US Equities (NASDAQ / NYSE) ---
  'AAPL': {
    symbol: 'AAPL',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 242.50,
    sector: 'Consumer Electronics & Software',
    peRatio: '34.6',
    marketCap: '$3.52 Trillion',
    high52: 248.00,
    low52: 165.00,
    volume: '48.2M',
  },
  'NVDA': {
    symbol: 'NVDA',
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    market: 'US',
    currency: 'USD',
    basePrice: 144.20,
    sector: 'Semiconductors & GPU Hardware',
    peRatio: '58.4',
    marketCap: '$3.45 Trillion',
    high52: 153.00,
    low52: 45.00,
    volume: '88.5M',
  },
  'MSFT': {
    symbol: 'MSFT',
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    market: 'US',
    currency: 'USD',
    basePrice: 438.00,
    sector: 'Cloud & Enterprise Software',
    peRatio: '36.8',
    marketCap: '$3.28 Trillion',
    high52: 468.00,
    low52: 366.00,
    volume: '21.4M',
  },
  'GOOGL': {
    symbol: 'GOOGL',
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 182.50,
    sector: 'Search & Cloud Platforms',
    peRatio: '25.3',
    marketCap: '$2.21 Trillion',
    high52: 193.00,
    low52: 128.00,
    volume: '24.9M',
  },
  'AMZN': {
    symbol: 'AMZN',
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 215.00,
    sector: 'E-Commerce & AWS Cloud',
    peRatio: '43.7',
    marketCap: '$1.98 Trillion',
    high52: 220.00,
    low52: 144.00,
    volume: '39.8M',
  },
  'TSLA': {
    symbol: 'TSLA',
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 268.00,
    sector: 'EV, Energy & Robotics',
    peRatio: '65.2',
    marketCap: '$810 Billion',
    high52: 271.00,
    low52: 138.80,
    volume: '71.3M',
  },
  'META': {
    symbol: 'META',
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 610.00,
    sector: 'Social Media & Tech Platforms',
    peRatio: '29.1',
    marketCap: '$1.52 Trillion',
    high52: 630.00,
    low52: 279.40,
    volume: '14.5M',
  },
  'AMD': {
    symbol: 'AMD',
    ticker: 'AMD',
    name: 'Advanced Micro Devices',
    market: 'US',
    currency: 'USD',
    basePrice: 156.00,
    sector: 'Semiconductors & Datacenter',
    peRatio: '115.0',
    marketCap: '$255 Billion',
    high52: 227.30,
    low52: 94.00,
    volume: '42.1M',
  },
  'NFLX': {
    symbol: 'NFLX',
    ticker: 'NFLX',
    name: 'Netflix Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 785.00,
    sector: 'Streaming Entertainment',
    peRatio: '42.0',
    marketCap: '$295 Billion',
    high52: 810.00,
    low52: 398.00,
    volume: '4.8M',
  },
  'SPY': {
    symbol: 'SPY',
    ticker: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    market: 'US',
    currency: 'USD',
    basePrice: 595.00,
    sector: 'Broad Market Index ETF',
    peRatio: '26.4',
    marketCap: '$580 Billion',
    high52: 602.00,
    low52: 489.00,
    volume: '62.0M',
  },
  'PLTR': {
    symbol: 'PLTR',
    ticker: 'PLTR',
    name: 'Palantir Technologies Inc.',
    market: 'US',
    currency: 'USD',
    basePrice: 196.75,
    sector: 'Enterprise AI & Analytics Platforms',
    peRatio: '88.5',
    marketCap: '$440 Billion',
    high52: 202.00,
    low52: 20.50,
    volume: '48.5M',
  },
};

// Internal active price memory store
export const runtimePriceStore = new Map();

/**
 * 0.00ms Instant Pre-Seeding: Returns full quote dictionary for all stocks immediately
 */
export function getInstantInitialQuotes() {
  const result = {};
  
  // Try loading saved prices from localStorage first
  let savedData = {};
  try {
    const raw = localStorage.getItem('paper_trading_market_store_v3');
    if (raw) savedData = JSON.parse(raw);
  } catch (e) {
    // Ignore storage parse issues
  }

  Object.values(STOCK_DIRECTORY).forEach((s) => {
    const saved = savedData[s.symbol];
    if (saved && saved.price) {
      result[s.symbol] = saved;
      runtimePriceStore.set(s.symbol, saved);
    } else {
      const initialQuote = {
        symbol: s.symbol,
        name: s.name,
        currency: s.currency,
        market: s.market,
        price: s.basePrice,
        change: 0,
        changePercent: 0,
        high: s.basePrice,
        low: s.basePrice,
        open: s.basePrice,
        previousClose: s.basePrice,
        volume: s.volume,
        marketCap: s.marketCap,
        peRatio: s.peRatio,
        high52: s.high52,
        low52: s.low52,
        sector: s.sector,
        timestamp: Date.now(),
        source: 'instant_seed',
      };
      result[s.symbol] = initialQuote;
      runtimePriceStore.set(s.symbol, initialQuote);
    }
  });

  return result;
}

/**
 * Instant Quote Getter (Always returns in 0ms from runtime store)
 */
export async function getStockQuote(rawSymbol) {
  const symbol = (rawSymbol || 'AAPL').trim().toUpperCase();
  if (runtimePriceStore.has(symbol)) {
    return runtimePriceStore.get(symbol);
  }
  const all = getInstantInitialQuotes();
  if (all[symbol]) {
    return all[symbol];
  }
  try {
    const live = await fetchSingleYahooQuote(symbol, 3500);
    if (live) {
      return live;
    }
  } catch (err) {
    // Fall back to fallback generator
  }
  return generateFallbackQuote(symbol);
}

/**
 * High-Speed Parallel Real Quote Fetcher (Never blocks or hangs UI)
 */
export async function fetchLiveQuotesParallel(symbols) {
  const updatedMap = {};
  const promises = symbols.map(async (sym) => {
    try {
      const live = await fetchSingleYahooQuote(sym, 4000);
      if (live) {
        updatedMap[sym] = live;
        runtimePriceStore.set(sym, live);
      }
    } catch {
      // Keep existing accurate price without injecting fake noise
    }
  });

  await Promise.allSettled(promises);

  // Persist updated prices to localStorage
  try {
    const serialized = Object.fromEntries(runtimePriceStore);
    localStorage.setItem('paper_trading_market_store_v3', JSON.stringify(serialized));
  } catch (e) {
    // Quota safety
  }

  return updatedMap;
}

/**
 * Fetch a single live quote directly from TradingView Scanner API
 * Operates natively with CORS on all deployment environments (Firebase Hosting, Vercel, Netlify)
 */
export async function fetchSingleTVQuote(symbol) {
  const isNSE = symbol.endsWith('.NS');
  const market = isNSE ? 'india' : 'america';
  const cleanTicker = isNSE ? symbol.replace('.NS', '') : symbol;
  const candidateTickers = isNSE 
    ? [`NSE:${cleanTicker}`, `BSE:${cleanTicker}`] 
    : [`NASDAQ:${cleanTicker}`, `NYSE:${cleanTicker}`, `AMEX:${cleanTicker}`];

  const candidateUrls = [
    `https://scanner.tradingview.com/${market}/scan`,
    `/api/tv-scanner/${market}/scan`
  ];

  const body = JSON.stringify({
    symbols: { tickers: candidateTickers },
    columns: [
      'name', 'close', 'open', 'high', 'low', 'change', 'change_abs', 'volume',
      'price_52_week_high', 'price_52_week_low',
      'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.Y',
      'SMA20', 'SMA50', 'SMA200', 'RSI'
    ],
  });

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        const row = json?.data?.[0]?.d;
        if (row && Array.isArray(row)) {
          const [
            name, close, open, high, low, changePercent, changeAbs, volume,
            high52, low52,
            perfW, perf1M, perf3M, perf6M, perfY,
            sma20, sma50, sma200, rsi
          ] = row;

          const stockInfo = STOCK_DIRECTORY[symbol] || {};
          const currentPrice = Number(close != null ? close.toFixed(2) : (stockInfo.basePrice || 100));
          const previousClose = Number((changeAbs != null ? (currentPrice - changeAbs) : (open || currentPrice)).toFixed(2));

          const quote = {
            symbol,
            name: stockInfo.name || name || cleanTicker,
            currency: stockInfo.currency || (isNSE ? 'INR' : 'USD'),
            market: stockInfo.market || (isNSE ? 'NSE' : 'US'),
            price: currentPrice,
            change: Number((changeAbs != null ? changeAbs : 0).toFixed(2)),
            changePercent: Number((changePercent != null ? changePercent : 0).toFixed(2)),
            high: Number((high != null ? high : currentPrice).toFixed(2)),
            low: Number((low != null ? low : currentPrice).toFixed(2)),
            open: Number((open != null ? open : currentPrice).toFixed(2)),
            previousClose,
            volume: typeof volume === 'number' 
              ? new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(volume)
              : (stockInfo.volume || '2.5M'),
            rawVolume: volume || 0,
            marketCap: stockInfo.marketCap || 'N/A',
            peRatio: stockInfo.peRatio || 'N/A',
            high52: high52 || stockInfo.high52 || currentPrice * 1.15,
            low52: low52 || stockInfo.low52 || currentPrice * 0.8,
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
            source: 'tv_realtime',
          };

          // Register in STOCK_DIRECTORY so subsequent references inherit exact real price
          if (!STOCK_DIRECTORY[symbol]) {
            STOCK_DIRECTORY[symbol] = {
              symbol,
              ticker: cleanTicker,
              name: stockInfo.name || name || cleanTicker,
              market: quote.market,
              currency: quote.currency,
              basePrice: currentPrice,
              sector: 'Equities',
              high52: quote.high52,
              low52: quote.low52,
              volume: quote.volume,
            };
          } else {
            STOCK_DIRECTORY[symbol].basePrice = currentPrice;
          }

          runtimePriceStore.set(symbol, quote);
          return quote;
        }
      }
    } catch (err) {
      // try next url
    }
  }

  return null;
}

// High-Performance Global Cloudflare Edge Proxy (100% Free • Edge Cached • Direct CORS)
export const CLOUDFLARE_YAHOO_PROXY = 'https://market-proxy.sparklabinfo1.workers.dev';

/**
 * Dynamically register a new stock into the active master directory
 */
export function registerDynamicStock(item) {
  if (!item || !item.symbol) return null;
  const sym = item.symbol.toUpperCase();
  const isIndian =
    sym.endsWith('.NS') ||
    sym.endsWith('.BO') ||
    item.market === 'NSE' ||
    item.exchDisp === 'NSE' ||
    item.exchDisp === 'BSE';

  const market = isIndian ? 'NSE' : 'US';
  const currency = isIndian ? 'INR' : 'USD';
  const ticker = item.ticker || sym.replace(/\.(NS|BO)$/, '');
  const name = item.name || item.longname || item.shortname || sym;
  const basePrice = item.price || item.basePrice || (isIndian ? 50 : 100);

  if (!STOCK_DIRECTORY[sym]) {
    STOCK_DIRECTORY[sym] = {
      symbol: sym,
      ticker,
      name,
      market,
      currency,
      basePrice,
      sector: item.sector || item.industry || 'Equities',
      high52: item.high52 || basePrice * 1.25,
      low52: item.low52 || basePrice * 0.75,
      volume: item.volume || '1.5M',
    };
  }
  return STOCK_DIRECTORY[sym];
}

/**
 * Fast Single Quote Fetcher with proxy & TradingView Edge support
 */
export async function fetchSingleYahooQuote(symbol, timeoutMs = 3000) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  const targetSymbol = STOCK_DIRECTORY[upper]?.targetSymbol || upper;

  return coalesceAsync(`quote_${upper}`, async () => {
    // First try TradingView Scanner edge (natively supports CORS in production with 0 Cloudflare worker usage)
    try {
      const tvQuote = await fetchSingleTVQuote(targetSymbol);
      if (tvQuote) {
        if (targetSymbol !== upper) {
          runtimePriceStore.set(upper, { ...tvQuote, symbol: upper });
        }
        return tvQuote;
      }
    } catch (e) {}

    const isDev = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // 15-second edge cache bucket: enables Cloudflare to serve cached hits for concurrent users
    const timeWindow = Math.floor(Date.now() / 15000);
    const queryPath = `/v8/finance/chart/${encodeURIComponent(targetSymbol)}?interval=5m&range=1d&_w=${timeWindow}`;
    const candidateUrls = isDev
      ? [`/api/yahoo${queryPath}`, `${CLOUDFLARE_YAHOO_PROXY}${queryPath}`]
      : [`${CLOUDFLARE_YAHOO_PROXY}${queryPath}`];

    for (const endpoint of candidateUrls) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        recordCloudflareCall(endpoint, false);
        const res = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          continue;
        }

        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose || meta.previousClose;
        const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
        const change = Number((currentPrice - previousClose).toFixed(2));
        const changePercent = Number(((change / (previousClose || 1)) * 100).toFixed(2));

        const stockInfo = STOCK_DIRECTORY[upper] || STOCK_DIRECTORY[targetSymbol] || {};

        const isInd = targetSymbol.endsWith('.NS') || targetSymbol.endsWith('.BO') || meta.currency === 'INR';
        const quote = {
          symbol: upper,
          targetSymbol,
          name: stockInfo.name || meta.longName || meta.shortName || upper,
          currency: meta.currency || (isInd ? 'INR' : 'USD'),
          market: stockInfo.market || (isInd ? 'NSE' : 'US'),
          price: Number(currentPrice.toFixed(2)),
          change,
          changePercent,
          high: Number((meta.regularMarketDayHigh || currentPrice).toFixed(2)),
          low: Number((meta.regularMarketDayLow || currentPrice).toFixed(2)),
          open: Number((meta.regularMarketDayOpen || previousClose).toFixed(2)),
          previousClose: Number(previousClose.toFixed(2)),
          volume: stockInfo.volume || (meta.regularMarketVolume ? String(meta.regularMarketVolume) : '2.5M'),
          marketCap: stockInfo.marketCap || 'N/A',
          peRatio: stockInfo.peRatio || 'N/A',
          high52: meta.fiftyTwoWeekHigh || stockInfo.high52 || currentPrice * 1.15,
          low52: meta.fiftyTwoWeekLow || stockInfo.low52 || currentPrice * 0.8,
          sector: stockInfo.sector || 'Equities',
          timestamp: Date.now(),
          source: 'yahoo_edge_proxy',
        };

        // Register or update in STOCK_DIRECTORY so all components share exact live price
        if (!STOCK_DIRECTORY[upper]) {
          STOCK_DIRECTORY[upper] = {
            symbol: upper,
            targetSymbol: targetSymbol !== upper ? targetSymbol : undefined,
            ticker: upper.replace(/\.(NS|BO)$/, ''),
            name: quote.name,
            market: quote.market,
            currency: quote.currency,
            basePrice: quote.price,
            sector: quote.sector,
            high52: quote.high52,
            low52: quote.low52,
            volume: quote.volume,
          };
        } else {
          STOCK_DIRECTORY[upper].basePrice = quote.price;
        }

        runtimePriceStore.set(upper, quote);
        if (targetSymbol !== upper) {
          runtimePriceStore.set(targetSymbol, quote);
        }
        return quote;
      } catch (err) {
        clearTimeout(timeoutId);
      }
    }

    return runtimePriceStore.get(upper) || generateFallbackQuote(upper);
  });
}

/**
 * Authentic Historical & Intraday Candlestick Fetcher
 * Works seamlessly in both localhost dev AND production deployment
 */
export async function getStockHistoricalCandles(symbol, timeframe = '1D') {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  const targetSymbol = STOCK_DIRECTORY[upper]?.targetSymbol || upper;

  // 0. Instant recall from IndexedDB cache if available and fresh
  try {
    const cached = await getCandlesCache(upper, timeframe);
    if (cached && (Array.isArray(cached) ? cached.length > 0 : cached?.candles?.length > 0)) {
      const isIntraday = timeframe === '1D' || timeframe === '1W';
      const maxAgeMs = isIntraday ? 5 * 60 * 1000 : 4 * 60 * 60 * 1000;
      const cachedTime = cached.timestamp || cached.updatedAt || 0;
      if (Date.now() - cachedTime < maxAgeMs) {
        return cached;
      }
    }
  } catch (e) {
    // Continue to fresh computation
  }

  // 1. Retrieve the latest verified market metrics from TradingView Scanner or memory store
  let metrics = runtimePriceStore.get(upper) || runtimePriceStore.get(targetSymbol);
  if (!metrics || !metrics.price || (Date.now() - (metrics.timestamp || 0)) > 25000) {
    try {
      const live = await fetchSingleTVQuote(targetSymbol);
      if (live) metrics = live;
    } catch (e) {}
  }
  if (!metrics) {
    metrics = generateFallbackQuote(upper);
  }

  // 2. Fetch real historical bars via Cloudflare Edge Proxy (or local dev proxy)
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  let interval = '5m';
  let range = '1d';
  if (timeframe === '1D') { interval = '5m'; range = '1d'; }
  else if (timeframe === '1W') { interval = '15m'; range = '5d'; }
  else if (timeframe === '1M') { interval = '1d'; range = '1mo'; }
  else if (timeframe === '3M') { interval = '1d'; range = '3mo'; }
  else if (timeframe === '1Y') { interval = '1d'; range = '1y'; }

  const queryPath = `/v8/finance/chart/${encodeURIComponent(targetSymbol)}?interval=${interval}&range=${range}`;
  const candidateEndpoints = isDev
    ? [`/api/yahoo${queryPath}`, `${CLOUDFLARE_YAHOO_PROXY}${queryPath}`]
    : [`${CLOUDFLARE_YAHOO_PROXY}${queryPath}`];

  for (const endpoint of candidateEndpoints) {
    try {
      recordCloudflareCall(endpoint, false);
      const res = await fetch(endpoint);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (result && result.timestamp && result.indicators?.quote?.[0]) {
          const meta = result.meta || {};
          const timestamps = result.timestamp;
          const quotes = result.indicators.quote[0];
          const previousClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
          const candles = [];
          const isIntraday = timeframe === '1D' || timeframe === '1W';

          for (let i = 0; i < timestamps.length; i++) {
            const open = quotes.open[i];
            const high = quotes.high[i];
            const low = quotes.low[i];
            const close = quotes.close[i];
            const vol = quotes.volume ? quotes.volume[i] || 0 : 0;
            if (open == null || close == null || high == null || low == null) continue;

            const timeValue = isIntraday 
              ? timestamps[i] 
              : new Date(timestamps[i] * 1000).toISOString().split('T')[0];

            candles.push({
              time: timeValue,
              open: Number(open.toFixed(2)),
              high: Number(high.toFixed(2)),
              low: Number(low.toFixed(2)),
              close: Number(close.toFixed(2)),
              volume: vol,
            });
          }

          if (candles.length >= 10) {
            const finalRes = {
              candles,
              meta,
              previousClose: Number((previousClose || candles[0].open).toFixed(2)),
              dayHigh: meta.regularMarketDayHigh || Math.max(...candles.map((c) => c.high)),
              dayLow: meta.regularMarketDayLow || Math.min(...candles.map((c) => c.low)),
              currentPrice: meta.regularMarketPrice || candles[candles.length - 1].close,
              isIntraday,
              timestamp: Date.now(),
            };
            saveCandlesCache(upper, timeframe, finalRes);
            if (targetSymbol !== upper) {
              saveCandlesCache(targetSymbol, timeframe, finalRes);
            }
            return finalRes;
          }
        }
      }
    } catch (err) {
      // Continue to next candidate or fallback
    }
  }

  // 3. Client-Side Deterministic Microstructure Synthesis (100% zero server cost, zero backend)
  const result = synthesizeCandlesticks(upper, metrics, timeframe);
  saveCandlesCache(upper, timeframe, result);
  return result;
}

/**
 * High-Precision Market Candle Generator (Delegates to Client-Side Microstructure Engine)
 */
function generateCalibratedCandles(symbol, metrics, timeframe) {
  return synthesizeCandlesticks(symbol, metrics, timeframe);
}

/**
 * Level 2 Order Book Simulation
 */
export function getOrderBook(currentPrice, currencySymbol = '₹') {
  const base = currentPrice || 100;
  const bids = [];
  const asks = [];

  for (let i = 1; i <= 5; i++) {
    const bidPrice = Number((base * (1 - i * 0.001)).toFixed(2));
    const askPrice = Number((base * (1 + i * 0.001)).toFixed(2));
    const bidQty = Math.floor(100 + Math.random() * 1200);
    const askQty = Math.floor(100 + Math.random() * 1200);

    bids.push({ price: bidPrice, quantity: bidQty, total: Number((bidPrice * bidQty).toFixed(2)) });
    asks.push({ price: askPrice, quantity: askQty, total: Number((askPrice * askQty).toFixed(2)) });
  }

  return { bids, asks };
}

function generateFallbackQuote(symbol) {
  const isInd = symbol.endsWith('.NS');
  const cached = runtimePriceStore.get(symbol);
  if (cached && cached.price) return cached;

  const stock = STOCK_DIRECTORY[symbol] || {};
  const base = stock.basePrice || (isInd ? 100.00 : 50.00);

  return {
    symbol,
    name: stock.name || symbol,
    price: base,
    change: 0.00,
    changePercent: 0.00,
    high: stock.high52 ? Math.min(stock.high52, Number((base * 1.01).toFixed(2))) : Number((base * 1.01).toFixed(2)),
    low: stock.low52 ? Math.max(stock.low52, Number((base * 0.99).toFixed(2))) : Number((base * 0.99).toFixed(2)),
    open: base,
    previousClose: base,
    market: stock.market || (isInd ? 'NSE' : 'US'),
    currency: stock.currency || (isInd ? 'INR' : 'USD'),
    volume: stock.volume || '1M',
    marketCap: stock.marketCap || 'N/A',
    peRatio: stock.peRatio || 'N/A',
    high52: stock.high52 || Number((base * 1.15).toFixed(2)),
    low52: stock.low52 || Number((base * 0.85).toFixed(2)),
    sector: stock.sector || 'Equities',
    timestamp: Date.now(),
    source: 'directory_baseline',
  };
}
