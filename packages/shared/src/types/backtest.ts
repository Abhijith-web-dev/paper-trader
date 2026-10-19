export type StrategyType = 'SMA_CROSSOVER' | 'RSI_REVERSAL' | 'MACD_MOMENTUM' | 'BUY_AND_HOLD';

export interface BacktestDatasetPreset {
  id: string;
  name: string;
  symbol: string;
  category: 'TECH_LEADERS' | 'INDIAN_GIANTS' | 'MARKET_INDICES' | 'CRYPTO' | 'FOREX';
  description: string;
  defaultStrategy: StrategyType;
  fastPeriod: number;
  slowPeriod: number;
  educationalNote: string;
}

export interface BacktestConfig {
  symbol: string;
  strategy: StrategyType;
  startDate?: string;         // YYYY-MM-DD
  endDate?: string;           // YYYY-MM-DD
  lookbackDays?: number;      // e.g. 90, 180, 365, 730 days
  initialCapital: number;
  fastPeriod?: number;        // e.g. 10 for SMA
  slowPeriod?: number;        // e.g. 50 for SMA
  rsiOversold?: number;       // e.g. 30
  rsiOverbought?: number;     // e.g. 70
  feeRatePercent?: number;    // e.g. 0.05%
  slippagePercent?: number;   // e.g. 0.05%
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
}

export interface EquityPoint {
  time: string;
  equity: number;
  drawdownPercent: number;
  benchmarkEquity: number;
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  totalReturnPercent: number;
  annualizedReturnPercent: number;
  benchmarkReturnPercent: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  winRatePercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  executedAt: number;
}
