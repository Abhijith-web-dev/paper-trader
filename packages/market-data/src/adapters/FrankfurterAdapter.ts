import { CurrencyRate } from '@globaltrade/shared';
import { BaseAdapter } from './BaseAdapter.js';

export class FrankfurterAdapter implements BaseAdapter {
  readonly name = 'Frankfurter (ECB)';
  private baseUrl = 'https://api.frankfurter.app';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/latest?from=USD&to=EUR`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(symbol: string): Promise<any> {
    throw new Error('Frankfurter only provides foreign exchange rates');
  }

  async getHistoricalCandles(): Promise<any> {
    throw new Error('Frankfurter does not provide equity OHLCV candles');
  }

  async getCurrencyRate(base: string, quote: string): Promise<CurrencyRate> {
    const baseCode = base.toUpperCase();
    const quoteCode = quote.toUpperCase();

    if (baseCode === quoteCode) {
      return {
        base: baseCode,
        quote: quoteCode,
        rate: 1.0,
        timestamp: Date.now(),
        source: this.name,
        isDelayed: false
      };
    }

    try {
      const url = `${this.baseUrl}/latest?from=${baseCode}&to=${quoteCode}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const rate = data.rates[quoteCode];

      if (typeof rate !== 'number') {
        throw new Error(`Invalid rate returned for ${baseCode}/${quoteCode}`);
      }

      return {
        base: baseCode,
        quote: quoteCode,
        rate: Number(rate.toFixed(4)),
        timestamp: new Date(data.date).getTime() || Date.now(),
        source: this.name,
        isDelayed: false
      };
    } catch (err: any) {
      throw new Error(`Failed to fetch FX rate from Frankfurter: ${err?.message || err}`);
    }
  }

  async getHistoricalRates(base: string, quote: string, days: number = 30): Promise<{ date: string; rate: number }[]> {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    try {
      const url = `${this.baseUrl}/${startStr}..${endStr}?from=${base.toUpperCase()}&to=${quote.toUpperCase()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const rates = data.rates || {};

      return Object.entries(rates).map(([date, obj]: [string, any]) => ({
        date,
        rate: Number(obj[quote.toUpperCase()] || 0)
      }));
    } catch {
      return [];
    }
  }
}
