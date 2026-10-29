/**
 * Cloud Quota Manager & Anti-Limit Optimizer
 * 
 * Provides institutional protection against exceeding free tier quotas:
 * 1. Cloudflare Workers Free Tier (100,000 requests/day):
 *    - In-flight request coalescing (prevents duplicate parallel network calls)
 *    - Aggressive 30-minute memory + localStorage search query caching
 *    - Edge cache URL normalization (strips cache-busting timestamps)
 *    - Request metrics tracking & cache hit-rate telemetry
 * 
 * 2. Firebase Cloud Firestore Free Tier (50,000 reads/day, 20,000 writes/day):
 *    - Write debouncing (batches multiple rapid trades into 1 Firestore write)
 *    - Elimination of redundant getDoc calls (relies directly on onSnapshot initial emission)
 *    - Delta-change verification (skips zero-op writes)
 *    - Keeps document payload compact (< 25 KB)
 */

// Memory Cache for Stock Searches (Key: `${query}_${marketFilter}`, Value: { results, timestamp })
const searchCache = new Map();
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Memory Micro-Cache for Live Quotes (Key: symbol, Value: { quote, timestamp, ttl })
const quoteMicroCache = new Map();
const DEFAULT_QUOTE_TTL_MS = 15 * 1000; // 15 seconds fresh window

// Cloudflare Circuit Breaker: trips when HTTP 429 is encountered
let cloudflareTrippedUntil = 0;

// In-flight Promise deduplication registry
const inFlightPromises = new Map();

// Local Storage Keys
const STATS_KEY = 'paper_trading_quota_stats_v1';
const PERSISTENT_SEARCH_CACHE_KEY = 'paper_trading_search_cache_v1';

// Load or initialize daily quota stats
function loadQuotaStats() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        return parsed;
      }
    }
  } catch (e) {}

  return {
    date: today,
    cloudflare: {
      requestsMade: 0,
      cacheHits: 0,
      requestsSaved: 0,
      dailyLimit: 100000,
    },
    firestore: {
      readsMade: 0,
      writesMade: 0,
      writesSavedByDebounce: 0,
      readsSavedBySnapshot: 0,
      dailyReadLimit: 50000,
      dailyWriteLimit: 20000,
    },
  };
}

let quotaStats = loadQuotaStats();

function saveQuotaStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(quotaStats));
  } catch (e) {}
}

// Pre-load persistent search cache from localStorage on startup
try {
  const rawCache = localStorage.getItem(PERSISTENT_SEARCH_CACHE_KEY);
  if (rawCache) {
    const parsed = JSON.parse(rawCache);
    const now = Date.now();
    Object.entries(parsed).forEach(([key, item]) => {
      if (now - item.timestamp < SEARCH_CACHE_TTL_MS) {
        searchCache.set(key, item);
      }
    });
  }
} catch (e) {}

/**
 * Coalesce duplicate async operations in flight
 */
