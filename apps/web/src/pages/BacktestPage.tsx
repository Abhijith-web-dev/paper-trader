import React, { useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { BacktestConfig, BacktestResult, BacktestDatasetPreset } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { 
  FlaskConical, 
  Play, 
  BookOpen, 
  Sparkles, 
  CheckCircle2 
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
      <div className="pb-4 border-b border-[#1B222D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#CCFF00] font-extrabold text-xs tracking-wider uppercase mb-1">
            <FlaskConical className="w-4 h-4" /> Quantitative Strategy Lab
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Historical Strategy Backtesting
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Test trading models against genuine historical datasets (US equities, Indian NSE, global indices, and crypto) with simulated execution slippage and zero look-ahead bias.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-[#CCFF00]/10 border border-[#CCFF00]/25 px-4 py-2.5 rounded-full text-[#CCFF00] font-bold">
          <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
          <span>Real Historical Prices • Split-Adjusted</span>
        </div>
      </div>

      {/* Beginner-Friendly Dataset Quick Presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#CCFF00]" /> Curated Datasets for Learners
          </span>
          <span className="text-[11px] text-slate-500">Click any preset to prefill optimal strategy parameters</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {DATASET_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className={`p-4 rounded-3xl border text-left transition-all ${
                symbol === preset.symbol
                  ? 'bg-[#CCFF00]/15 border-[#CCFF00] shadow-lg shadow-[#CCFF00]/10'
                  : 'bg-[#0B0F14] border-[#1B222D] hover:border-slate-700 hover:bg-[#10151C]'
              }`}
            >
              <div className="font-mono font-bold text-xs text-white">{preset.symbol}</div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{preset.name.split('(')[0]}</div>
              <div className="text-[10px] text-[#CCFF00] font-extrabold mt-1">
                {preset.defaultStrategy.replace('_', ' ')}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Preset Educational Callout */}
        <div className="p-4 rounded-3xl bg-[#0B0F14] border border-[#1B222D] flex items-start gap-3 text-xs">
          <BookOpen className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white">{selectedPreset.name}: </span>
            <span className="text-slate-300">{selectedPreset.description} </span>
            <span className="text-[#CCFF00] block pt-0.5 font-bold">💡 Educator Tip: {selectedPreset.educationalNote}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Configuration Form (1 Col) */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-5 h-fit">
          <h2 className="font-extrabold text-base text-white flex items-center justify-between">
            <span>Simulation Parameters</span>
            <span className="text-[11px] font-mono text-[#CCFF00] font-bold">Zero Lookahead</span>
          </h2>

          <form onSubmit={handleRunBacktest} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">Target Ticker Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, RELIANCE.NS, BTC-USD"
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-bold uppercase focus:outline-none focus:border-[#CCFF00]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">Quantitative Strategy Model</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-medium focus:outline-none focus:border-[#CCFF00]"
              >
                <option value="SMA_CROSSOVER">Dual Moving Average Crossover (Fast vs Slow SMA)</option>
                <option value="RSI_REVERSAL">RSI Mean Reversion (Overbought / Oversold)</option>
                <option value="BUY_AND_HOLD">Passive Buy & Hold Benchmark</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Historical Lookback</label>
                <select
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(Number(e.target.value))}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono"
                >
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={180}>180 Days (6 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                  <option value={730}>730 Days (2 Years)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Virtual Capital ($)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-[#CCFF00]"
                  required
                />
              </div>
            </div>

            {strategy === 'SMA_CROSSOVER' && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-[#10151C] border border-[#1B222D] rounded-2xl">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Fast SMA (Days)</label>
                  <input
                    type="number"
                    min="3"
                    max="50"
                    value={fastPeriod}
                    onChange={(e) => setFastPeriod(Number(e.target.value))}
                    className="w-full bg-[#0B0F14] border border-[#1B222D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Slow SMA (Days)</label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={slowPeriod}
                    onChange={(e) => setSlowPeriod(Number(e.target.value))}
                    className="w-full bg-[#0B0F14] border border-[#1B222D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}

            {strategy === 'RSI_REVERSAL' && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-[#10151C] border border-[#1B222D] rounded-2xl">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Oversold (Buy)</label>
                  <input
                    type="number"
                    min="10"
                    max="45"
                    value={rsiOversold}
                    onChange={(e) => setRsiOversold(Number(e.target.value))}
                    className="w-full bg-[#0B0F14] border border-[#1B222D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Overbought (Sell)</label>
                  <input
                    type="number"
                    min="55"
                    max="90"
                    value={rsiOverbought}
                    onChange={(e) => setRsiOverbought(Number(e.target.value))}
                    className="w-full bg-[#0B0F14] border border-[#1B222D] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-[#10151C] rounded-2xl border border-[#1B222D] text-[11px] text-slate-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Simulated Exchange Fee:</span>
                <span className="font-mono text-slate-200 font-bold">0.05%</span>
              </div>
              <div className="flex justify-between">
                <span>Execution Slippage:</span>
                <span className="font-mono text-slate-200 font-bold">0.05%</span>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning}
              className="w-full py-3.5 rounded-full bg-[#CCFF00] text-black font-extrabold text-xs hover:bg-[#D4FF33] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#CCFF00]/15 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-black" />
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
                <div className="p-5 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Strategy Return</span>
                  <div className={`font-mono text-2xl font-black ${result.totalReturnPercent >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>
                    {formatPercent(result.totalReturnPercent)}
                  </div>
                  <span className="text-[10px] text-slate-500">Benchmark: {formatPercent(result.benchmarkReturnPercent)}</span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Max Drawdown</span>
                  <div className="font-mono text-2xl font-black text-red-400">
                    -{result.maxDrawdownPercent.toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-slate-500">Peak-to-trough decline</span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Win Rate</span>
                  <div className="font-mono text-2xl font-black text-white">
                    {result.winRatePercent.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-500">{result.winningTrades} of {result.totalTrades} trades</span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Profit Factor</span>
                  <div className="font-mono text-2xl font-black text-[#CCFF00]">
                    {result.profitFactor.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500">Gross Win / Gross Loss</span>
                </div>
              </div>

              {/* Trade Log Table */}
              <div className="rounded-3xl bg-[#0B0F14] border border-[#1B222D] overflow-hidden space-y-3 p-6">
                <h3 className="font-extrabold text-base text-white">Simulated Execution Log ({result.trades.length} trades)</h3>
                {result.trades.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1B222D] bg-[#10151C]/60 text-slate-400 font-bold">
                          <th className="py-3 px-4 rounded-l-xl">Entry</th>
                          <th className="py-3 px-4">Exit</th>
                          <th className="py-3 px-4 text-right">Entry Price</th>
                          <th className="py-3 px-4 text-right">Exit Price</th>
                          <th className="py-3 px-4 text-right">Shares</th>
                          <th className="py-3 px-4 text-right rounded-r-xl">Net P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1B222D]/60 font-mono">
                        {result.trades.map((t, idx) => (
                          <tr key={idx} className="hover:bg-[#10151C]/40 transition-colors">
                            <td className="py-3 px-4 text-slate-300">{t.entryDate}</td>
                            <td className="py-3 px-4 text-slate-300">{t.exitDate}</td>
                            <td className="py-3 px-4 text-right text-slate-200">{formatCurrency(t.entryPrice)}</td>
                            <td className="py-3 px-4 text-right text-slate-200">{formatCurrency(t.exitPrice)}</td>
                            <td className="py-3 px-4 text-right text-white font-bold">{t.quantity}</td>
                            <td className={`py-3 px-4 text-right font-black ${t.pnl >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>
                              {formatCurrency(t.pnl)} ({formatPercent(t.pnlPercent)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No crossover or trigger signals generated during this lookback window. Try adjusting the period lengths or expanding the lookback range.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-16 rounded-3xl bg-[#0B0F14] border border-[#1B222D] text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#10151C] border border-[#1B222D] flex items-center justify-center mx-auto text-[#CCFF00]">
                <FlaskConical className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-white text-lg">Ready for Strategy Backtest</h3>
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
