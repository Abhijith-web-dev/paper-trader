export interface VirtualAccount {
  id: string;
  userId: string;
  name: string;
  baseCurrency: string;       // "USD", "INR", "EUR"
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
  | 'DIVIDEND';

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
  unrealizedPnl: number;
  unrealizedPnlPercent?: number;
  realizedPnl: number;
  totalCost: number;
  marketValue: number;
  updatedAt: number;
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
}
