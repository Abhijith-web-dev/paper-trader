import { Decimal } from 'decimal.js';

// Configure standard financial rounding and precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class FinancialMath {
  static add(a: number | string, b: number | string): number {
    return new Decimal(a).plus(new Decimal(b)).toNumber();
  }

  static subtract(a: number | string, b: number | string): number {
    return new Decimal(a).minus(new Decimal(b)).toNumber();
  }

  static multiply(a: number | string, b: number | string): number {
    return new Decimal(a).times(new Decimal(b)).toNumber();
  }

  static divide(a: number | string, b: number | string): number {
    const divisor = new Decimal(b);
    if (divisor.isZero()) {
      throw new Error('Division by zero in financial arithmetic');
    }
    return new Decimal(a).dividedBy(divisor).toNumber();
  }

  static round(val: number | string, decimalPlaces: number = 2): number {
    return new Decimal(val).toDecimalPlaces(decimalPlaces).toNumber();
  }

  static calculatePercentageChange(current: number, previous: number): number {
    if (!previous || previous === 0) return 0;
    const diff = new Decimal(current).minus(new Decimal(previous));
    return diff.dividedBy(new Decimal(previous)).times(100).toDecimalPlaces(4).toNumber();
  }

  static calculateSimulatedFee(notional: number, feeRatePercent: number = 0.05): number {
    return new Decimal(notional).times(new Decimal(feeRatePercent)).dividedBy(100).toDecimalPlaces(2).toNumber();
  }

  static calculateSlippage(price: number, slippagePercent: number = 0.05, isBuy: boolean = true): number {
    const factor = new Decimal(slippagePercent).dividedBy(100);
    const adjustment = new Decimal(price).times(factor);
    return isBuy 
      ? new Decimal(price).plus(adjustment).toDecimalPlaces(4).toNumber()
      : new Decimal(price).minus(adjustment).toDecimalPlaces(4).toNumber();
  }
}
