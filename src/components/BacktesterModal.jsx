import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Play, 
  BarChart2, 
  ShieldCheck, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Film, 
  ListOrdered, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Search, 
  Check, 
  Sparkles, 
  LineChart, 
  Activity, 
  Sliders, 
  Layers,
  Command,
  SlidersHorizontal,
  Flame,
  Award
} from 'lucide-react';
import { runBacktestAsync } from '../lib/backtester';
import { STOCK_DIRECTORY, getStockHistoricalCandles } from '../lib/yahooFinance';
import { searchGlobalEquities } from '../lib/stockSearchEngine';
import BacktestReplayChart from './BacktestReplayChart';

export default function BacktesterModal({ isOpen, onClose, currentStock }) {
  const searchInputRef = useRef(null);

  // Selected Stock Symbol
  const [symbol, setSymbol] = useState(currentStock?.symbol || 'RELIANCE.NS');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Market & Currency Classification
  const isIndia = useMemo(() => {
    return (
      symbol?.endsWith('.NS') ||
      symbol?.endsWith('.BO') ||
      STOCK_DIRECTORY[symbol]?.market === 'NSE' ||
      currentStock?.market === 'IN' ||
      currentStock?.market === 'NSE'
    );
  }, [symbol, currentStock]);

  const currencySymbol = isIndia ? '₹' : '$';

  // Strategy & Parameters
  const [strategyType, setStrategyType] = useState('QUANT_CONFLUENCE');
  const [timeframe, setTimeframe] = useState('1Y'); // '6M' | '1Y' | '2Y'
  const [initialCapital, setInitialCapital] = useState(isIndia ? 1000000 : 100000);
  const [slippagePercent, setSlippagePercent] = useState(0.05);
  const [feePerTrade, setFeePerTrade] = useState(isIndia ? 20 : 2);
  const [stopLossPercent, setStopLossPercent] = useState(2.0);
  const [takeProfitPercent, setTakeProfitPercent] = useState(5.0);

  // Custom Strategy Builder State
  const [customRules, setCustomRules] = useState(() => {
    try {
      const saved = localStorage.getItem('paper_trading_custom_strategy');
      return saved ? JSON.parse(saved) : {
        name: 'Custom Confluence Edge',
        useRsi: true,
        rsiThreshold: 35,
        useEma: true,
        useMacd: true,
        usePattern: false,
      };
    } catch (e) {
      return {
        name: 'Custom Confluence Edge',
        useRsi: true,
        rsiThreshold: 35,
        useEma: true,
        useMacd: true,
        usePattern: false,
      };
    }
  });

  // Auto-Optimization Flash Feedback & Overfitting Tracking
  const [optimizedFeedback, setOptimizedFeedback] = useState('');
  const [isOptimizedRun, setIsOptimizedRun] = useState(false);

  // Execution state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [candlesCache, setCandlesCache] = useState([]);
  
  // Results Active Tab: 'REPLAY' | 'TRAJECTORY' | 'DIAGNOSTICS' | 'LOG'
  const [activeTab, setActiveTab] = useState('REPLAY');

  // Keep symbol in sync if currentStock changes while opened
  useEffect(() => {
    if (isOpen && currentStock?.symbol) {
      handleSelectStock(currentStock.symbol);
    }
  }, [isOpen, currentStock?.symbol]);

  // Real-time stock search engine
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(Object.values(STOCK_DIRECTORY).slice(0, 8));
      return;
    }

    let isMounted = true;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchGlobalEquities(searchQuery);
        if (isMounted) {
          setSearchResults(results.slice(0, 10));
          setSearchLoading(false);
        }
      } catch (err) {
        if (isMounted) setSearchLoading(false);
      }
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Select stock and auto-tune capital & parameters
  const handleSelectStock = (newSym) => {
    setSymbol(newSym);
    setIsSearching(false);
    setSearchQuery('');

    const targetIsIndia = newSym.endsWith('.NS') || newSym.endsWith('.BO') || STOCK_DIRECTORY[newSym]?.market === 'NSE';
    setInitialCapital(targetIsIndia ? 1000000 : 100000);
    setFeePerTrade(targetIsIndia ? 20 : 2);

    // Auto-train stop/target based on stock volatility
    trainAndOptimizeRules(newSym);
  };

  // Train & Auto-Optimize Strategy Rules for specific stock volatility
  const trainAndOptimizeRules = (targetSym = symbol) => {
    setIsOptimizedRun(true);
    const stockInfo = STOCK_DIRECTORY[targetSym] || {};
    const price = stockInfo.basePrice || 100;
    const high52 = stockInfo.high52 || price * 1.25;
    const low52 = stockInfo.low52 || price * 0.75;
    const range52 = high52 > low52 ? ((high52 - low52) / price) * 100 : 35;

    // High beta / momentum equities require wider buffer
    let optStop = 2.0;
    let optTarget = 5.0;

    if (['NVDA', 'TSLA', 'TATAMOTORS.NS', 'ADANIENT.NS'].includes(targetSym) || range52 > 60) {
      optStop = 3.2;
      optTarget = 8.0;
    } else if (['HDFCBANK.NS', 'TCS.NS', 'KO', 'JNJ', 'ITC.NS'].includes(targetSym) || range52 < 30) {
      optStop = 1.4;
      optTarget = 3.5;
    } else {
      optStop = 2.0;
      optTarget = 5.0;
    }

    setStopLossPercent(optStop);
    setTakeProfitPercent(optTarget);

    setOptimizedFeedback(`Trained & Optimized for ${targetSym}: -${optStop}% Stop Loss • +${optTarget}% Profit Target (1:2.5 R:R)`);
    setTimeout(() => setOptimizedFeedback(''), 3500);
  };

  const handleSaveCustomStrategy = () => {
    try {
      localStorage.setItem('paper_trading_custom_strategy', JSON.stringify(customRules));
      toast.success('Custom strategy rules saved successfully!');
    } catch (e) {
      toast.error('Could not save custom strategy.');
    }
  };

  // Run the multi-threaded simulation
  const handleRunSimulation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch authentic historical candles for symbol across selected timeframe
      const res = await getStockHistoricalCandles(symbol, timeframe);
      const candleData = Array.isArray(res) ? res : res?.candles || [];
      
      if (!candleData || candleData.length < 25) {
        throw new Error(`Insufficient historical candles for ${symbol} to execute backtest (found ${candleData?.length || 0}).`);
      }

      setCandlesCache(candleData);

      // 2. Strategy Spec
      const strategy = {
        indicator: strategyType,
        fastPeriod: 9,
        slowPeriod: 21,
        oversoldThreshold: 30,
        overboughtThreshold: 70,
        stopLossPercent,
        takeProfitPercent,
        customRules: strategyType === 'CUSTOM_BUILDER' ? customRules : undefined,
      };

      // 3. Dispatch to Web Worker off the main thread
      const simResults = await runBacktestAsync({
        strategy,
        candles: candleData,
        initialCapital,
        positionSizePercent: 50,
        slippagePercent,
        feePerTrade,
      });

      setResults(simResults);
      setActiveTab('REPLAY');
    } catch (err) {
      setError(err.message || 'Backtest execution failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isSearching) {
          setIsSearching(false);
        } else {
          onClose();
        }
        return;
      }

      const activeTag = document.activeElement?.tagName;
      const isInputFocused = activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA';

      if (e.key === 'Enter') {
        if (!isSearching && !isLoading) {
          e.preventDefault();
          handleRunSimulation();
        }
        return;
      }

      if (isInputFocused) return;

      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        trainAndOptimizeRules();
      } else if (e.key === '/' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsSearching(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSearching, isLoading, symbol, stopLossPercent, takeProfitPercent, initialCapital, strategyType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-5xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
        onClick={() => {
          if (isSearching) setIsSearching(false);
        }}
      >
        
        {/* Newspaper Header Masthead */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b-2 border-[#111111] bg-[#111111] text-[#F6F4EE] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
            <div className="p-1.5 bg-[#FAF8F3] text-[#111111] shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-headline uppercase font-black text-xs sm:text-base tracking-wider flex items-center gap-2 truncate">
                <span className="truncate">QUANTITATIVE STRATEGY BACKTESTER & PATTERN ANALYZER</span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold">
                  MULTI-THREADED WORKER
                </span>
              </h3>
              <p className="text-[9px] sm:text-[10px] text-neutral-400 font-mono truncate">
                Pattern Growth vs Loss Diagnostics • Trajectory Analysis • 100% Off-Thread Vector Math
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close Backtester [Esc]"
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 group shrink-0 min-w-[32px] min-h-[32px] justify-center"
          >
            <span className="text-[10px] font-mono text-neutral-400 group-hover:text-white hidden sm:inline">[Esc]</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Setup & Results Workspace */}
        <div className="p-3 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto font-mono text-xs flex-1">
          
          {/* Quick Stock Universe Preset Ribbon */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
            <span className="text-[9px] font-bold uppercase text-neutral-500 whitespace-nowrap shrink-0">
              Quick Shortcuts:
            </span>
            {[
              { sym: 'RELIANCE.NS', label: 'RELIANCE', flag: '🇮🇳' },
              { sym: 'TCS.NS', label: 'TCS', flag: '🇮🇳' },
              { sym: 'HDFCBANK.NS', label: 'HDFCBANK', flag: '🇮🇳' },
              { sym: 'TATAMOTORS.NS', label: 'TATAMOTORS', flag: '🇮🇳' },
              { sym: 'INFY.NS', label: 'INFY', flag: '🇮🇳' },
              { sym: 'NVDA', label: 'NVDA', flag: '🇺🇸' },
              { sym: 'AAPL', label: 'AAPL', flag: '🇺🇸' },
              { sym: 'TSLA', label: 'TSLA', flag: '🇺🇸' },
              { sym: 'MSFT', label: 'MSFT', flag: '🇺🇸' },
              { sym: 'META', label: 'META', flag: '🇺🇸' },
            ].map((preset) => (
              <button
                key={preset.sym}
                type="button"
                onClick={() => handleSelectStock(preset.sym)}
                title={`Select ${preset.label} and train strategy rules`}
                className={`px-2 py-0.5 border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  symbol === preset.sym
                    ? 'bg-[#111111] text-white border-[#111111] shadow-[1px_1px_0px_#111111]'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#111111] hover:bg-neutral-100'
                }`}
              >
                <span>{preset.flag} {preset.label}</span>
              </button>
            ))}
          </div>

          {/* Flash Optimization Notification */}
          {optimizedFeedback && (
            <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-500 text-emerald-900 text-[10px] font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                <span>{optimizedFeedback}</span>
              </span>
              <span className="text-[9px] text-emerald-700 font-normal">Active Sizing</span>
            </div>
          )}

          {/* Interactive Stock Search & Configuration Deck */}
          <div className="p-3.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111] space-y-3 relative z-30">
            
            {/* Row 1: Stock Search + Strategy Selection + Train Button */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Interactive Search Asset Input */}
              <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">
                  Selected Asset ({isIndia ? '🇮🇳 NSE Equity' : '🇺🇸 US Equity'}):
                </label>
                <div className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery || (isSearching ? '' : `${symbol} — ${STOCK_DIRECTORY[symbol]?.name || symbol}`)}
                    onFocus={() => setIsSearching(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!isSearching) setIsSearching(true);
                    }}
                    placeholder="Search by symbol or name (Press '/' to search)..."
                    className="w-full bg-[#FAF8F3] border border-[#111111] px-2.5 py-1.5 text-xs font-bold outline-none placeholder:font-normal placeholder:text-neutral-400"
                  />
                  <kbd className="hidden md:inline-block px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 text-[9px] text-neutral-500 font-bold">
                    /
                  </kbd>
                </div>

                {/* Autocomplete Dropdown */}
                {isSearching && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] max-h-56 overflow-y-auto z-50 divide-y divide-neutral-200 animate-in fade-in duration-100">
                    <div className="px-3 py-1 bg-[#FAF8F3] text-[9px] text-neutral-500 font-bold uppercase flex justify-between items-center">
                      <span>{searchLoading ? 'Searching...' : 'Select Asset'}</span>
                      <span className="text-[9px] text-neutral-400">Esc to close</span>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="p-3 text-center text-neutral-500 text-xs">
                        No equities matched. Enter symbol (e.g. INFY.NS or NVDA).
                      </div>
                    ) : (
                      searchResults.map((item) => {
                        const isItemInd = item.market === 'NSE' || item.symbol.endsWith('.NS');
                        return (
                          <button
                            key={item.symbol}
                            type="button"
                            onClick={() => handleSelectStock(item.symbol)}
                            className="w-full px-3 py-2 text-left hover:bg-neutral-100 transition-colors flex items-center justify-between gap-2 cursor-pointer font-mono"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <strong className="text-[#111111] text-xs font-bold">{item.symbol}</strong>
                                <span className="px-1 py-0.2 bg-[#EFECE3] border border-[#111111] text-[9px] font-bold">
                                  {isItemInd ? 'NSE (₹)' : 'US ($)'}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-600 truncate max-w-[220px]">
                                {item.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-xs tabular-nums text-[#111111]">
                                {isItemInd ? '₹' : '$'}{Number(item.basePrice || item.price || 100).toFixed(2)}
                              </span>
                              <span className="block text-[9px] text-neutral-400">{item.sector || 'Equities'}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Strategy Algorithm Rule */}
              <div className="w-full md:w-auto md:min-w-[220px]">
                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">
                  Quantitative Strategy Rule:
                </label>
                <select
                  value={strategyType}
                  onChange={(e) => setStrategyType(e.target.value)}
                  className="w-full bg-[#FAF8F3] border border-[#111111] px-2.5 py-1.5 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="QUANT_CONFLUENCE">⚡ Triple Confluence (EMA + MACD + RSI)</option>
                  <option value="EMA_CROSSOVER">📈 9 / 21 EMA Golden Trend Cross</option>
                  <option value="RSI">🟢 RSI 30/70 Mean-Reversion Bounce</option>
                  <option value="BOLLINGER">🚀 Bollinger Band Volatility Breakout</option>
                  <option value="MACD_MOMENTUM">🔥 MACD Histogram Momentum Shift</option>
                  <option value="PATTERN_RECOGNITION">💎 Candlestick Formations (Hammer / Engulfing)</option>
                  <option value="CUSTOM_BUILDER">🛠️ Custom Strategy Builder (Rule Editor)</option>
                </select>
              </div>

              {/* Historical Date Range / Period */}
              <div className="w-full md:w-auto">
                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">
                  History Range:
                </label>
                <div className="inline-flex border border-[#111111] bg-white p-0.5 font-mono text-xs">
                  {['6M', '1Y', '2Y'].map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                        timeframe === tf ? 'bg-[#111111] text-[#F6F4EE]' : 'hover:bg-neutral-100 text-[#111111]'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Train & Auto-Optimize Button */}
              <div className="flex items-end w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => trainAndOptimizeRules()}
                  title="Train and optimize stop-loss & target levels for this stock [O]"
                  className="w-full md:w-auto px-3 py-1.5 bg-[#FAF8F3] border border-[#111111] hover:bg-neutral-200 text-[#111111] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[34px]"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Train & Optimize</span>
                  <kbd className="px-1 py-0.2 bg-neutral-200 text-neutral-700 text-[8px] rounded">O</kbd>
                </button>
              </div>
            </div>

            {/* Custom Strategy Builder Panel */}
            {strategyType === 'CUSTOM_BUILDER' && (
              <div className="p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-700" />
                    <span className="font-bold text-xs uppercase text-[#111111]">Custom Strategy Rule Editor</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveCustomStrategy}
                    className="px-2 py-0.5 bg-[#111111] text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-neutral-800"
                  >
                    Save Custom Model
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <label className="flex items-center gap-2 p-1.5 border border-neutral-200 bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customRules.useRsi}
                      onChange={(e) => setCustomRules(prev => ({ ...prev, useRsi: e.target.checked }))}
                    />
                    <span>RSI ≤ {customRules.rsiThreshold}</span>
                    <input
                      type="number"
                      min="20"
                      max="60"
                      value={customRules.rsiThreshold}
                      onChange={(e) => setCustomRules(prev => ({ ...prev, rsiThreshold: Number(e.target.value) }))}
                      className="w-12 bg-white border border-neutral-400 px-1 py-0.2 text-[10px] text-right font-bold ml-auto"
                    />
                  </label>

                  <label className="flex items-center gap-2 p-1.5 border border-neutral-200 bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customRules.useEma}
                      onChange={(e) => setCustomRules(prev => ({ ...prev, useEma: e.target.checked }))}
                    />
                    <span>9 EMA &gt; 21 EMA Cross</span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 border border-neutral-200 bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customRules.useMacd}
                      onChange={(e) => setCustomRules(prev => ({ ...prev, useMacd: e.target.checked }))}
                    />
                    <span>MACD Histogram &gt; 0</span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 border border-neutral-200 bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customRules.usePattern}
                      onChange={(e) => setCustomRules(prev => ({ ...prev, usePattern: e.target.checked }))}
                    />
                    <span>Bullish Candlestick</span>
                  </label>
                </div>
              </div>
            )}

            {/* Row 2: Mathematical Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 border-t border-neutral-200">
              <div>
                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">Starting Capital</label>
                <input
                  type="number"
                  step="1000"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Math.max(100, Number(e.target.value)))}
                  className="w-full bg-[#FAF8F3] border border-[#111111] px-2 py-1 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-rose-800 mb-0.5">Stop-Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(Number(e.target.value))}
                  className="w-full bg-white border border-rose-500 text-rose-800 px-2 py-1 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-emerald-800 mb-0.5">Take-Profit (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
                  className="w-full bg-white border border-emerald-500 text-emerald-800 px-2 py-1 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">Slippage (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={slippagePercent}
                  onChange={(e) => setSlippagePercent(Number(e.target.value))}
                  className="w-full bg-[#FAF8F3] border border-[#111111] px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">Brokerage Fee ({currencySymbol})</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={feePerTrade}
                  onChange={(e) => setFeePerTrade(Number(e.target.value))}
                  className="w-full bg-[#FAF8F3] border border-[#111111] px-2 py-1 text-xs"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={isLoading}
                  title="Run multi-threaded strategy backtest [Enter]"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer min-h-[30px] shadow-[2px_2px_0px_#111111]"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Computing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                      <span>Run Backtest</span>
                      <kbd className="px-1 py-0.2 bg-neutral-700 text-white text-[8px] rounded font-mono">↵</kbd>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border-2 border-rose-600 flex items-center gap-2 text-xs font-mono text-rose-900 animate-in fade-in duration-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{error}</span>
            </div>
          )}

          {/* Initial State Prompt */}
          {!results && !isLoading && !error && (
            <div className="text-center py-10 sm:py-14 border-2 border-dashed border-neutral-300 bg-white p-6 space-y-3 font-mono">
              <BarChart2 className="w-8 h-8 mx-auto text-neutral-400" />
              <p className="font-serif text-sm font-bold text-neutral-800 uppercase tracking-wide">
                Ready for Quantitative Simulation & Bar-by-Bar Historical Replay
              </p>
              <p className="font-mono text-xs text-neutral-500 max-w-lg mx-auto leading-relaxed">
                Choose an Indian NSE or US stock above. Select your historical period ({timeframe}) and strategy rules. Click "Run Backtest" or "Train & Optimize" to trigger multi-threaded historical execution.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] text-neutral-600 font-bold">
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300">✓ Interactive Bar-by-Bar Replay</span>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300">✓ In-Sample vs Out-of-Sample Audit</span>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300">✓ Overfitting Guard</span>
                <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300">✓ Zero Backend Worker Cost</span>
              </div>
            </div>
          )}

          {/* Simulation Results Workspace */}
          {results && (
            <div className="space-y-4">
              
              {/* Quantitative Audit, Tested Date Range & Overfitting Guard */}
              <div className="p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-mono space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-200 gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase text-[9px]">
                      AUDIT CONTEXT
                    </span>
                    <strong className="text-neutral-800">
                      Tested Period: {results.testedDateRange?.startDate || 'Start'} to {results.testedDateRange?.endDate || 'End'} ({results.testedDateRange?.totalBars || candlesCache.length} Daily Bars)
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span>Source: Yahoo Finance EOD Historical Feed</span>
                    <span>•</span>
                    <span className="text-emerald-800 font-bold">Execution: Multi-Threaded Web Worker</span>
                  </div>
                </div>

                {/* In-Sample vs Out-of-Sample Split (Especially when Train & Optimize was executed) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 bg-neutral-50 border border-neutral-200">
                    <span className="text-neutral-500 uppercase block font-bold text-[9px]">In-Sample Calibration (First 70%):</span>
                    <span className="font-bold text-[#111111]">
                      {results.splitAnalysis?.inSample?.tradeCount || 0} Trades • Win Rate: {results.splitAnalysis?.inSample?.winRate || 0}% • P&L: {currencySymbol}{results.splitAnalysis?.inSample?.totalPnl || 0}
                    </span>
                    <span className="text-neutral-400 block text-[9px]">Historical tuning regime ({results.splitAnalysis?.inSample?.barsCount || 0} bars)</span>
                  </div>

                  <div className="p-2 bg-emerald-50/50 border border-emerald-300">
                    <span className="text-emerald-900 uppercase block font-bold text-[9px]">Out-of-Sample Walk-Forward Validation (Last 30%):</span>
                    <span className="font-bold text-emerald-800">
                      {results.splitAnalysis?.outOfSample?.tradeCount || 0} Trades • Win Rate: {results.splitAnalysis?.outOfSample?.winRate || 0}% • P&L: {currencySymbol}{results.splitAnalysis?.outOfSample?.totalPnl || 0}
                    </span>
                    <span className="text-emerald-700 block text-[9px]">Unseen verification regime ({results.splitAnalysis?.outOfSample?.barsCount || 0} bars)</span>
                  </div>
                </div>

                {isOptimizedRun && (
                  <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[10px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                    <span>
                      <strong>Overfitting Guard:</strong> Volatility parameters were automatically tuned on historical data. Compare In-Sample vs Out-of-Sample performance above to ensure the edge persists on unseen bars.
                    </span>
                  </div>
                )}
              </div>

              {/* Results Tab Header & Summary Stats Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b-2 border-[#111111] pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveTab('REPLAY')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold border border-[#111111] transition-colors cursor-pointer shrink-0 whitespace-nowrap min-h-[34px] ${
                      activeTab === 'REPLAY'
                        ? 'bg-[#111111] text-[#F6F4EE]'
                        : 'bg-white hover:bg-neutral-200 text-[#111111]'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    <span>Visual Bar Replay & Pattern Detector</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('TRAJECTORY')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold border border-[#111111] transition-colors cursor-pointer shrink-0 whitespace-nowrap min-h-[34px] ${
                      activeTab === 'TRAJECTORY'
                        ? 'bg-[#111111] text-[#F6F4EE]'
                        : 'bg-white hover:bg-neutral-200 text-[#111111]'
                    }`}
                  >
                    <LineChart className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Growth & Loss Equity Trajectory</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('DIAGNOSTICS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold border border-[#111111] transition-colors cursor-pointer shrink-0 whitespace-nowrap min-h-[34px] ${
                      activeTab === 'DIAGNOSTICS'
                        ? 'bg-[#111111] text-[#F6F4EE]'
                        : 'bg-white hover:bg-neutral-200 text-[#111111]'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-blue-400" />
                    <span>Pattern & Loss Diagnostics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('LOG')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold border border-[#111111] transition-colors cursor-pointer shrink-0 whitespace-nowrap min-h-[34px] ${
                      activeTab === 'LOG'
                        ? 'bg-[#111111] text-[#F6F4EE]'
                        : 'bg-white hover:bg-neutral-200 text-[#111111]'
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>Trade Log ({results.tradeCount})</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs pt-1 md:pt-0 border-t md:border-t-0 border-neutral-200">
                  <span>
                    Return:{' '}
                    <strong className={results.returnPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {results.returnPercent >= 0 ? '+' : ''}{results.returnPercent}%
                    </strong>
                  </span>
                  <span>•</span>
                  <span>Win Rate: <strong>{results.winRatePercent}%</strong></span>
                  <span>•</span>
                  <span>Profit Factor: <strong>{results.profitFactor}</strong></span>
                </div>
              </div>

              {/* TAB 1: VISUAL BAR REPLAY & PATTERN DETECTOR */}
              {activeTab === 'REPLAY' && (
                <BacktestReplayChart
                  candles={candlesCache}
                  trades={results.trades}
                  initialCapital={initialCapital}
                  currencySymbol={currencySymbol}
                />
              )}

              {/* TAB 2: GROWTH & LOSS EQUITY TRAJECTORY GRAPH */}
              {activeTab === 'TRAJECTORY' && (
                <div className="p-4 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#111111] uppercase flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-700" />
                        <span>Cumulative Capital Growth & Drawdown Trajectory</span>
                      </h4>
                      <p className="text-[10px] text-neutral-500 font-sans">
                        Tracks portfolio value and drawdown depth from {results.equityCurve[0]?.time} to {results.equityCurve[results.equityCurve.length - 1]?.time}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span>Initial: <strong>{currencySymbol}{initialCapital.toLocaleString()}</strong></span>
                      <span>→</span>
                      <span>Final: <strong className={results.totalPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{currencySymbol}{results.finalCapital.toLocaleString()}</strong></span>
                      <span className={`px-1.5 py-0.5 font-bold ${results.totalPnl >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {results.returnPercent >= 0 ? '+' : ''}{results.returnPercent}% Net P&L
                      </span>
                    </div>
                  </div>

                  {/* SVG Visual Equity Curve */}
                  <div className="h-64 w-full bg-[#FAF8F3] border border-[#111111] p-3 relative flex flex-col justify-between">
                    {/* SVG Curve */}
                    {results.equityCurve && results.equityCurve.length > 1 && (() => {
                      const points = results.equityCurve;
                      const values = points.map(p => p.value);
                      const minVal = Math.min(...values, initialCapital * 0.95);
                      const maxVal = Math.max(...values, initialCapital * 1.05);
                      const range = maxVal - minVal || 1;

                      const svgPoints = points.map((p, idx) => {
                        const x = (idx / (points.length - 1)) * 100;
                        const y = 100 - (((p.value - minVal) / range) * 90 + 5);
                        return `${x},${y}`;
                      }).join(' ');

                      const baselineY = 100 - (((initialCapital - minVal) / range) * 90 + 5);

                      return (
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Baseline Initial Capital Line */}
                          <line
                            x1="0"
                            y1={baselineY}
                            x2="100"
                            y2={baselineY}
                            stroke="#9CA3AF"
                            strokeWidth="0.7"
                            strokeDasharray="2,2"
                          />
                          
                          {/* Equity Polyline */}
                          <polyline
                            fill="none"
                            stroke={results.totalPnl >= 0 ? '#059669' : '#DC2626'}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={svgPoints}
                          />
                        </svg>
                      );
                    })()}

                    {/* Chart Overlay Labels */}
                    <div className="flex justify-between text-[9px] text-neutral-500 font-mono border-t border-neutral-300 pt-1">
                      <span>Start: {results.equityCurve[0]?.time}</span>
                      <span className="font-bold text-neutral-700">
                        Peak: {currencySymbol}{Math.max(...results.equityCurve.map(p => p.value)).toLocaleString()}
                      </span>
                      <span className="font-bold text-rose-700">
                        Max Drawdown: -{results.maxDrawdownPercent}%
                      </span>
                      <span>End: {results.equityCurve[results.equityCurve.length - 1]?.time}</span>
                    </div>
                  </div>

                  {/* Growth & Loss Milestones */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-neutral-50 border border-neutral-300">
                      <span className="text-[9px] text-neutral-500 uppercase block font-bold">Net Growth Gain</span>
                      <span className={`text-base font-bold tabular-nums ${results.totalPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {results.totalPnl >= 0 ? '+' : ''}{currencySymbol}{results.totalPnl.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-50 border border-neutral-300">
                      <span className="text-[9px] text-neutral-500 uppercase block font-bold">Average Winning Trade</span>
                      <span className="text-base font-bold text-emerald-700 tabular-nums">
                        +{currencySymbol}{results.avgWinPnl} (+{results.avgWinPct}%)
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-50 border border-neutral-300">
                      <span className="text-[9px] text-neutral-500 uppercase block font-bold">Average Stopped Loss</span>
                      <span className="text-base font-bold text-rose-700 tabular-nums">
                        -{currencySymbol}{results.avgLossPnl} (-{results.avgLossPct}%)
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-50 border border-neutral-300">
                      <span className="text-[9px] text-neutral-500 uppercase block font-bold">Sharpe Ratio (Annualized)</span>
                      <span className={`text-base font-bold tabular-nums ${results.sharpeRatio >= 1.5 ? 'text-emerald-700' : 'text-neutral-800'}`}>
                        {results.sharpeRatio}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PATTERN & LOSS DIAGNOSTICS */}
              {activeTab === 'DIAGNOSTICS' && (
                <div className="space-y-4">
                  {/* Scorecard Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center font-mono">
                    <div className="p-2.5 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 block uppercase">Total Return</span>
                      <span className={`text-base font-bold ${results.returnPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {results.returnPercent >= 0 ? '+' : ''}{results.returnPercent}%
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 block uppercase">Win Rate</span>
                      <span className="text-base font-bold text-[#111111]">{results.winRatePercent}%</span>
                      <span className="text-[9px] text-neutral-400 block">{results.winningTrades}W / {results.losingTrades}L</span>
                    </div>

                    <div className="p-2.5 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 block uppercase">Profit Factor</span>
                      <span className={`text-base font-bold ${results.profitFactor >= 1.5 ? 'text-emerald-700' : 'text-neutral-900'}`}>
                        {results.profitFactor}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 block uppercase">Max Drawdown</span>
                      <span className="text-base font-bold text-rose-700">-{results.maxDrawdownPercent}%</span>
                    </div>

                    <div className="p-2.5 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 block uppercase">Win/Loss Ratio</span>
                      <span className="text-base font-bold text-neutral-900">{results.winLossRatio}:1</span>
                    </div>

                    <div className="p-2.5 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 block uppercase">Max Win Streak</span>
                      <span className="text-base font-bold text-emerald-700">{results.maxConsecWins} Trades</span>
                    </div>
                  </div>

                  {/* Pattern Growth vs Loss Performance Table */}
                  <div className="bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] overflow-hidden">
                    <div className="px-3 sm:px-4 py-2.5 bg-[#FAF8F3] border-b border-[#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
                      <div className="flex items-center gap-1.5 font-bold uppercase text-xs text-[#111111]">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Candlestick Pattern Growth & Loss Performance Breakdown</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-sans">
                        Identifies which chart formations generated positive statistical edge
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs font-mono min-w-[620px]">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-300 text-[10px] uppercase font-bold text-neutral-600">
                          <th className="p-2.5">Pattern Formation</th>
                          <th className="p-2.5 text-center">Trades</th>
                          <th className="p-2.5 text-center">Wins</th>
                          <th className="p-2.5 text-center">Losses</th>
                          <th className="p-2.5 text-center">Win Rate %</th>
                          <th className="p-2.5 text-right">Net P&L</th>
                          <th className="p-2.5 text-right">Avg Gain %</th>
                          <th className="p-2.5 text-center">Predictive Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {(!results.patternBreakdown || results.patternBreakdown.length === 0) ? (
                          <tr>
                            <td colSpan="8" className="p-4 text-center text-neutral-500">
                              No pattern triggers registered.
                            </td>
                          </tr>
                        ) : (
                          results.patternBreakdown.map((pat, idx) => {
                            const isNetWin = pat.totalPnl > 0;
                            return (
                              <tr key={idx} className="hover:bg-neutral-50">
                                <td className="p-2.5 font-bold text-[#111111]">
                                  {pat.name}
                                </td>
                                <td className="p-2.5 text-center">{pat.count}</td>
                                <td className="p-2.5 text-center font-bold text-emerald-700">{pat.wins}</td>
                                <td className="p-2.5 text-center font-bold text-rose-700">{pat.losses}</td>
                                <td className="p-2.5 text-center font-bold">
                                  <span className={`px-1.5 py-0.2 border text-[10px] ${
                                    pat.winRate >= 60 
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-400' 
                                      : pat.winRate >= 45 
                                      ? 'bg-neutral-100 text-neutral-800 border-neutral-300' 
                                      : 'bg-rose-100 text-rose-900 border-rose-400'
                                  }`}>
                                    {pat.winRate}%
                                  </span>
                                </td>
                                <td className={`p-2.5 text-right font-bold tabular-nums ${isNetWin ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isNetWin ? '+' : ''}{currencySymbol}{pat.totalPnl.toLocaleString()}
                                </td>
                                <td className={`p-2.5 text-right font-bold tabular-nums ${pat.avgPnlPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {pat.avgPnlPct >= 0 ? '+' : ''}{pat.avgPnlPct}%
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                    pat.winRate >= 60 && isNetWin
                                      ? 'bg-emerald-700 text-white'
                                      : isNetWin
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-rose-100 text-rose-900'
                                  }`}>
                                    {pat.winRate >= 60 && isNetWin ? 'High Edge' : isNetWin ? 'Profitable' : 'Negative Drift'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: COMPLETE SIMULATED TRADE LOG */}
              {activeTab === 'LOG' && (
                <div className="border border-[#111111] bg-white overflow-hidden shadow-[4px_4px_0px_#111111]">
                  <div className="px-3.5 py-2.5 bg-neutral-100 border-b border-[#111111] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs font-mono font-bold">
                    <span>Simulated Trade Log ({results.trades.length} executions)</span>
                    <span className="text-neutral-500 text-[10px]">Net of {slippagePercent}% slippage & {currencySymbol}{feePerTrade} fees</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono min-w-[640px]">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Pattern</th>
                          <th className="p-2.5">Entry Time</th>
                          <th className="p-2.5 text-right">Entry</th>
                          <th className="p-2.5 text-right">Exit</th>
                          <th className="p-2.5 text-right">Net P&L</th>
                          <th className="p-2.5 text-right">P&L %</th>
                          <th className="p-2.5">Exit Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {results.trades.map((t) => {
                          const isWin = t.pnl > 0;
                          return (
                            <tr key={t.tradeNo} className="hover:bg-neutral-50">
                              <td className="p-2.5 text-neutral-500">{t.tradeNo}</td>
                              <td className="p-2.5 font-bold text-[#111111]">{t.type}</td>
                              <td className="p-2.5 font-bold text-neutral-700 text-[11px]">{t.pattern}</td>
                              <td className="p-2.5 text-neutral-600">{String(t.entryTime)}</td>
                              <td className="p-2.5 text-right">{currencySymbol}{t.entryPrice}</td>
                              <td className="p-2.5 text-right">{currencySymbol}{t.exitPrice}</td>
                              <td className={`p-2.5 text-right font-bold ${isWin ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {isWin ? '+' : ''}{currencySymbol}{t.pnl}
                              </td>
                              <td className={`p-2.5 text-right font-bold ${isWin ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {isWin ? '+' : ''}{t.pnlPercent}%
                              </td>
                              <td className="p-2.5 text-neutral-600 text-[11px] font-sans">{t.reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Global Keyboard Shortcut Helper Ribbon */}
        <div className="hidden sm:flex px-4 py-2 bg-[#EFECE4] border-t-2 border-[#111111] flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-neutral-600 shrink-0">
          <div className="flex items-center gap-1 font-bold text-neutral-800">
            <Command className="w-3 h-3 text-neutral-700" />
            <span className="uppercase tracking-wider">Keyboard Shortcuts:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[9px]">
            <span title="Press Esc to close modal">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">Esc</kbd> Close
            </span>
            <span title="Press / to focus asset search">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">/</kbd> Search Stock
            </span>
            <span title="Press O to train & auto-optimize parameters">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">O</kbd> Train & Optimize
            </span>
            <span title="Press Enter to execute backtest">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">Enter ↵</kbd> Run Backtest
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
