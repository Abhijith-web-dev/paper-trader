import { 
  FinancialMath, 
  LedgerEntry, 
  MarketQuote, 
  Order, 
  PlaceOrderInput, 
  Position, 
  PriceAlert, 
  Trade, 
  UserPreferences, 
  UserProfile, 
  VirtualAccount, 
  Watchlist, 
  BacktestResult 
} from '@globaltrade/shared';
import { 
  LedgerAccounting, 
  MatchingEngine, 
  OrderStateMachine, 
  PnlCalculator 
} from '@globaltrade/trading-engine';
import { admin, isFirebaseConfigured } from '../config/firebaseAdmin.js';

// In-Memory fallback store for local development or offline execution
class InMemoryStore {
  users: Map<string, UserProfile> = new Map();
  preferences: Map<string, UserPreferences> = new Map();
  accounts: Map<string, VirtualAccount> = new Map();
  accountByUser: Map<string, string> = new Map();
  ledger: Map<string, LedgerEntry[]> = new Map();
  orders: Map<string, Order> = new Map();
  positions: Map<string, Map<string, Position>> = new Map(); // accountId -> (symbol -> Position)
  watchlists: Map<string, Watchlist[]> = new Map();
  alerts: Map<string, PriceAlert[]> = new Map();
  backtests: Map<string, BacktestResult[]> = new Map();
  idempotencyKeys: Set<string> = new Set();
}

const memory = new InMemoryStore();
const matchingEngine = new MatchingEngine(0.05, 0.05);

export class TradingStore {
  private static firestore = isFirebaseConfigured ? admin.firestore() : null;

  // --- Identity & Preferences ---
  static async getUser(userId: string): Promise<UserProfile | null> {
    if (this.firestore) {
      const doc = await this.firestore.collection('users').doc(userId).get();
      return doc.exists ? (doc.data() as UserProfile) : null;
    }
    return memory.users.get(userId) || null;
  }

  static async upsertUser(user: UserProfile): Promise<void> {
    if (this.firestore) {
      await this.firestore.collection('users').doc(user.id).set(user, { merge: true });
      return;
    }
    memory.users.set(user.id, user);
  }

  static async getPreferences(userId: string): Promise<UserPreferences> {
    if (this.firestore) {
      const doc = await this.firestore.collection('user_preferences').doc(userId).get();
      if (doc.exists) return doc.data() as UserPreferences;
    } else {
      const existing = memory.preferences.get(userId);
      if (existing) return existing;
    }

    const defaultPrefs: UserPreferences = {
      userId,
      baseCurrency: 'USD',
      timezone: 'America/New_York',
      experienceLevel: 'BEGINNER',
      theme: 'dark'
    };
    await this.updatePreferences(userId, defaultPrefs);
    return defaultPrefs;
  }

