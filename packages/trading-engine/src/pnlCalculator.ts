import { FinancialMath, Position } from '@globaltrade/shared';

export interface PnlResult {
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marketValue: number;
}

export class PnlCalculator {
  static calculatePositionPnl(
    quantity: number,
    averageEntryPrice: number,
    currentPrice: number
  ): PnlResult {
    if (quantity === 0) {
      return { unrealizedPnl: 0, unrealizedPnlPercent: 0, marketValue: 0 };
    }

    const totalCost = FinancialMath.multiply(quantity, averageEntryPrice);
    const marketValue = FinancialMath.multiply(quantity, currentPrice);
    const unrealizedPnl = FinancialMath.subtract(marketValue, totalCost);
    const unrealizedPnlPercent = FinancialMath.calculatePercentageChange(currentPrice, averageEntryPrice);

    return {
      unrealizedPnl: FinancialMath.round(unrealizedPnl, 2),
      unrealizedPnlPercent: FinancialMath.round(unrealizedPnlPercent, 2),
      marketValue: FinancialMath.round(marketValue, 2)
    };
  }

  static calculateRealizedPnlOnSell(
    sellQuantity: number,
    sellPrice: number,
    averageEntryPrice: number,
    fee: number = 0
  ): number {
    const grossProceeds = FinancialMath.multiply(sellQuantity, sellPrice);
    const costBasis = FinancialMath.multiply(sellQuantity, averageEntryPrice);
    const grossPnl = FinancialMath.subtract(grossProceeds, costBasis);
    const netPnl = FinancialMath.subtract(grossPnl, fee);
    return FinancialMath.round(netPnl, 2);
  }

  static calculateUpdatedAverageCost(
    currentQty: number,
    currentAvgPrice: number,
    newQty: number,
    newPrice: number
  ): number {
    const currentCost = FinancialMath.multiply(currentQty, currentAvgPrice);
    const newCost = FinancialMath.multiply(newQty, newPrice);
    const totalCost = FinancialMath.add(currentCost, newCost);
    const totalQty = FinancialMath.add(currentQty, newQty);

    if (totalQty === 0) return 0;
    return FinancialMath.round(FinancialMath.divide(totalCost, totalQty), 4);
  }
}
