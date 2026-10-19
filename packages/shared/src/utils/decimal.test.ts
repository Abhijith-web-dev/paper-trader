import { describe, it, expect } from 'vitest';
import { FinancialMath } from './decimal.js';

describe('FinancialMath', () => {
  it('should accurately add floating numbers without IEEE-754 precision loss', () => {
    // Standard JS: 0.1 + 0.2 = 0.30000000000000004
    expect(FinancialMath.add(0.1, 0.2)).toBe(0.3);
    expect(FinancialMath.add(100.05, 50.15)).toBe(150.2);
  });

  it('should accurately subtract financial values', () => {
    expect(FinancialMath.subtract(100.5, 50.25)).toBe(50.25);
    expect(FinancialMath.subtract(10, 0.01)).toBe(9.99);
  });

  it('should accurately multiply prices and quantities', () => {
    // 150.75 * 10.5
    expect(FinancialMath.multiply(150.75, 10)).toBe(1507.5);
    expect(FinancialMath.multiply(33.33, 3)).toBe(99.99);
  });

  it('should accurately calculate percentage change', () => {
    expect(FinancialMath.calculatePercentageChange(110, 100)).toBe(10);
    expect(FinancialMath.calculatePercentageChange(90, 100)).toBe(-10);
    expect(FinancialMath.calculatePercentageChange(100, 0)).toBe(0);
  });

  it('should calculate simulated fees correctly', () => {
    // 10,000 * 0.05% = 5.00
    expect(FinancialMath.calculateSimulatedFee(10000, 0.05)).toBe(5);
  });

  it('should calculate simulated slippage correctly', () => {
    // Buy with 0.1% slippage on $100 -> $100.10
    expect(FinancialMath.calculateSlippage(100, 0.1, true)).toBe(100.1);
    // Sell with 0.1% slippage on $100 -> $99.90
    expect(FinancialMath.calculateSlippage(100, 0.1, false)).toBe(99.9);
  });
});
