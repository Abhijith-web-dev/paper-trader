export interface VirtualAccount {
  id: string;
  userId: string;
  name: string;
  countryCode: string;        // "US", "IN", "UK", "EU", "JP", "AU"
  baseCurrency: string;       // "USD", "INR", "GBP", "EUR", "JPY", "AUD"
  initialBalance: number;
  availableCash: number;
  reservedCash: number;
  createdAt: number;
  updatedAt: number;
}

export type LedgerTransactionType = 
  | 'INITIAL_DEPOSIT'
  | 'ORDER_HOLD'
  | 'ORDER_RELEASE'
  | 'BUY_EXECUTION'
  | 'SELL_EXECUTION'
  | 'FEE'
  | 'DIVIDEND'
  | 'ADMIN_CORRECTION';

export interface LedgerEntry {
  id: string;
  accountId: string;
  userId: string;
  type: LedgerTransactionType;
  amount: number;             // Positive for inflows, negative for outflows
  balanceAfter: number;
  referenceId?: string;       // Order ID or Transfer ID
  idempotencyKey: string;
  description: string;
  timestamp: number;
}

export interface Position {
  id: string;
  accountId: string;
  userId: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  currency: string;           // Native instrument currency e.g. "INR", "USD", "GBP"
  unrealizedPnl: number;
  unrealizedPnlPercent?: number;
  realizedPnl: number;
  totalCost: number;
  marketValue: number;
  convertedMarketValue?: number; // In account's reporting currency
  fxConversionRate?: number;
  updatedAt: number;
}

export interface CurrencyExposure {
  currency: string;
  marketValue: number;
  percentage: number;
}

export interface PortfolioRiskAnalysis {
  concentrationRisk: 'LOW' | 'MODERATE' | 'HIGH';
  topHoldingSymbol: string;
  topHoldingWeightPercent: number;
  currencyExposures: CurrencyExposure[];
  warnings: string[];
}

export interface PortfolioSummary {
  accountId: string;
  baseCurrency: string;
  totalEquity: number;
  availableCash: number;
  reservedCash: number;
  investedValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  dayChange: number;
  dayChangePercent: number;
  positionsCount: number;
  riskAnalysis?: PortfolioRiskAnalysis;
}
