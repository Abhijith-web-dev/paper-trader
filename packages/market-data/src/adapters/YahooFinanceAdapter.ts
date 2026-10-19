import { MarketQuote, HistoricalCandle, CandleInterval } from '@globaltrade/shared';
import { BaseAdapter } from './BaseAdapter.js';

export class YahooFinanceAdapter implements BaseAdapter {
  readonly name = 'YahooFinance';
  private baseUrl = 'https://query2.finance.yahoo.com/v8/finance/chart';
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/AAPL?range=1d&interval=1d`, { headers: this.headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const sym = symbol.toUpperCase().trim();
    const url = `${this.baseUrl}/${encodeURIComponent(sym)}?range=1d&interval=1m`;

    try {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;

      if (!meta) {
        throw new Error(`No quote data returned for ${sym}`);
      }

      const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
      const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const change = meta.regularMarketPrice ? Number((meta.regularMarketPrice - prevClose).toFixed(2)) : 0;
      const changePercent = prevClose !== 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

      let marketStatus: MarketQuote['marketStatus'] = 'CLOSED';
      const now = Math.floor(Date.now() / 1000);
      const tradingPeriod = meta.currentTradingPeriod;

      if (tradingPeriod) {
        if (tradingPeriod.regular && now >= tradingPeriod.regular.start && now <= tradingPeriod.regular.end) {
          marketStatus = 'OPEN';
        } else if (tradingPeriod.pre && now >= tradingPeriod.pre.start && now <= tradingPeriod.pre.end) {
          marketStatus = 'PRE';
        } else if (tradingPeriod.post && now >= tradingPeriod.post.start && now <= tradingPeriod.post.end) {
          marketStatus = 'POST';
        }
      }

      return {
        symbol: sym,
        price: Number(price.toFixed(2)),
        change,
        changePercent,
        high: Number((meta.regularMarketDayHigh || price).toFixed(2)),
        low: Number((meta.regularMarketDayLow || price).toFixed(2)),
        open: Number((meta.chartPreviousClose || price).toFixed(2)),
        previousClose: Number(prevClose.toFixed(2)),
        volume: meta.regularMarketVolume || 0,
        timestamp: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
        provider: this.name,
        isStale: false,
        marketStatus,
        currency: meta.currency || 'USD'
      };
    } catch (err: any) {
      throw new Error(`YahooFinance quote error for ${sym}: ${err?.message || err}`);
    }
  }

  async getHistoricalCandles(symbol: string, interval: CandleInterval, rangeDays: number): Promise<HistoricalCandle[]> {
    const sym = symbol.toUpperCase().trim();
    let range = '1mo';
    let yfInterval = '1d';

    if (rangeDays <= 1) {
      range = '1d';
      yfInterval = '5m';
    } else if (rangeDays <= 5) {
      range = '5d';
      yfInterval = '15m';
    } else if (rangeDays <= 30) {
      range = '1mo';
      yfInterval = '1d';
    } else if (rangeDays <= 180) {
      range = '6mo';
      yfInterval = '1d';
    } else if (rangeDays <= 365) {
      range = '1y';
      yfInterval = '1d';
    } else {
      range = '5y';
      yfInterval = '1wk';
    }

    const url = `${this.baseUrl}/${encodeURIComponent(sym)}?range=${range}&interval=${yfInterval}`;

    try {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return [];
      const data = await res.json();
      const result = data?.chart?.result?.[0];

      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        return [];
      }

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators.quote[0];
      const candles: HistoricalCandle[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const close = quote.close?.[i];
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const volume = quote.volume?.[i] || 0;

        if (close != null && open != null && !isNaN(close) && !isNaN(open)) {
          candles.push({
            time: timestamps[i],
            open: Number(open.toFixed(2)),
            high: Number((high ?? open).toFixed(2)),
            low: Number((low ?? open).toFixed(2)),
            close: Number(close.toFixed(2)),
            volume
          });
        }
      }

      return candles;
    } catch {
      return [];
    }
  }
}