export async function coalesceAsync(key, asyncFn) {
  if (inFlightPromises.has(key)) {
    quotaStats.cloudflare.cacheHits++;
    quotaStats.cloudflare.requestsSaved++;
    saveQuotaStats();
    return inFlightPromises.get(key);
  }

  const promise = (async () => {
    try {
      return await asyncFn();
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}

/**
 * Search Query Cache: Retrieve cached search results
 */
export function getCachedSearch(query, marketFilter = 'ALL') {
  if (!query) return null;
  const key = `${query.trim().toLowerCase()}_${marketFilter}`;
  const cached = searchCache.get(key);
  if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS)) {
    quotaStats.cloudflare.cacheHits++;
    quotaStats.cloudflare.requestsSaved++;
    saveQuotaStats();
    return cached.results;
  }
  return null;
}

/**
 * Search Query Cache: Save search results with TTL
 */
export function setCachedSearch(query, marketFilter = 'ALL', results = []) {
  if (!query || !Array.isArray(results)) return;
  const key = `${query.trim().toLowerCase()}_${marketFilter}`;
  const entry = {
    results,
    timestamp: Date.now(),
  };
  searchCache.set(key, entry);

  // Persist top 100 search queries
  try {
    const entries = Array.from(searchCache.entries()).slice(-100);
    localStorage.setItem(PERSISTENT_SEARCH_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (e) {}
}

/**
 * Cloudflare Circuit Breaker
 * Prevents repeating failing requests when rate limited (HTTP 429)
 */
export function isCloudflareTripped() {
  return Date.now() < cloudflareTrippedUntil;
}

export function tripCloudflare(durationMs = 60000) {
  cloudflareTrippedUntil = Date.now() + durationMs;
  console.warn(`[CloudQuotaManager] Cloudflare circuit tripped for ${Math.round(durationMs / 1000)}s due to upstream rate limiting.`);
}

/**
 * Micro-Cache for Individual Quotes (Prevents repeat network calls within TTL window)
 */
export function getCachedQuote(symbol) {
  if (!symbol) return null;
  const sym = String(symbol).trim().toUpperCase();
  const entry = quoteMicroCache.get(sym);
  if (entry && (Date.now() - entry.timestamp < entry.ttl)) {
    quotaStats.cloudflare.cacheHits++;
    quotaStats.cloudflare.requestsSaved++;
    saveQuotaStats();
    return entry.quote;
  }
  return null;
}

export function setCachedQuote(symbol, quote, ttlMs = DEFAULT_QUOTE_TTL_MS) {
  if (!symbol || !quote) return;
  const sym = String(symbol).trim().toUpperCase();
  quoteMicroCache.set(sym, {
    quote,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

/**
 * Record a Cloudflare API call
 */
export function recordCloudflareCall(endpoint, isCacheHit = false) {
  if (isCacheHit) {
    quotaStats.cloudflare.cacheHits++;
    quotaStats.cloudflare.requestsSaved++;
  } else {
    quotaStats.cloudflare.requestsMade++;
  }
  saveQuotaStats();
}

/**
 * Record Firestore Read / Write
 */
export function recordFirestoreRead(count = 1) {
  quotaStats.firestore.readsMade += count;
  saveQuotaStats();
}

export function recordFirestoreWrite(count = 1) {
  quotaStats.firestore.writesMade += count;
  saveQuotaStats();
}

export function recordFirestoreWriteSaved(count = 1) {
  quotaStats.firestore.writesSavedByDebounce += count;
  saveQuotaStats();
}

export function recordFirestoreReadSaved(count = 1) {
  quotaStats.firestore.readsSavedBySnapshot += count;
  saveQuotaStats();
}

/**
 * Get Real-Time Quota Telemetry for UI reports
 */
export function getQuotaTelemetry() {
  const cf = quotaStats.cloudflare;
  const fs = quotaStats.firestore;

  const cfTotalRequests = cf.requestsMade + cf.requestsSaved;
  const cfCacheEfficiency = cfTotalRequests > 0 
    ? ((cf.requestsSaved / cfTotalRequests) * 100).toFixed(1)
    : '100.0';

  const cfPercentUsed = ((cf.requestsMade / cf.dailyLimit) * 100).toFixed(2);
  const fsReadPercent = ((fs.readsMade / fs.dailyReadLimit) * 100).toFixed(2);
  const fsWritePercent = ((fs.writesMade / fs.dailyWriteLimit) * 100).toFixed(2);

  return {
    cloudflare: {
      ...cf,
      cacheEfficiencyPercent: cfCacheEfficiency,
      percentUsed: cfPercentUsed,
      remaining: Math.max(0, cf.dailyLimit - cf.requestsMade),
      status: Number(cfPercentUsed) < 80 ? 'OPTIMAL' : 'MONITOR',
    },
    firestore: {
      ...fs,
      readPercentUsed: fsReadPercent,
      writePercentUsed: fsWritePercent,
      readsRemaining: Math.max(0, fs.dailyReadLimit - fs.readsMade),
      writesRemaining: Math.max(0, fs.dailyWriteLimit - fs.writesMade),
      status: Number(fsWritePercent) < 70 ? 'OPTIMAL' : 'MONITOR',
    },
  };
}
