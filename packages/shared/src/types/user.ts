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
  baseCurrency: string;       // "USD", "INR", "EUR"
  timezone: string;           // e.g. "Asia/Kolkata", "America/New_York"
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
