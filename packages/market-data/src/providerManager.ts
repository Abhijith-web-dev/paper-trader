import { MarketQuote, HistoricalCandle, CandleInterval, CurrencyRate, Instrument } from '@globaltrade/shared';
import { BaseAdapter } from './adapters/BaseAdapter.js';
import { YahooFinanceAdapter } from './adapters/YahooFinanceAdapter.js';
import { FrankfurterAdapter } from './adapters/FrankfurterAdapter.js';
import { CoinGeckoAdapter } from './adapters/CoinGeckoAdapter.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class ProviderManager {
  private yahooAdapter: YahooFinanceAdapter;
  private frankfurterAdapter: FrankfurterAdapter;
  private coinGeckoAdapter: CoinGeckoAdapter;
  private quoteCache: Map<string, CacheEntry<MarketQuote>> = new Map();
  private fxCache: Map<string, CacheEntry<CurrencyRate>> = new Map();

  constructor() {
    this.yahooAdapter = new YahooFinanceAdapter();
    this.frankfurterAdapter = new FrankfurterAdapter();
    this.coinGeckoAdapter = new CoinGeckoAdapter();
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const sym = symbol.toUpperCase().trim();
    const cacheKey = `QUOTE:${sym}`;
    const cached = this.quoteCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < cached.ttlMs) {
      return cached.data;
    }

    try {
      let quote: MarketQuote;

      if (sym.startsWith('BTC') || sym.startsWith('ETH') || sym.startsWith('SOL') || sym.endsWith('-USD')) {
        quote = await this.coinGeckoAdapter.getQuote(sym);
      } else {
        quote = await this.yahooAdapter.getQuote(sym);
      }

      this.quoteCache.set(cacheKey, {
        data: quote,
        timestamp: Date.now(),
        ttlMs: 5000 // 5 seconds fresh TTL
      });

      return quote;
    } catch (err: any) {
      // If error occurs and we have a cached version, mark as stale
      if (cached) {
        return {
          ...cached.data,
          isStale: true
        };
      }
      throw err;
    }
  }

  async getHistoricalCandles(symbol: string, interval: CandleInterval = '1d', rangeDays: number = 30): Promise<HistoricalCandle[]> {
    const sym = symbol.toUpperCase().trim();
    if (sym.startsWith('BTC') || sym.startsWith('ETH') || sym.startsWith('SOL')) {
      return this.coinGeckoAdapter.getHistoricalCandles(sym, interval, rangeDays);
    }
    return this.yahooAdapter.getHistoricalCandles(sym, interval, rangeDays);
  }

  async getCurrencyRate(base: string, quote: string): Promise<CurrencyRate> {
    const pairKey = `${base.toUpperCase()}_${quote.toUpperCase()}`;
    const cached = this.fxCache.get(pairKey);

    if (cached && (Date.now() - cached.timestamp) < cached.ttlMs) {
      return cached.data;
    }

    const rate = await this.frankfurterAdapter.getCurrencyRate(base, quote);
    this.fxCache.set(pairKey, {
      data: rate,
      timestamp: Date.now(),
      ttlMs: 60000 // 60 seconds TTL for foreign exchange
    });

    return rate;
  }

  async getHistoricalFxRates(base: string, quote: string, days: number = 30) {
    return this.frankfurterAdapter.getHistoricalRates(base, quote, days);
  }
}
