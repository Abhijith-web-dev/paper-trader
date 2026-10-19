export type AssetClass = 'EQUITY' | 'ETF' | 'INDEX' | 'FOREX' | 'CRYPTO' | 'COMMODITY';

export type ExchangeCode = 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'FOREX' | 'CRYPTO' | 'COMMODITY';

export interface Instrument {
  id: string;
  symbol: string;             // e.g. "AAPL", "RELIANCE.NS", "USD/INR", "BTC"
  name: string;               // e.g. "Apple Inc.", "Reliance Industries Ltd."
  exchange: ExchangeCode;
  country: string;            // e.g. "US", "IN", "GLOBAL"
  assetClass: AssetClass;
  quoteCurrency: string;      // e.g. "USD", "INR", "EUR"
  providerSymbol: string;     // e.g. "AAPL", "RELIANCE.NS"
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp: number;          // Epoch milliseconds
  provider: string;           // e.g. "YahooFinance", "Frankfurter", "CoinGecko"
  isStale: boolean;
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE' | 'POST' | 'UNKNOWN';
  currency: string;
}

export interface HistoricalCandle {
  time: number;               // UNIX timestamp in seconds or epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';
export type CandleInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo';

export interface CurrencyRate {
  base: string;               // e.g. "USD"
  quote: string;              // e.g. "INR"
  rate: number;               // e.g. 86.85
  timestamp: number;
  source: string;             // "Frankfurter / European Central Bank"
  isDelayed: boolean;
}
