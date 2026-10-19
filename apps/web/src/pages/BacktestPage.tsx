import React, { useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { BacktestConfig, BacktestResult } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { 
  FlaskConical, 
  Play, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Percent, 
  Award,
  Layers,
  ArrowRight
} from 'lucide-react';

export const BacktestPage: React.FC = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [strategy, setStrategy] = useState<BacktestConfig['strategy']>('SMA_CROSSOVER');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(30);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setError(null);

    try {
      const config: BacktestConfig = {
        symbol: symbol.toUpperCase(),
        strategy,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        initialCapital: Number(initialCapital),
        fastPeriod: Number(fastPeriod),
        slowPeriod: Number(slowPeriod),
        rsiOversold: Number(rsiOversold),
        rsiOverbought: Number(rsiOverbought),
        feeRatePercent: 0.05,
        slippagePercent: 0.05
      };

      const res = await ApiClient.post<BacktestResult>('/backtest/run', config);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Backtest failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-emerald-400" />
          <span>Quantitative Strategy & Backtesting Lab</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Backtest algorithmic trading models on genuine historical candles with realistic fees and zero look-ahead bias
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Configuration Form (1 Col) */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 shadow-xl space-y-4 h-fit">
          <h2 className="font-bold text-sm text-white">Strategy Parameters</h2>

          <form onSubmit={handleRunBacktest} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400">Target Instrument</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Quantitative Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="SMA_CROSSOVER">Dual Moving Average Crossover (SMA)</option>
                <option value="RSI_REVERSAL">RSI Mean Reversion (14 Period)</option>
                <option value="BUY_AND_HOLD">Passive Buy & Hold Benchmark</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Initial Virtual Capital ($)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            {strategy === 'SMA_CROSSOVER' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-400">Fast SMA Period</label>
                  <input
                    type="number"
                    value={fastPeriod}
                    onChange={(e) => setFastPeriod(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Slow SMA Period</label>
                  <input
                    type="number"
                    value={slowPeriod}
                    onChange={(e) => setSlowPeriod(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}

            {strategy === 'RSI_REVERSAL' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-400">Oversold (Buy)</label>
                  <input
                    type="number"
                    value={rsiOversold}
                    onChange={(e) => setRsiOversold(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Overbought (Sell)</label>
                  <input
                    type="number"
                    value={rsiOverbought}
                    onChange={(e) => setRsiOverbought(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning}
              className="w-full py-3 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-navy-950" />
              <span>{isRunning ? 'Calculating Simulation...' : 'Execute Backtest'}</span>
            </button>
          </form>
        </div>

        {/* Backtest Results & Analytics (2 Cols) */}
        <div className="lg:col-span-2 space-y-5">
          {result ? (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Strategy Return</span>
                  <div className={`font-mono text-xl font-extrabold ${result.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(result.totalReturnPercent)}
                  </div>
                  <span className="text-[10px] text-slate-500">Benchmark: {formatPercent(result.benchmarkReturnPercent)}</span>
                </div>

                <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Max Drawdown</span>
                  <div className="font-mono text-xl font-extrabold text-red-400">
                    -{result.maxDrawdownPercent.toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-slate-500">Peak-to-trough decline</span>
                </div>

                <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Win Rate</span>
                  <div className="font-mono text-xl font-extrabold text-white">
                    {result.winRatePercent.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-500">{result.winningTrades} of {result.totalTrades} trades</span>
                </div>

                <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Profit Factor</span>
                  <div className="font-mono text-xl font-extrabold text-emerald-400">
                    {result.profitFactor.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500">Gross Win / Gross Loss</span>
                </div>
              </div>

              {/* Trade Log Table */}
              <div className="rounded-2xl bg-navy-900 border border-slate-800 overflow-hidden shadow-xl space-y-2 p-5">
                <h3 className="font-bold text-sm text-white">Simulated Execution Log ({result.trades.length} trades)</h3>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-850 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Entry</th>
                        <th className="py-2.5 px-3">Exit</th>
                        <th className="py-2.5 px-3 text-right">Entry Price</th>
                        <th className="py-2.5 px-3 text-right">Exit Price</th>
                        <th className="py-2.5 px-3 text-right">Shares</th>
                        <th className="py-2.5 px-3 text-right">Net P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {result.trades.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-850/30">
                          <td className="py-2.5 px-3 text-slate-300">{t.entryDate}</td>
                          <td className="py-2.5 px-3 text-slate-300">{t.exitDate}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200">{formatCurrency(t.entryPrice)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200">{formatCurrency(t.exitPrice)}</td>
                          <td className="py-2.5 px-3 text-right text-white font-bold">{t.quantity}</td>
                          <td className={`py-2.5 px-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(t.pnl)} ({formatPercent(t.pnlPercent)})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-navy-900 border border-slate-800 text-center space-y-3">
              <FlaskConical className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="font-bold text-white text-base">No Backtest Executed Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Configure your instrument and strategy on the left, then click Execute Backtest to simulate trades across historical candle bars.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
