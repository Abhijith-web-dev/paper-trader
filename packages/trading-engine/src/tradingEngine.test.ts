import { describe, it, expect } from 'vitest';
import { OrderStateMachine } from './orderStateMachine.js';
import { PnlCalculator } from './pnlCalculator.js';
import { LedgerAccounting } from './ledgerAccounting.js';
import { MatchingEngine } from './matchingEngine.js';
import { Backtester } from './backtester.js';
import { MarketQuote, Order, VirtualAccount } from '@globaltrade/shared';

describe('OrderStateMachine', () => {
  it('allows valid transitions from PENDING', () => {
    expect(OrderStateMachine.canTransition('PENDING', 'FILLED')).toBe(true);
    expect(OrderStateMachine.canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(OrderStateMachine.canTransition('PENDING', 'REJECTED')).toBe(true);
  });

  it('rejects invalid transitions from terminal states', () => {
    expect(OrderStateMachine.canTransition('FILLED', 'CANCELLED')).toBe(false);
    expect(OrderStateMachine.canTransition('CANCELLED', 'FILLED')).toBe(false);
    expect(() => OrderStateMachine.assertTransition('FILLED', 'PENDING')).toThrow();
  });
});

describe('PnlCalculator', () => {
  it('correctly calculates unrealized P&L and market value', () => {
    const res = PnlCalculator.calculatePositionPnl(10, 150, 175);
    expect(res.marketValue).toBe(1750);
    expect(res.unrealizedPnl).toBe(250);
    expect(res.unrealizedPnlPercent).toBe(16.67);
  });

  it('correctly calculates realized P&L on sell with fee', () => {
    // Bought 10 @ 100, Sold 10 @ 120, fee $5 -> Net profit $195
    const pnl = PnlCalculator.calculateRealizedPnlOnSell(10, 120, 100, 5);
    expect(pnl).toBe(195);
  });

  it('correctly updates weighted average cost on addition', () => {
    // 10 shares @ $100 + 10 shares @ $200 = 20 shares @ $150
    const avg = PnlCalculator.calculateUpdatedAverageCost(10, 100, 10, 200);
    expect(avg).toBe(150);
  });
});

describe('LedgerAccounting', () => {
  const mockAccount: VirtualAccount = {
    id: 'acc_1',
    userId: 'usr_1',
    name: 'Virtual Trading Account',
    baseCurrency: 'USD',
    initialBalance: 100000,
    availableCash: 100000,
    reservedCash: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('creates initial deposit with matching ledger entry', () => {
    const res = LedgerAccounting.createInitialDeposit(mockAccount, 'idem_init');
    expect(res.updatedAccount.availableCash).toBe(100000);
    expect(res.ledgerEntry.type).toBe('INITIAL_DEPOSIT');
    expect(res.ledgerEntry.amount).toBe(100000);
  });

  it('holds funds for order placement', () => {
    const res = LedgerAccounting.holdFundsForOrder(mockAccount, 5000, 'ord_1', 'idem_hold_1');
    expect(res.updatedAccount.availableCash).toBe(95000);
    expect(res.updatedAccount.reservedCash).toBe(5000);
    expect(res.ledgerEntry.type).toBe('ORDER_HOLD');
  });

  it('throws on insufficient funds when attempting to hold', () => {
    expect(() => {
      LedgerAccounting.holdFundsForOrder(mockAccount, 100001, 'ord_fail', 'idem_fail');
    }).toThrow('Insufficient funds');
  });

  it('releases funds on cancelled order', () => {
    const heldAccount = { ...mockAccount, availableCash: 90000, reservedCash: 10000 };
    const res = LedgerAccounting.releaseFundsForOrder(heldAccount, 10000, 'ord_1', 'idem_rel_1');
    expect(res.updatedAccount.availableCash).toBe(100000);
    expect(res.updatedAccount.reservedCash).toBe(0);
  });
});

describe('MatchingEngine', () => {
  const engine = new MatchingEngine(0.05, 0.05);

  const mockQuote: MarketQuote = {
    symbol: 'AAPL',
    price: 150,
    change: 2,
    changePercent: 1.35,
    high: 152,
    low: 149,
    open: 149,
    previousClose: 148,
    volume: 5000000,
    timestamp: Date.now(),
    provider: 'YahooFinance',
    isStale: false,
    marketStatus: 'OPEN',
    currency: 'USD'
  };

  it('fills market buy orders immediately with simulated slippage', () => {
    const order: Order = {
      id: 'ord_buy',
      userId: 'usr_1',
      accountId: 'acc_1',
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      side: 'BUY',
      type: 'MARKET',
      status: 'PENDING',
      quantity: 10,
      filledQuantity: 0,
      fees: 0,
      slippage: 0,
      idempotencyKey: 'idem_mkt_buy',
      placedAt: Date.now()
    };

    const res = engine.evaluateOrder(order, mockQuote);
    expect(res.isFilled).toBe(true);
    expect(res.updatedOrder.status).toBe('FILLED');
    expect(res.fillPrice).toBeGreaterThan(150); // slight buy slippage
    expect(res.trade).toBeDefined();
  });

  it('does not fill limit buy order if quote is above limit price', () => {
    const order: Order = {
      id: 'ord_lim_buy',
      userId: 'usr_1',
      accountId: 'acc_1',
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      side: 'BUY',
      type: 'LIMIT',
      status: 'PENDING',
      quantity: 10,
      filledQuantity: 0,
      limitPrice: 145, // market is 150
      fees: 0,
      slippage: 0,
      idempotencyKey: 'idem_lim_buy',
      placedAt: Date.now()
    };

    const res = engine.evaluateOrder(order, mockQuote);
    expect(res.isFilled).toBe(false);
    expect(res.updatedOrder.status).toBe('PENDING');
  });

  it('fills limit buy order when market drops to or below limit price', () => {
    const order: Order = {
      id: 'ord_lim_buy_hit',
      userId: 'usr_1',
      accountId: 'acc_1',
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      side: 'BUY',
      type: 'LIMIT',
      status: 'PENDING',
      quantity: 10,
      filledQuantity: 0,
      limitPrice: 155, // market is 150 <= 155
      fees: 0,
      slippage: 0,
      idempotencyKey: 'idem_lim_hit',
      placedAt: Date.now()
    };

    const res = engine.evaluateOrder(order, mockQuote);
    expect(res.isFilled).toBe(true);
    expect(res.updatedOrder.status).toBe('FILLED');
    expect(res.fillPrice).toBe(155);
  });
});

describe('Backtester', () => {
  it('executes backtest strategy and outputs equity curve', () => {
    const mockCandles = Array.from({ length: 60 }, (_, i) => ({
      time: 1700000000 + (i * 86400),
      open: 100 + Math.sin(i / 5) * 10,
      high: 105 + Math.sin(i / 5) * 10,
      low: 95 + Math.sin(i / 5) * 10,
      close: 100 + Math.sin(i / 5) * 10,
      volume: 100000
    }));

    const result = Backtester.run({
      symbol: 'AAPL',
      strategy: 'SMA_CROSSOVER',
      startDate: '2024-01-01',
      endDate: '2024-03-01',
      initialCapital: 100000,
      fastPeriod: 5,
      slowPeriod: 15
    }, mockCandles);

    expect(result.id).toBeDefined();
    expect(result.equityCurve.length).toBe(60);
    expect(typeof result.totalReturnPercent).toBe('number');
    expect(typeof result.maxDrawdownPercent).toBe('number');
  });
});
