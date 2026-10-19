import { FinancialMath, MarketQuote, Order, Trade } from '@globaltrade/shared';
import { OrderStateMachine } from './orderStateMachine.js';

export interface MatchingResult {
  isFilled: boolean;
  fillPrice?: number;
  filledQuantity?: number;
  fee?: number;
  slippage?: number;
  trade?: Trade;
  updatedOrder: Order;
}

export class MatchingEngine {
  private feeRatePercent: number;
  private slippagePercent: number;

  constructor(feeRatePercent: number = 0.05, slippagePercent: number = 0.05) {
    this.feeRatePercent = feeRatePercent;
    this.slippagePercent = slippagePercent;
  }

  evaluateOrder(order: Order, currentQuote: MarketQuote): MatchingResult {
    if (OrderStateMachine.isTerminal(order.status)) {
      return { isFilled: false, updatedOrder: order };
    }

    const marketPrice = currentQuote.price;

    switch (order.type) {
      case 'MARKET':
        return this.executeFill(order, marketPrice, true);

      case 'LIMIT':
        if (order.side === 'BUY') {
          // Fill buy limit if market price is less than or equal to limit price
          if (marketPrice <= (order.limitPrice || 0)) {
            return this.executeFill(order, order.limitPrice || marketPrice, false);
          }
        } else {
          // Fill sell limit if market price is greater than or equal to limit price
          if (marketPrice >= (order.limitPrice || 0)) {
            return this.executeFill(order, order.limitPrice || marketPrice, false);
          }
        }
        return { isFilled: false, updatedOrder: order };

      case 'STOP':
        if (order.side === 'BUY') {
          if (marketPrice >= (order.stopPrice || Infinity)) {
            return this.executeFill(order, marketPrice, true);
          }
        } else {
          if (marketPrice <= (order.stopPrice || 0)) {
            return this.executeFill(order, marketPrice, true);
          }
        }
        return { isFilled: false, updatedOrder: order };

      case 'STOP_LIMIT':
        if (order.side === 'BUY') {
          if (marketPrice >= (order.stopPrice || Infinity) && marketPrice <= (order.limitPrice || Infinity)) {
            return this.executeFill(order, order.limitPrice || marketPrice, false);
          }
        } else {
          if (marketPrice <= (order.stopPrice || 0) && marketPrice >= (order.limitPrice || 0)) {
            return this.executeFill(order, order.limitPrice || marketPrice, false);
          }
        }
        return { isFilled: false, updatedOrder: order };

      default:
        return { isFilled: false, updatedOrder: order };
    }
  }

  private executeFill(order: Order, basePrice: number, applySlippage: boolean): MatchingResult {
    const isBuy = order.side === 'BUY';
    const executedPrice = applySlippage 
      ? FinancialMath.calculateSlippage(basePrice, this.slippagePercent, isBuy)
      : basePrice;

    const notional = FinancialMath.multiply(order.quantity, executedPrice);
    const fee = FinancialMath.calculateSimulatedFee(notional, this.feeRatePercent);
    const slippageAmount = FinancialMath.round(Math.abs(executedPrice - basePrice) * order.quantity, 2);

    const trade: Trade = {
      id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      orderId: order.id,
      accountId: order.accountId,
      userId: order.userId,
      symbol: order.symbol,
      side: order.side,
      price: executedPrice,
      quantity: order.quantity,
      fee,
      executedAt: Date.now()
    };

    const updatedOrder: Order = {
      ...order,
      status: 'FILLED',
      filledQuantity: order.quantity,
      avgFillPrice: executedPrice,
      fees: fee,
      slippage: slippageAmount,
      filledAt: Date.now()
    };

    return {
      isFilled: true,
      fillPrice: executedPrice,
      filledQuantity: order.quantity,
      fee,
      slippage: slippageAmount,
      trade,
      updatedOrder
    };
  }
}
