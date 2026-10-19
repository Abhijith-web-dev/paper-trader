export type AssetClass = 'EQUITY' | 'ETF' | 'INDEX' | 'FOREX' | 'CRYPTO' | 'COMMODITY';

export type ExchangeCode = 
  | 'NASDAQ' 
  | 'NYSE' 
  | 'NSE' 
  | 'BSE' 
  | 'LSE' 
  | 'TSE' 
  | 'EURONEXT' 
  | 'ASX' 
  | 'FOREX' 
  | 'CRYPTO' 
  | 'COMMODITY';

export interface Instrument {
  id: string;
  symbol: string;             // e.g. "AAPL", "RELIANCE.NS", "SHEL.L", "7203.T"
  name: string;               // e.g. "Apple Inc.", "Reliance Industries Ltd."
  exchange: ExchangeCode;
  country: string;            // e.g. "US", "IN", "UK", "JP", "EU", "AU", "GLOBAL"
  assetClass: AssetClass;
  quoteCurrency: string;      // e.g. "USD", "INR", "GBP", "JPY", "EUR", "AUD"
  providerSymbol: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface MarketCoverageInfo {
  exchange: ExchangeCode;
  name: string;
  country: string;
  currency: string;
  timezone: string;
  marketHours: string;
  supportedOrderTypes: string[];
  dataProvider: string;
  dataFreshness: 'REAL_TIME' | 'DELAYED_15M' | 'END_OF_DAY';
  historicalDepth: string;
  limitations: string;
  sampleTickers: string[];
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
  exchange?: string;
  feedType?: 'REAL_TIME' | 'DELAYED' | 'EOD' | 'CACHED';
}

export interface HistoricalCandle {
  time: number;               // UNIX timestamp in seconds or epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';
export type CandleInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo';

export interface CurrencyRate {
  base: string;               // e.g. "USD"
  quote: string;              // e.g. "INR"
  rate: number;               // e.g. 94.96
  timestamp: number;
  source: string;             // "Frankfurter / European Central Bank"
  isDelayed: boolean;
}

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  defaultStartingBalance: number;
  preferredExchange: ExchangeCode;
  timezone: string;
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$', defaultStartingBalance: 100000, preferredExchange: 'NASDAQ', timezone: 'America/New_York' },
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹', defaultStartingBalance: 1000000, preferredExchange: 'NSE', timezone: 'Asia/Kolkata' },
  { code: 'UK', name: 'United Kingdom', currency: 'GBP', symbol: '£', defaultStartingBalance: 100000, preferredExchange: 'LSE', timezone: 'Europe/London' },
  { code: 'EU', name: 'European Union', currency: 'EUR', symbol: '€', defaultStartingBalance: 100000, preferredExchange: 'EURONEXT', timezone: 'Europe/Paris' },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥', defaultStartingBalance: 10000000, preferredExchange: 'TSE', timezone: 'Asia/Tokyo' },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$', defaultStartingBalance: 100000, preferredExchange: 'ASX', timezone: 'Australia/Sydney' }
];
