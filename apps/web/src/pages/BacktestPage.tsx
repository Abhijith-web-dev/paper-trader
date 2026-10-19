import React, { useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { BacktestConfig, BacktestResult, BacktestDatasetPreset } from '@globaltrade/shared';
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
  ArrowRight,
  BookOpen,
  Calendar,
  Sparkles,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

const DATASET_PRESETS: BacktestDatasetPreset[] = [
  {
    id: 'preset_aapl',
    name: 'Apple Inc. (AAPL)',
    symbol: 'AAPL',
    category: 'TECH_LEADERS',
    description: 'Megacap tech stock with high liquidity, ideal for trend-following and moving average breakouts.',
    defaultStrategy: 'SMA_CROSSOVER',
    fastPeriod: 10,
    slowPeriod: 30,
    educationalNote: 'Notice how the 10/30 SMA crossover captures smooth trends while avoiding choppy intraday noise.'
  },
  {
    id: 'preset_nvda',
    name: 'NVIDIA Corp. (NVDA)',
    symbol: 'NVDA',
    category: 'TECH_LEADERS',
    description: 'High-momentum semiconductor leader demonstrating powerful directional expansion.',
    defaultStrategy: 'SMA_CROSSOVER',
    fastPeriod: 9,
    slowPeriod: 21,
    educationalNote: 'Fast moving-average periods (9/21) respond quickly to sudden momentum changes.'
  },
  {
    id: 'preset_reliance',
    name: 'Reliance Industries (RELIANCE.NS)',
    symbol: 'RELIANCE.NS',
    category: 'INDIAN_GIANTS',
    description: 'Heavyweight anchor of India’s Nifty 50, showcasing steady institutional volume patterns.',
    defaultStrategy: 'RSI_REVERSAL',
    fastPeriod: 14,
    slowPeriod: 50,
    educationalNote: 'RSI mean reversion works exceptionally well on range-bound blue-chip equities.'
  },
  {
    id: 'preset_sp500',
    name: 'S&P 500 Index (^GSPC)',
    symbol: '^GSPC',
    category: 'MARKET_INDICES',
    description: 'The premier global equity benchmark tracking the top 500 US public companies.',
    defaultStrategy: 'BUY_AND_HOLD',
    fastPeriod: 20,
    slowPeriod: 50,
    educationalNote: 'Compare active tactical trading directly against the passive Buy & Hold benchmark.'
  },
  {
    id: 'preset_nifty',
    name: 'Nifty 50 Index (^NSEI)',
    symbol: '^NSEI',
    category: 'MARKET_INDICES',
    description: 'Flagship index of the National Stock Exchange of India reflecting emerging-market growth.',
    defaultStrategy: 'SMA_CROSSOVER',
    fastPeriod: 20,
    slowPeriod: 50,
    educationalNote: 'Golden cross strategies (50-day crossing above 200-day) historically signal secular bull runs.'
  },
  {
    id: 'preset_btc',
    name: 'Bitcoin (BTC-USD)',
    symbol: 'BTC-USD',
    category: 'CRYPTO',
    description: 'High-volatility 24/7 digital asset with aggressive cyclical trend runs.',
    defaultStrategy: 'RSI_REVERSAL',
    fastPeriod: 14,
    slowPeriod: 30,
    educationalNote: 'Crypto exhibits sharp oversold bounces; setting RSI oversold below 25 limits false positive entries.'
  }
];

export const BacktestPage: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<BacktestDatasetPreset>(DATASET_PRESETS[0]);
  const [symbol, setSymbol] = useState(DATASET_PRESETS[0].symbol);
  const [strategy, setStrategy] = useState<BacktestConfig['strategy']>(DATASET_PRESETS[0].defaultStrategy);
  const [initialCapital, setInitialCapital] = useState(100000);
  const [lookbackDays, setLookbackDays] = useState(365);
  const [fastPeriod, setFastPeriod] = useState(DATASET_PRESETS[0].fastPeriod);
  const [slowPeriod, setSlowPeriod] = useState(DATASET_PRESETS[0].slowPeriod);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApplyPreset = (preset: BacktestDatasetPreset) => {
    setSelectedPreset(preset);
    setSymbol(preset.symbol);
    setStrategy(preset.defaultStrategy);
    setFastPeriod(preset.fastPeriod);
    setSlowPeriod(preset.slowPeriod);
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setError(null);

    try {
      const config: BacktestConfig = {
        symbol: symbol.toUpperCase(),
        strategy,
        lookbackDays: Number(lookbackDays),
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <FlaskConical className="w-4 h-4" /> Quantitative Strategy Lab
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Historical Strategy Backtesting
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Test trading models against genuine historical datasets (US equities, Indian NSE, global indices, and crypto) with simulated execution slippage and zero look-ahead bias.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Real Historical Prices • Split-Adjusted</span>
        </div>
      </div>

      {/* Beginner-Friendly Dataset Quick Presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> Curated Backtesting Datasets for Learners
          </span>
          <span className="text-[11px] text-slate-500">Click any preset to prefill optimal strategy rules</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {DATASET_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className={`p-3 rounded-xl border text-left transition-all ${
                symbol === preset.symbol
                  ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-navy-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850/60'
              }`}
            >
              <div className="font-mono font-bold text-xs text-white">{preset.symbol}</div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{preset.name.split('(')[0]}</div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                {preset.defaultStrategy.replace('_', ' ')}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Preset Educational Callout */}
        <div className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-750/80 flex items-start gap-3 text-xs">
          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-white">{selectedPreset.name}: </span>
            <span className="text-slate-300">{selectedPreset.description} </span>
            <span className="text-emerald-400 block pt-0.5 font-medium">💡 Educator Tip: {selectedPreset.educationalNote}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Configuration Form (1 Col) */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 shadow-xl space-y-4 h-fit">
          <h2 className="font-bold text-sm text-white flex items-center justify-between">
            <span>Simulation Parameters</span>
            <span className="text-[10px] font-mono text-slate-500">Zero Lookahead</span>
          </h2>

          <form onSubmit={handleRunBacktest} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Target Ticker Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, RELIANCE.NS, BTC-USD"
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Quantitative Strategy Model</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="SMA_CROSSOVER">Dual Moving Average Crossover (Fast vs Slow SMA)</option>
                <option value="RSI_REVERSAL">RSI Mean Reversion (Overbought / Oversold)</option>
                <option value="BUY_AND_HOLD">Passive Buy & Hold Benchmark</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Historical Lookback</label>
                <select
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(Number(e.target.value))}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono"
                >
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={180}>180 Days (6 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                  <option value={730}>730 Days (2 Years)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Virtual Capital ($)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {strategy === 'SMA_CROSSOVER' && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-850/40 border border-slate-800 rounded-xl">
                <div className="space-y-1">
                  <label className="text-slate-400">Fast SMA (Days)</label>
                  <input
                    type="number"
                    min="3"
                    max="50"
                    value={fastPeriod}
                    onChange={(e) => setFastPeriod(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Slow SMA (Days)</label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={slowPeriod}
                    onChange={(e) => setSlowPeriod(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            )}

            {strategy === 'RSI_REVERSAL' && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-850/40 border border-slate-800 rounded-xl">
                <div className="space-y-1">
                  <label className="text-slate-400">Oversold Trigger (Buy)</label>
                  <input
                    type="number"
                    min="10"
                    max="45"
                    value={rsiOversold}
                    onChange={(e) => setRsiOversold(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Overbought Trigger (Sell)</label>
                  <input
                    type="number"
                    min="55"
                    max="90"
                    value={rsiOverbought}
                    onChange={(e) => setRsiOverbought(Number(e.target.value))}
                    className="w-full bg-slate-850 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            )}

            <div className="p-3 bg-navy-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Simulated Exchange Fee:</span>
                <span className="font-mono text-slate-300">0.05%</span>
              </div>
              <div className="flex justify-between">
                <span>Execution Slippage:</span>
                <span className="font-mono text-slate-300">0.05%</span>
              </div>
            </div>

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
              <span>{isRunning ? 'Streaming Historical Candles...' : 'Execute Backtest'}</span>
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
                {result.trades.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto">
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
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No crossover or trigger signals generated during this lookback window. Try adjusting the period lengths or expanding the lookback range.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-navy-900 border border-slate-800 text-center space-y-3">
              <FlaskConical className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="font-bold text-white text-base">Ready for Strategy Backtest</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Select one of the curated presets above (such as Apple, NVIDIA, Reliance, or S&P 500) to see how algorithmic models perform against genuine historical price action.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