  static async updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...prefs, userId };
    if (this.firestore) {
      await this.firestore.collection('user_preferences').doc(userId).set(updated, { merge: true });
    } else {
      memory.preferences.set(userId, updated);
    }
    return updated;
  }

  // --- Virtual Account & Balance ---
  static async getVirtualAccount(userId: string): Promise<VirtualAccount> {
    if (this.firestore) {
      const snap = await this.firestore.collection('virtual_accounts')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!snap.empty) {
        return snap.docs[0].data() as VirtualAccount;
      }
    } else {
      const accId = memory.accountByUser.get(userId);
      if (accId && memory.accounts.has(accId)) {
        return memory.accounts.get(accId)!;
      }
    }

    // Initialize virtual account if not present
    return this.initializeVirtualAccount(userId, 'USD', 100000);
  }

  static async initializeVirtualAccount(
    userId: string, 
    baseCurrency: string = 'USD', 
    initialBalance: number = 100000
  ): Promise<VirtualAccount> {
    const accountId = `acc_${userId.substring(0, 8)}_${Date.now()}`;
    const newAccount: VirtualAccount = {
      id: accountId,
      userId,
      name: 'Default Virtual Portfolio',
      baseCurrency,
      initialBalance,
      availableCash: initialBalance,
      reservedCash: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const { updatedAccount, ledgerEntry } = LedgerAccounting.createInitialDeposit(
      newAccount, 
      `init_deposit_${accountId}`
    );

    if (this.firestore) {
      const batch = this.firestore.batch();
      const accRef = this.firestore.collection('virtual_accounts').doc(accountId);
      const ledRef = this.firestore.collection('virtual_account_ledger').doc(ledgerEntry.id);
      batch.set(accRef, updatedAccount);
      batch.set(ledRef, ledgerEntry);
      await batch.commit();
    } else {
      memory.accounts.set(accountId, updatedAccount);
      memory.accountByUser.set(userId, accountId);
      memory.ledger.set(accountId, [ledgerEntry]);
      memory.positions.set(accountId, new Map());
    }

    return updatedAccount;
  }

  static async getLedger(accountId: string): Promise<LedgerEntry[]> {
    if (this.firestore) {
      const snap = await this.firestore.collection('virtual_account_ledger')
        .where('accountId', '==', accountId)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      return snap.docs.map(d => d.data() as LedgerEntry);
    }
    return (memory.ledger.get(accountId) || []).slice().reverse();
  }

  static async getOrders(accountId: string): Promise<Order[]> {
    if (this.firestore) {
      const snap = await this.firestore.collection('orders')
        .where('accountId', '==', accountId)
        .orderBy('placedAt', 'desc')
        .limit(100)
        .get();
      return snap.docs.map(d => d.data() as Order);
    }
    return Array.from(memory.orders.values())
      .filter(o => o.accountId === accountId)
      .sort((a, b) => b.placedAt - a.placedAt);
  }

  static async getPositions(accountId: string): Promise<Position[]> {
    if (this.firestore) {
      const snap = await this.firestore.collection('positions')
        .where('accountId', '==', accountId)
        .where('quantity', '>', 0)
        .get();
      return snap.docs.map(d => d.data() as Position);
    }
    const map = memory.positions.get(accountId) || new Map();
    return Array.from(map.values()).filter(p => p.quantity > 0);
  }

  // --- Atomic Trade Execution Engine ---
  static async placeOrder(
    userId: string,
    input: PlaceOrderInput,
    currentQuote: MarketQuote
  ): Promise<{ order: Order; trade?: Trade; account: VirtualAccount }> {
    // Idempotency check
    if (memory.idempotencyKeys.has(input.idempotencyKey)) {
      throw new Error(`Duplicate order request with idempotency key ${input.idempotencyKey}`);
    }
    memory.idempotencyKeys.add(input.idempotencyKey);

    const account = await this.getVirtualAccount(userId);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const order: Order = {
      id: orderId,
      userId,
      accountId: account.id,
      symbol: input.symbol.toUpperCase(),
      exchange: currentQuote.currency === 'INR' ? 'NSE' : 'NASDAQ',
      side: input.side,
      type: input.type,
      status: 'PENDING',
      quantity: input.quantity,
      filledQuantity: 0,
      limitPrice: input.limitPrice,
      stopPrice: input.stopPrice,
      fees: 0,
      slippage: 0,
      idempotencyKey: input.idempotencyKey,
      placedAt: Date.now()
    };

    // Pre-execution validation
    if (input.side === 'BUY') {
      const estimatedPrice = input.limitPrice || currentQuote.price;
      const estimatedNotional = FinancialMath.multiply(input.quantity, estimatedPrice);
      const estimatedFee = FinancialMath.calculateSimulatedFee(estimatedNotional);
      const totalRequired = FinancialMath.add(estimatedNotional, estimatedFee);

      if (account.availableCash < totalRequired) {
        throw new Error(`Insufficient funds: requires ~${account.baseCurrency} ${totalRequired}, available: ${account.availableCash}`);
      }
    } else {
      // SELL validation: verify user holds sufficient position
      const positions = await this.getPositions(account.id);
      const held = positions.find(p => p.symbol === order.symbol);
      if (!held || held.quantity < input.quantity) {
        throw new Error(`Cannot sell ${input.quantity} shares of ${order.symbol}. Currently held: ${held ? held.quantity : 0}`);
      }
    }

    // Evaluate matching engine against genuine quote
    const match = matchingEngine.evaluateOrder(order, currentQuote);

    let updatedAccount = account;
    let ledgerEntry: LedgerEntry | null = null;
    let positionUpdates: Position | null = null;

    if (match.isFilled && match.trade) {
      const fillTotal = FinancialMath.multiply(match.trade.quantity, match.trade.price);
      const totalCostWithFee = FinancialMath.add(fillTotal, match.trade.fee);

      if (order.side === 'BUY') {
        const ledgerRes = LedgerAccounting.applyBuyFill(
          account,
          totalCostWithFee,
          false,
          order.id,
          input.idempotencyKey
        );
        updatedAccount = ledgerRes.updatedAccount;
        ledgerEntry = ledgerRes.ledgerEntry;

        // Update Position
        const positions = await this.getPositions(account.id);
        const existing = positions.find(p => p.symbol === order.symbol);

        if (existing) {
          const newAvg = PnlCalculator.calculateUpdatedAverageCost(
            existing.quantity,
            existing.averageEntryPrice,
            match.trade.quantity,
            match.trade.price
          );
          const newQty = FinancialMath.add(existing.quantity, match.trade.quantity);
          positionUpdates = {
            ...existing,
            quantity: newQty,
            averageEntryPrice: newAvg,
            currentPrice: currentQuote.price,
            totalCost: FinancialMath.multiply(newQty, newAvg),
            marketValue: FinancialMath.multiply(newQty, currentQuote.price),
            updatedAt: Date.now()
          };
        } else {
          positionUpdates = {
            id: `pos_${account.id}_${order.symbol}`,
            accountId: account.id,
            userId,
            symbol: order.symbol,
            exchange: order.exchange,
            quantity: match.trade.quantity,
            averageEntryPrice: match.trade.price,
            currentPrice: currentQuote.price,
            unrealizedPnl: 0,
            realizedPnl: 0,
            totalCost: fillTotal,
            marketValue: fillTotal,
            updatedAt: Date.now()
          };
        }
      } else {
        // SELL fill
        const netProceeds = FinancialMath.subtract(fillTotal, match.trade.fee);
        const ledgerRes = LedgerAccounting.applySellFill(
          account,
          netProceeds,
          order.id,
          input.idempotencyKey
        );
        updatedAccount = ledgerRes.updatedAccount;
        ledgerEntry = ledgerRes.ledgerEntry;

        const positions = await this.getPositions(account.id);
        const existing = positions.find(p => p.symbol === order.symbol)!;
        const newQty = FinancialMath.subtract(existing.quantity, match.trade.quantity);

        const realizedOnThis = PnlCalculator.calculateRealizedPnlOnSell(
          match.trade.quantity,
          match.trade.price,
          existing.averageEntryPrice,
          match.trade.fee
        );

        positionUpdates = {
          ...existing,
          quantity: newQty,
          currentPrice: currentQuote.price,
          realizedPnl: FinancialMath.add(existing.realizedPnl, realizedOnThis),
          totalCost: FinancialMath.multiply(newQty, existing.averageEntryPrice),
          marketValue: FinancialMath.multiply(newQty, currentQuote.price),
          updatedAt: Date.now()
        };
      }
    } else {
      // Pending order: hold funds if BUY
      if (order.side === 'BUY') {
        const notionalHold = FinancialMath.multiply(input.quantity, input.limitPrice || currentQuote.price);
        const holdRes = LedgerAccounting.holdFundsForOrder(
          account,
          notionalHold,
          order.id,
          input.idempotencyKey
        );
        updatedAccount = holdRes.updatedAccount;
        ledgerEntry = holdRes.ledgerEntry;
      }
    }

    // Persist changes
    if (this.firestore) {
      const batch = this.firestore.batch();
      batch.set(this.firestore.collection('orders').doc(order.id), match.updatedOrder);
      batch.set(this.firestore.collection('virtual_accounts').doc(account.id), updatedAccount);
      if (ledgerEntry) {
        batch.set(this.firestore.collection('virtual_account_ledger').doc(ledgerEntry.id), ledgerEntry);
      }
      if (match.trade) {
        batch.set(this.firestore.collection('trades').doc(match.trade.id), match.trade);
      }
      if (positionUpdates) {
        batch.set(this.firestore.collection('positions').doc(positionUpdates.id), positionUpdates);
      }
      await batch.commit();
    } else {
      memory.orders.set(order.id, match.updatedOrder);
      memory.accounts.set(account.id, updatedAccount);
      if (ledgerEntry) {
        const ledList = memory.ledger.get(account.id) || [];
        ledList.push(ledgerEntry);
        memory.ledger.set(account.id, ledList);
      }
      if (positionUpdates) {
        const posMap = memory.positions.get(account.id) || new Map();
        posMap.set(order.symbol, positionUpdates);
        memory.positions.set(account.id, posMap);
      }
    }

    return {
      order: match.updatedOrder,
      trade: match.trade,
      account: updatedAccount
    };
  }

  static async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const account = await this.getVirtualAccount(userId);
    let order: Order | null = null;

    if (this.firestore) {
      const doc = await this.firestore.collection('orders').doc(orderId).get();
      if (doc.exists) order = doc.data() as Order;
    } else {
      order = memory.orders.get(orderId) || null;
    }

    if (!order || order.userId !== userId) {
      throw new Error('Order not found or unauthorized');
    }

    if (order.status !== 'PENDING') {
      throw new Error(`Cannot cancel order in status ${order.status}`);
    }

    OrderStateMachine.assertTransition(order.status, 'CANCELLED');
    const updatedOrder: Order = {
      ...order,
      status: 'CANCELLED',
      cancelledAt: Date.now()
    };

    let updatedAccount = account;
    let ledgerEntry: LedgerEntry | null = null;

    if (order.side === 'BUY') {
      const held = FinancialMath.multiply(order.quantity, order.limitPrice || 0);
      const res = LedgerAccounting.releaseFundsForOrder(
        account,
        held,
        order.id,
        `cancel_${order.id}`
      );
      updatedAccount = res.updatedAccount;
      ledgerEntry = res.ledgerEntry;
    }

    if (this.firestore) {
      const batch = this.firestore.batch();
      batch.set(this.firestore.collection('orders').doc(order.id), updatedOrder);
      batch.set(this.firestore.collection('virtual_accounts').doc(account.id), updatedAccount);
      if (ledgerEntry) {
        batch.set(this.firestore.collection('virtual_account_ledger').doc(ledgerEntry.id), ledgerEntry);
      }
      await batch.commit();
    } else {
      memory.orders.set(order.id, updatedOrder);
      memory.accounts.set(account.id, updatedAccount);
      if (ledgerEntry) {
        memory.ledger.get(account.id)?.push(ledgerEntry);
      }
    }

    return updatedOrder;
  }

  // --- Watchlists ---
  static async getWatchlists(userId: string): Promise<Watchlist[]> {
    if (this.firestore) {
      const snap = await this.firestore.collection('watchlists').where('userId', '==', userId).get();
      return snap.docs.map(d => d.data() as Watchlist);
    }
    const lists = memory.watchlists.get(userId);
    if (lists) return lists;

    const defaultList: Watchlist = {
      id: `wl_default_${userId}`,
      userId,
      name: 'Main Watchlist',
      symbols: ['AAPL', 'NVDA', 'MSFT', 'RELIANCE.NS', 'TCS.NS', 'BTC-USD'],
      isDefault: true,
      createdAt: Date.now()
    };
    memory.watchlists.set(userId, [defaultList]);
    return [defaultList];
  }

  static async updateWatchlistSymbols(userId: string, watchlistId: string, symbols: string[]): Promise<Watchlist> {
    const lists = await this.getWatchlists(userId);
    const target = lists.find(l => l.id === watchlistId) || lists[0];
    const updated: Watchlist = { ...target, symbols };

    if (this.firestore) {
      await this.firestore.collection('watchlists').doc(target.id).set(updated, { merge: true });
    } else {
      const idx = lists.findIndex(l => l.id === target.id);
      if (idx !== -1) lists[idx] = updated;
      else lists.push(updated);
      memory.watchlists.set(userId, lists);
    }
    return updated;
  }

  // --- Price Alerts ---
  static async getAlerts(userId: string): Promise<PriceAlert[]> {
    if (this.firestore) {
      const snap = await this.firestore.collection('price_alerts').where('userId', '==', userId).get();
      return snap.docs.map(d => d.data() as PriceAlert);
    }
    return memory.alerts.get(userId) || [];
  }

  static async createAlert(userId: string, symbol: string, targetPrice: number, condition: PriceAlert['condition']): Promise<PriceAlert> {
    const alert: PriceAlert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      symbol: symbol.toUpperCase(),
      targetPrice,
      condition,
      status: 'ACTIVE',
      createdAt: Date.now()
    };

    if (this.firestore) {
      await this.firestore.collection('price_alerts').doc(alert.id).set(alert);
    } else {
      const list = memory.alerts.get(userId) || [];
      list.push(alert);
      memory.alerts.set(userId, list);
    }
    return alert;
  }

  // --- Backtesting Results ---
  static async saveBacktestResult(userId: string, result: BacktestResult): Promise<void> {
    if (this.firestore) {
      await this.firestore.collection('backtest_runs').doc(result.id).set({ ...result, userId });
    } else {
      const list = memory.backtests.get(userId) || [];
      list.unshift(result);
      memory.backtests.set(userId, list);
    }
  }

  static async getBacktestResults(userId: string): Promise<BacktestResult[]> {
    if (this.firestore) {
      const snap = await this.firestore.collection('backtest_runs')
        .where('userId', '==', userId)
        .orderBy('executedAt', 'desc')
        .limit(20)
        .get();
      return snap.docs.map(d => d.data() as BacktestResult);
    }
    return memory.backtests.get(userId) || [];
  }
}
