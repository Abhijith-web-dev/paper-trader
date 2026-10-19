import { HistoricalCandle } from '@globaltrade/shared';

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export class TechnicalIndicators {
  static calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = new Array(data.length).fill(0);
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      sma[i] = Number((sum / period).toFixed(2));
    }
    return sma;
  }

  static calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = new Array(data.length).fill(0);
    if (data.length < period) return ema;

    // Start with SMA for first period
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    ema[period - 1] = Number((sum / period).toFixed(2));

    const multiplier = 2 / (period + 1);

    for (let i = period; i < data.length; i++) {
      const val = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema[i] = Number(val.toFixed(2));
    }
    return ema;
  }

  static calculateRSI(data: number[], period: number = 14): number[] {
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
        rsi[i] = Number((100 - (100 / (1 + rs))).toFixed(2));
      }
    }
    return rsi;
  }

  static calculateMACD(data: number[], fast: number = 12, slow: number = 26, signalPeriod: number = 9): MacdResult {
    const fastEma = this.calculateEMA(data, fast);
    const slowEma = this.calculateEMA(data, slow);

    const macdLine: number[] = new Array(data.length).fill(0);
    for (let i = slow - 1; i < data.length; i++) {
      macdLine[i] = Number((fastEma[i] - slowEma[i]).toFixed(2));
    }

    const signalLine = this.calculateEMA(macdLine.slice(slow - 1), signalPeriod);
    const signalPadded: number[] = new Array(data.length).fill(0);
    const hist: number[] = new Array(data.length).fill(0);

    for (let i = 0; i < signalLine.length; i++) {
      const targetIdx = i + (slow - 1);
      signalPadded[targetIdx] = signalLine[i];
      hist[targetIdx] = Number((macdLine[targetIdx] - signalLine[i]).toFixed(2));
    }

    return {
      macd: macdLine,
      signal: signalPadded,
      histogram: hist
    };
  }

  static calculateBollingerBands(data: number[], period: number = 20, stdDevMultiplier: number = 2): BollingerBandsResult {
    const middle = this.calculateSMA(data, period);
    const upper: number[] = new Array(data.length).fill(0);
    const lower: number[] = new Array(data.length).fill(0);

    for (let i = period - 1; i < data.length; i++) {
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(data[i - j] - middle[i], 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      upper[i] = Number((middle[i] + (stdDev * stdDevMultiplier)).toFixed(2));
      lower[i] = Number((middle[i] - (stdDev * stdDevMultiplier)).toFixed(2));
    }

    return { upper, middle, lower };
  }

  static calculateVWAP(candles: HistoricalCandle[]): number[] {
    const vwap: number[] = new Array(candles.length).fill(0);
    let cumulativeTypicalVolume = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const typicalPrice = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 1;

      cumulativeTypicalVolume += (typicalPrice * vol);
      cumulativeVolume += vol;

      vwap[i] = Number((cumulativeTypicalVolume / cumulativeVolume).toFixed(2));
    }
    return vwap;
  }
}
