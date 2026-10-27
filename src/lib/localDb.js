import Dexie from 'dexie';

/**
 * TraderVaultDB — Client-Side Local IndexedDB Engine
 * Zero backend requirement. 100% self-hosted, private, and offline resilient.
 */
export class TraderVaultDB extends Dexie {
  constructor() {
    super('TraderVaultDB');

    this.version(1).stores({
      watchlists: '++id, symbol, market, category, addedAt',
      journal: '++id, date, symbol, market, action, qty, entryPrice, exitPrice, pnl, tags, strategy',
      alerts: '++id, symbol, market, indicator, condition, targetValue, active, createdAt, lastTriggeredAt',
      strategies: '++id, name, type, stopLossPercent, takeProfitPercent, createdAt',
      backtests: '++id, timestamp, strategyName, symbol, timeframe, returnPercent, winRatePercent',
      workspaces: '++id, name, isDefault, layoutConfig',
    });

    this.version(2).stores({
      candlesCache: 'symbolTimeframe, symbol, timeframe, updatedAt',
    });
  }
}

export const db = new TraderVaultDB();

/**
 * Persistent Client-Side Candlestick Cache in IndexedDB (0ms instant recall)
 */
export async function saveCandlesCache(symbol, timeframe, data) {
  try {
    if (!symbol || !data) return;
    const symbolTimeframe = `${symbol.toUpperCase()}_${timeframe}`;
    await db.candlesCache.put({
      symbolTimeframe,
      symbol: symbol.toUpperCase(),
      timeframe,
      data,
      updatedAt: Date.now(),
    });
  } catch (err) {
    // Quota or incognito fallback
  }
}

export async function getCandlesCache(symbol, timeframe) {
  try {
    if (!symbol) return null;
    const symbolTimeframe = `${symbol.toUpperCase()}_${timeframe}`;
    const record = await db.candlesCache.get(symbolTimeframe);
    if (record && record.data) {
      return record.data;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * High-speed local profile and session persistence engine
 * Ensures 0ms offline-first profile loading and sync safety
 */
export const localDb = {
  async saveProfile(profile) {
    try {
      if (!profile) return;
      localStorage.setItem('paper_trading_user_profile', JSON.stringify(profile));
      const uid = profile.uid || profile.profile?.uid;
      if (uid) {
        localStorage.setItem(`paper_trading_profile_${uid}`, JSON.stringify(profile));
      }
    } catch (e) {
      console.warn('[TraderVaultDB] saveProfile catch:', e);
    }
  },
  async getProfile(uid) {
    try {
      const key = uid ? `paper_trading_profile_${uid}` : 'paper_trading_user_profile';
      const raw = localStorage.getItem(key) || localStorage.getItem('paper_trading_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
};

// Initialize default workspace and default watchlist items if empty
export async function seedInitialLocalDb() {
  try {
    const watchlistCount = await db.watchlists.count();
    if (watchlistCount === 0) {
      await db.watchlists.bulkAdd([
        { symbol: 'RELIANCE.NS', market: 'IN', category: 'Energy & Tech', addedAt: new Date().toISOString() },
        { symbol: 'TCS.NS', market: 'IN', category: 'IT Services', addedAt: new Date().toISOString() },
        { symbol: 'HDFCBANK.NS', market: 'IN', category: 'Banking', addedAt: new Date().toISOString() },
        { symbol: 'INFY.NS', market: 'IN', category: 'IT Services', addedAt: new Date().toISOString() },
        { symbol: 'AAPL', market: 'US', category: 'Consumer Tech', addedAt: new Date().toISOString() },
        { symbol: 'NVDA', market: 'US', category: 'Semiconductors & GPU', addedAt: new Date().toISOString() },
        { symbol: 'MSFT', market: 'US', category: 'Cloud & Software', addedAt: new Date().toISOString() },
        { symbol: 'TSLA', market: 'US', category: 'Automotive & CleanTech', addedAt: new Date().toISOString() },
      ]);
    }

    const strategiesCount = await db.strategies.count();
    if (strategiesCount === 0) {
      await db.strategies.bulkAdd([
        {
          name: 'EMA 9/21 Trend Crossover',
          type: 'TREND_FOLLOWING',
          indicator: 'EMA_CROSSOVER',
          fastPeriod: 9,
          slowPeriod: 21,
          stopLossPercent: 2.0,
          takeProfitPercent: 5.0,
          description: 'Enters long when 9 EMA crosses above 21 EMA. Exits when 9 crosses below 21.',
          createdAt: new Date().toISOString(),
        },
        {
          name: 'RSI 30/70 Mean Reversion',
          type: 'MEAN_REVERSION',
          indicator: 'RSI',
          oversoldThreshold: 30,
          overboughtThreshold: 70,
          stopLossPercent: 2.5,
          takeProfitPercent: 6.0,
          description: 'Enters long when RSI dips below 30 and hooks upward. Exits at RSI > 70 or target.',
          createdAt: new Date().toISOString(),
        },
        {
          name: 'Bollinger Band Squeeze Breakout',
          type: 'BREAKOUT',
          indicator: 'BOLLINGER',
          period: 20,
          stdDev: 2,
          stopLossPercent: 1.5,
          takeProfitPercent: 4.5,
          description: 'Enters on candle close outside lower band with return momentum.',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  } catch (err) {
    console.warn('[TraderVaultDB] Seed check error:', err);
  }
}

// Auto-seed on load
seedInitialLocalDb();
