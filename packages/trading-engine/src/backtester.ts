import { BacktestConfig, BacktestResult, BacktestTrade, EquityPoint, FinancialMath, HistoricalCandle } from '@globaltrade/shared';

export class Backtester {
  static run(config: BacktestConfig, candles: HistoricalCandle[]): BacktestResult {
    if (!candles || candles.length < 20) {
      throw new Error('Insufficient historical candle observations for backtesting (minimum 20 candles required)');
    }

    // Ensure sorted chronologically
    const sorted = [...candles].sort((a, b) => a.time - b.time);

    let cash = config.initialCapital;
    let positionQty = 0;
    let entryPrice = 0;
    let entryDate = '';

    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    const feePct = config.feeRatePercent ?? 0.05;
    const slippagePct = config.slippagePercent ?? 0.05;

    let peakEquity = config.initialCapital;
    let maxDrawdown = 0;

    const initialBenchmarkPrice = sorted[0].close;

    // Calculate indicators
    const closes = sorted.map(c => c.close);
    const fastPeriod = config.fastPeriod || 10;
    const slowPeriod = config.slowPeriod || 20;

    const fastSma = this.calculateSMA(closes, fastPeriod);
    const slowSma = this.calculateSMA(closes, slowPeriod);
    const rsi = this.calculateRSI(closes, 14);

    for (let i = 0; i < sorted.length; i++) {
      const candle = sorted[i];
      const candleDate = new Date(candle.time * 1000).toISOString().split('T')[0];
      const currentPrice = candle.close;

      // Strategy signals
      let shouldBuy = false;
      let shouldSell = false;

      if (config.strategy === 'SMA_CROSSOVER') {
        if (i > slowPeriod && fastSma[i] > slowSma[i] && fastSma[i - 1] <= slowSma[i - 1]) {
          shouldBuy = true;
        } else if (i > slowPeriod && fastSma[i] < slowSma[i] && fastSma[i - 1] >= slowSma[i - 1]) {
          shouldSell = true;
        }
      } else if (config.strategy === 'RSI_REVERSAL') {
        const oversold = config.rsiOversold || 30;
        const overbought = config.rsiOverbought || 70;
        if (rsi[i] < oversold && rsi[i - 1] >= oversold) {
          shouldBuy = true;
        } else if (rsi[i] > overbought && rsi[i - 1] <= overbought) {
          shouldSell = true;
        }
      } else {
        // Buy and hold
        if (i === 0) shouldBuy = true;
      }

      // Execute buy
      if (shouldBuy && positionQty === 0 && cash > 0) {
        const fillPrice = FinancialMath.calculateSlippage(currentPrice, slippagePct, true);
        const fee = FinancialMath.calculateSimulatedFee(cash, feePct);
        const deployableCash = cash - fee;
        positionQty = Math.floor(deployableCash / fillPrice);
        if (positionQty > 0) {
          const actualCost = positionQty * fillPrice;
          cash -= (actualCost + fee);
          entryPrice = fillPrice;
          entryDate = candleDate;
        }
      }

      // Execute sell
      if (shouldSell && positionQty > 0) {
        const fillPrice = FinancialMath.calculateSlippage(currentPrice, slippagePct, false);
        const gross = positionQty * fillPrice;
        const fee = FinancialMath.calculateSimulatedFee(gross, feePct);
        const net = gross - fee;
        cash += net;

        const pnl = FinancialMath.round(net - (positionQty * entryPrice), 2);
        const pnlPercent = FinancialMath.calculatePercentageChange(fillPrice, entryPrice);

        trades.push({
          entryDate,
          exitDate: candleDate,
          side: 'BUY',
          entryPrice,
          exitPrice: fillPrice,
          quantity: positionQty,
          pnl,
          pnlPercent,
          exitReason: 'STRATEGY_SIGNAL'
        });

        positionQty = 0;
        entryPrice = 0;
      }

      // Current mark-to-market equity
      const positionValue = positionQty * currentPrice;
      const currentEquity = FinancialMath.round(cash + positionValue, 2);

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const dd = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }

      const benchmarkEquity = FinancialMath.round((config.initialCapital / initialBenchmarkPrice) * currentPrice, 2);

      equityCurve.push({
        time: candleDate,
        equity: currentEquity,
        drawdownPercent: FinancialMath.round(dd, 2),
        benchmarkEquity
      });
    }

    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || config.initialCapital;
    const totalReturnPercent = FinancialMath.calculatePercentageChange(finalEquity, config.initialCapital);
    const benchmarkReturnPercent = FinancialMath.calculatePercentageChange(sorted[sorted.length - 1].close, initialBenchmarkPrice);

    const winning = trades.filter(t => t.pnl > 0);
    const losing = trades.filter(t => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winning.length / trades.length) * 100 : 0;

    const grossProfits = winning.reduce((acc, t) => acc + t.pnl, 0);
    const grossLosses = Math.abs(losing.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : (grossProfits > 0 ? 99 : 1);

    return {
      id: `bt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      config,
      totalReturnPercent: FinancialMath.round(totalReturnPercent, 2),
      annualizedReturnPercent: FinancialMath.round(totalReturnPercent * (365 / Math.max(sorted.length, 1)), 2),
      benchmarkReturnPercent: FinancialMath.round(benchmarkReturnPercent, 2),
      maxDrawdownPercent: FinancialMath.round(maxDrawdown, 2),
      sharpeRatio: FinancialMath.round(totalReturnPercent / Math.max(maxDrawdown, 1), 2),
      winRatePercent: FinancialMath.round(winRate, 2),
      totalTrades: trades.length,
      winningTrades: winning.length,
      losingTrades: losing.length,
      profitFactor: FinancialMath.round(profitFactor, 2),
      equityCurve,
      trades,
      executedAt: Date.now()
    };
  }

  private static calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = new Array(data.length).fill(0);
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      sma[i] = sum / period;
    }
    return sma;
  }

  private static calculateRSI(data: number[], period: number = 14): number[] {
    const rsi: number[] = new Array(data.length).fill(50);
    if (data.length <= period) return rsi;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }

      if (avgLoss === 0) {
        rsi[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi[i] = 100 - (100 / (1 + rs));
      }
    }

    return rsi;
  }
}
