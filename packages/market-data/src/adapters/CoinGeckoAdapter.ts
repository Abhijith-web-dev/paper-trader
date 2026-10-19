import { MarketQuote, HistoricalCandle, CandleInterval } from '@globaltrade/shared';
import { BaseAdapter } from './BaseAdapter.js';

export class CoinGeckoAdapter implements BaseAdapter {
  readonly name = 'CoinGecko';
  private baseUrl = 'https://api.coingecko.com/api/v3';

  private symbolMap: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'ADA': 'cardano'
  };

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/ping`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const cleanSym = symbol.toUpperCase().replace('-USD', '');
    const coinId = this.symbolMap[cleanSym] || cleanSym.toLowerCase();

    try {
      const url = `${this.baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`CoinGecko HTTP error: ${res.status}`);
      }
      const data = await res.json();
      const coin = data[coinId];

      if (!coin) {
        throw new Error(`Symbol ${symbol} not found in CoinGecko`);
      }

      const price = Number(coin.usd.toFixed(2));
      const changePercent = Number((coin.usd_24h_change || 0).toFixed(2));
      const change = Number(((price * changePercent) / 100).toFixed(2));

      return {
        symbol: `${cleanSym}-USD`,
        price,
        change,
        changePercent,
        high: price,
        low: price,
        open: price - change,
        previousClose: price - change,
        volume: Number((coin.usd_24h_vol || 0).toFixed(0)),
        timestamp: (coin.last_updated_at || Math.floor(Date.now() / 1000)) * 1000,
        provider: this.name,
        isStale: false,
        marketStatus: 'OPEN', // Crypto trades 24/7
        currency: 'USD'
      };
    } catch (err: any) {
      throw new Error(`CoinGecko quote error for ${symbol}: ${err?.message || err}`);
    }
  }

  async getHistoricalCandles(symbol: string, interval: CandleInterval, rangeDays: number): Promise<HistoricalCandle[]> {
    const cleanSym = symbol.toUpperCase().replace('-USD', '');
    const coinId = this.symbolMap[cleanSym] || cleanSym.toLowerCase();

    try {
      const days = Math.min(Math.max(rangeDays, 1), 365);
      const url = `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const prices: [number, number][] = data.prices || [];

      // Convert point-in-time prices into synthetic candles if OHLC is not supplied directly
      return prices.map(([timeMs, price]) => ({
        time: Math.floor(timeMs / 1000),
        open: Number(price.toFixed(2)),
        high: Number((price * 1.002).toFixed(2)),
        low: Number((price * 0.998).toFixed(2)),
        close: Number(price.toFixed(2)),
        volume: 0
      }));
    } catch {
      return [];
    }
  }
}
