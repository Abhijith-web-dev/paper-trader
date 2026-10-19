export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'admin';
  createdAt: number;
}

export interface UserPreferences {
  userId: string;
  country: string;            // "US", "IN", "UK", "EU", "JP", "AU"
  baseCurrency: string;       // "USD", "INR", "GBP", "EUR", "JPY", "AUD"
  preferredExchange: string;  // "NASDAQ", "NSE", "LSE", "TSE", etc.
  timezone: string;           // e.g. "Asia/Kolkata", "America/New_York", "Europe/London"
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  theme: 'light' | 'dark' | 'system';
  chartPreferences?: Record<string, unknown>;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  isDefault: boolean;
  createdAt: number;
}

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW' | 'PERCENT_CHANGE';
  status: 'ACTIVE' | 'TRIGGERED' | 'DISMISSED';
  triggeredAt?: number;
  createdAt: number;
}

export interface TradeJournalEntry {
  id: string;
  userId: string;
  accountId: string;
  orderId?: string;
  symbol: string;
  strategyTag: string;        // e.g. "Breakout", "Earnings Momentum", "Mean Reversion", "Value"
  entryRationale: string;
  intendedRiskAmount: number; // In account currency
  targetProfitAmount: number;
  postTradeReview?: string;
  lessonLearned?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'TRADING' | 'LEARNING' | 'RISK_MANAGEMENT' | 'BACKTESTING';
  isUnlocked: boolean;
  unlockedAt?: number;
}
