import { MarketQuote, HistoricalCandle, CandleInterval, CurrencyRate } from '@globaltrade/shared';

export interface BaseAdapter {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getQuote(symbol: string): Promise<MarketQuote>;
  getHistoricalCandles(symbol: string, interval: CandleInterval, rangeDays: number): Promise<HistoricalCandle[]>;
  getCurrencyRate?(base: string, quote: string): Promise<CurrencyRate>;
}
