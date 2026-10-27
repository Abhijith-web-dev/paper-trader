import { 
  STOCK_DIRECTORY, 
  fetchSingleYahooQuote, 
  runtimePriceStore, 
  CLOUDFLARE_YAHOO_PROXY,
  registerDynamicStock 
} from './yahooFinance.js';
import {
  getCachedSearch,
  setCachedSearch,
  recordCloudflareCall,
  coalesceAsync
} from './cloudQuotaManager.js';

/**
 * Universal Global Equities Search Engine
 * Searches 10,000+ equities across Indian (NSE/BSE) and US (NASDAQ/NYSE/AMEX) markets.
 * - 0ms instant local directory matching
 * - Direct Cloudflare Edge Proxy search for dev & production environments
 * - Intelligent ticker normalization (handles NSE suffixes .NS/.BO and SME suffixes like -SM.NS)
 * - Auto-mastering: dynamically seeds new stocks into STOCK_DIRECTORY & price cache
 */
export async function searchGlobalEquities(query, marketFilter = 'ALL') {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  const rawQuery = query.trim();

  // 0. Instant Cache Recall (0.00ms, 0 Cloudflare worker calls)
  const cachedHit = getCachedSearch(rawQuery, marketFilter);
  if (cachedHit && cachedHit.length > 0) {
    return cachedHit;
  }

  const q = rawQuery.toLowerCase();

  // 1. Instant match in local directory (0ms latency)
  const localMatches = Object.values(STOCK_DIRECTORY)
    .filter((s) => {
      const symMatch = (s.symbol && s.symbol.toLowerCase().includes(q)) || 
                       (s.ticker && s.ticker.toLowerCase().includes(q));
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const sectorMatch = (s.sector || '').toLowerCase().includes(q);

      if (marketFilter === 'NSE' && s.market !== 'NSE') return false;
      if (marketFilter === 'US' && s.market !== 'US') return false;

      return symMatch || nameMatch || sectorMatch;
    })
    .map((s) => ({
      symbol: s.symbol,
      ticker: s.ticker || s.symbol.replace(/\.(NS|BO)$/, ''),
      name: s.name,
      market: s.market,
      currency: s.currency,
      basePrice: s.basePrice,
      sector: s.sector || 'Equities',
      isLocal: true,
    }));

  // 2. Query Remote Search API via Cloudflare Edge Proxy
  let remoteMatches = [];
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Multi-term generation: Strip exchange suffix if present so GOLDSTAR.NS searches GOLDSTAR
  const cleanTicker = rawQuery.replace(/\.(NS|BO)$/i, '').trim();
  const searchTerms = [rawQuery];
  if (cleanTicker && cleanTicker.toLowerCase() !== rawQuery.toLowerCase()) {
    searchTerms.push(cleanTicker);
  }

  const fetchRemote = async (searchTerm) => {
    const queryPath = `/v1/finance/search?q=${encodeURIComponent(searchTerm)}&quotesCount=15&newsCount=0`;
    const candidateUrls = isDev
      ? [`/api/yahoo${queryPath}`, `${CLOUDFLARE_YAHOO_PROXY}${queryPath}`]
      : [`${CLOUDFLARE_YAHOO_PROXY}${queryPath}`];

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        recordCloudflareCall(url, false);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data?.quotes)) {
            return data.quotes;
          }
        }
      } catch (err) {
        // try next candidate url
      }
    }
    return [];
  };

  try {
    const quoteArrays = await Promise.all(searchTerms.map((t) => fetchRemote(t)));
    const rawQuotes = quoteArrays.flat();

    const seenRemoteSymbols = new Set();
    remoteMatches = rawQuotes
      .filter((item) => {
        if (!item || !item.symbol) return false;
        if (seenRemoteSymbols.has(item.symbol)) return false;
        seenRemoteSymbols.add(item.symbol);

        // Filter to equities and ETFs
        const isEquity =
          item.quoteType === 'EQUITY' ||
          item.quoteType === 'ETF' ||
          item.typeDisp === 'Equity' ||
          item.typeDisp === 'ETF' ||
          !item.quoteType;
        if (!isEquity) return false;

        const isIndian =
          item.symbol.endsWith('.NS') ||
          item.symbol.endsWith('.BO') ||
          item.exchDisp === 'NSE' ||
          item.exchDisp === 'BSE' ||
          item.exchange === 'NSI' ||
          item.exchange === 'BOM';

        if (marketFilter === 'NSE' && !isIndian) return false;
        if (marketFilter === 'US' && isIndian) return false;

        return true;
      })
      .map((item) => {
        const isIndian =
          item.symbol.endsWith('.NS') ||
          item.symbol.endsWith('.BO') ||
          item.exchDisp === 'NSE' ||
          item.exchDisp === 'BSE' ||
          item.exchange === 'NSI' ||
          item.exchange === 'BOM';

        const market = isIndian ? 'NSE' : 'US';
        const currency = isIndian ? 'INR' : 'USD';
        const ticker = item.symbol.replace(/\.(NS|BO)$/, '');
        const name = item.longname || item.shortname || item.symbol;
        const estPrice = item.regularMarketPrice || (isIndian ? 50 : 100);

        // Auto-Master: Dynamically register with STOCK_DIRECTORY so all components recognize it
        registerDynamicStock({
          symbol: item.symbol,
          ticker,
          name,
          market,
          currency,
          price: estPrice,
          sector: item.sector || item.industry || 'Equities',
          exchange: item.exchDisp || item.exchange,
        });

        // Fire background quote fetch to seed live price into runtime store
        fetchSingleYahooQuote(item.symbol, 3000).catch(() => {});

        return {
          symbol: item.symbol,
          ticker,
          name,
          market,
          currency,
          exchange: item.exchDisp || item.exchange,
          sector: item.sector || item.industry || 'Equities',
          isLocal: false,
        };
      });
  } catch (err) {
    // Local matches remain fully responsive
  }

  // 3. Fallback: If no matches yet and input looks like a valid ticker code
  if (localMatches.length === 0 && remoteMatches.length === 0 && /^[A-Za-z0-9_.-]{2,15}$/.test(rawQuery)) {
    const upper = rawQuery.toUpperCase();
    const isInd = upper.endsWith('.NS') || upper.endsWith('.BO');
    const directSymbol = isInd ? upper : (marketFilter === 'NSE' ? `${upper}.NS` : upper);
    const directTicker = directSymbol.replace(/\.(NS|BO)$/, '');

    registerDynamicStock({
      symbol: directSymbol,
      ticker: directTicker,
      name: `${directTicker} (${isInd ? 'NSE' : 'US'})`,
      market: isInd ? 'NSE' : 'US',
      currency: isInd ? 'INR' : 'USD',
      price: isInd ? 50 : 100,
      sector: 'Equities',
    });
    fetchSingleYahooQuote(directSymbol, 3000).catch(() => {});

    remoteMatches.push({
      symbol: directSymbol,
      ticker: directTicker,
      name: `${directTicker} Equity`,
      market: isInd ? 'NSE' : 'US',
      currency: isInd ? 'INR' : 'USD',
      exchange: isInd ? 'NSE' : 'NASDAQ',
      sector: 'Equities',
      isLocal: false,
    });
  }

  // 4. Deduplicate by symbol (prefer local directory details when available)
  const seen = new Set();
  const merged = [];

  for (const item of [...localMatches, ...remoteMatches]) {
    if (!seen.has(item.symbol)) {
      seen.add(item.symbol);
      merged.push(item);
    }
  }

  // Save to 30-minute persistent search cache (drastically saves Cloudflare Worker quotas)
  setCachedSearch(rawQuery, marketFilter, merged);

  return merged;
}

/**
 * Fetch real-time market quote and fundamentals for any stock
 */
export async function fetchLiveQuoteAnyStock(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  const targetSymbol = STOCK_DIRECTORY[upper]?.targetSymbol || upper;
  try {
    const q = await fetchSingleYahooQuote(targetSymbol, 4000);
    if (q && targetSymbol !== upper) {
      runtimePriceStore.set(upper, { ...q, symbol: upper });
    }
    return q;
  } catch (err) {
    console.warn(`[StockSearchEngine] Could not fetch quote for ${symbol}:`, err);
    return null;
  }
}
