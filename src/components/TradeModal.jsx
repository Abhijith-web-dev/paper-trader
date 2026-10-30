import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { STOCK_DIRECTORY, getStockQuote, registerDynamicStock } from '../lib/yahooFinance';
import { registerLiveSymbols } from '../lib/omniFeed';
import { searchGlobalEquities } from '../lib/stockSearchEngine';
import { isMarketOpenForSymbol } from '../lib/marketHours';
import { getQuoteFreshness } from '../lib/quoteFreshness';
import MarketStatusBadge from './MarketStatusBadge';
import HoldingSparkline from './HoldingSparkline';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  AlertCircle, 
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  Search,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function TradeModal({ 
  isOpen, 
  onClose, 
  initialSymbol, 
  stock, 
  initialAction = 'BUY',
  initialQty = 1 
}) {
  const { userProfile, executeOrder, revertOrder } = useAuth();
  
  const parseSymbol = (val) => {
    if (!val) return 'RELIANCE.NS';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val.symbol) return String(val.symbol);
    return 'RELIANCE.NS';
  };

  const startingSymbol = parseSymbol(initialSymbol || stock);

  // All Hooks MUST be at the top unconditionally
  const [selectedSymbol, setSelectedSymbol] = useState(startingSymbol);
  const [tickerSearch, setTickerSearch] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [action, setAction] = useState(initialAction); // 'BUY' | 'SELL'
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [quantity, setQuantity] = useState(initialQty || 1);
  const [limitPrice, setLimitPrice] = useState(100);
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [allowSandbox, setAllowSandbox] = useState(() => {
    try {
      return localStorage.getItem('paper_trading_sandbox_after_hours') === 'true';
    } catch {
      return false;
    }
  });

  const [marketInfo, setMarketInfo] = useState(() => isMarketOpenForSymbol(startingSymbol));

  // Auto-register selectedSymbol if not in directory & register in central batch feed
  useEffect(() => {
    if (!selectedSymbol) return;
    registerLiveSymbols(selectedSymbol);
    if (!STOCK_DIRECTORY[selectedSymbol]) {
      const isInd = selectedSymbol.endsWith('.NS') || selectedSymbol.endsWith('.BO');
      registerDynamicStock({
        symbol: selectedSymbol,
        ticker: selectedSymbol.replace(/\.(NS|BO)$/, ''),
        name: selectedSymbol,
        market: isInd ? 'NSE' : 'US',
        currency: isInd ? 'INR' : 'USD',
        price: 100,
      });
    }
  }, [selectedSymbol]);

  // Debounced search for auto-suggestions inside TradeModal
  useEffect(() => {
    const q = tickerSearch.trim();
    if (!q) {
      setSearchSuggestions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchGlobalEquities(q);
        if (active) {
          setSearchSuggestions(results.slice(0, 8));
        }
      } catch (e) {}
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tickerSearch]);

  // Hook 1: Sync selected symbol and defaults when modal opens or props change
  useEffect(() => {
    if (!isOpen) return;
    const sym = parseSymbol(initialSymbol || stock);
    if (sym) {
      setSelectedSymbol(sym);
    }
    if (initialAction) {
      setAction(initialAction);
    }
    if (initialQty) {
      setQuantity(Math.max(1, Number(initialQty) || 1));
    }
    setError('');
  }, [initialSymbol, stock, initialAction, initialQty, isOpen]);

  // Hook 2: Fetch live quote for the active symbol
  useEffect(() => {
    if (!isOpen || !selectedSymbol) return;

    let mounted = true;
    setLoadingQuote(true);
    setError('');

    getStockQuote(selectedSymbol)
      .then((data) => {
        if (mounted && data) {
          setQuote(data);
          if (data.price) {
            setLimitPrice(Number(data.price.toFixed(2)));
          }
          setLoadingQuote(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Quote fetch warning:', err);
          setLoadingQuote(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedSymbol, isOpen]);

  // Hook 3: Real-world exchange market status check
  useEffect(() => {
    if (!selectedSymbol) return;
    setMarketInfo(isMarketOpenForSymbol(selectedSymbol));
  }, [selectedSymbol, allowSandbox]);

  // Hook 4: Escape key handler to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Hook 4: Memoized Financial & Position Analytics
  const isIndia = String(selectedSymbol || '').endsWith('.NS') || selectedSymbol?.endsWith('.BO');
  const currencySymbol = isIndia ? '₹' : '$';
  const walletKey = isIndia ? 'inr' : 'usd';
  const cashBalance = userProfile?.wallets?.[walletKey]?.cashBalance ?? (isIndia ? 1000000 : 100000);

  // User holdings check
  const holdingKey = (selectedSymbol || '').replace(/[^a-zA-Z0-9]/g, '_');
  const existingHolding = userProfile?.holdings?.[holdingKey];
  const sharesOwned = existingHolding?.quantity || 0;
  const avgBuyPrice = existingHolding?.avgBuyPrice || 0;

  // Active execution price (market price or custom limit price)
  const currentMarketPrice = quote?.price || STOCK_DIRECTORY[selectedSymbol]?.basePrice || 100;
  const executionPrice = orderType === 'LIMIT' ? Number(limitPrice) || currentMarketPrice : currentMarketPrice;
  const totalCost = Number((quantity * executionPrice).toFixed(2));

  // P&L Estimation on SELL
  const estSellPnL = action === 'SELL' ? Number(((executionPrice - avgBuyPrice) * quantity).toFixed(2)) : 0;
  const estSellPnLPct = avgBuyPrice > 0 ? Number((((executionPrice - avgBuyPrice) / avgBuyPrice) * 100).toFixed(2)) : 0;
  const isProfit = estSellPnL >= 0;

  // Balance remaining
  const remainingCash = action === 'BUY' ? cashBalance - totalCost : cashBalance + totalCost;

  // Quote freshness and telemetry
  const freshness = useMemo(() => {
    return getQuoteFreshness(quote);
  }, [quote]);

  const handleRefreshQuote = async () => {
    setLoadingQuote(true);
    try {
      const live = await getStockQuote(selectedSymbol);
      if (live) {
        setQuote(live);
        if (live.price && orderType === 'MARKET') {
          setLimitPrice(Number(live.price.toFixed(2)));
        }
        toast.success(`Quote refreshed: ${selectedSymbol} at ${currencySymbol}${live.price?.toFixed(2)}`);
      }
    } catch (e) {
      toast.error('Could not refresh quote.');
    } finally {
      setLoadingQuote(false);
    }
  };

  // Return early ONLY after all hooks have been declared!
  if (!isOpen) return null;

  // Quick Sizing Handlers
  const handleSetAllocation = (percent) => {
    if (action === 'BUY') {
      const budget = cashBalance * (percent / 100);
      const calculatedQty = Math.floor(budget / executionPrice);
      setQuantity(Math.max(1, calculatedQty));
    } else {
      const calculatedQty = Math.floor(sharesOwned * (percent / 100));
      setQuantity(Math.max(1, calculatedQty));
    }
  };

  const handleAdjustQty = (delta) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (action === 'SELL' && next > sharesOwned) return sharesOwned;
      return next;
    });
  };

  // Execution Handler
  const handleExecute = async (e) => {
    e.preventDefault();
    setError('');

    if (userProfile?.profile?.isOnboarded === false) {
      setError('Please complete your account profile details before placing virtual trades.');
      return;
    }

    const canTrade = marketInfo.isOpen || allowSandbox;
    if (!canTrade) {
      setError(`Cannot execute trade: ${selectedSymbol} exchange is closed. ${marketInfo.reason}. Enable Practice Sandbox Mode below to practice trading 24/7.`);
      return;
    }

    if (quantity <= 0 || isNaN(quantity)) {
      setError('Please enter a valid quantity of at least 1.');
      return;
    }

    if (action === 'BUY' && totalCost > cashBalance) {
      setError(`Insufficient virtual cash! Required: ${currencySymbol}${totalCost.toLocaleString()}, Available: ${currencySymbol}${cashBalance.toLocaleString()}`);
      return;
    }

    if (action === 'SELL' && quantity > sharesOwned) {
      setError(`Cannot sell ${quantity} shares. You only own ${sharesOwned} shares.`);
      return;
    }

    try {
      setExecuting(true);
      const stockInfo = STOCK_DIRECTORY[selectedSymbol] || {};
      const stockName = quote?.name || stockInfo.name || selectedSymbol;

      const filledOrder = await executeOrder({
        symbol: selectedSymbol,
        name: stockName,
        market: isIndia ? 'NSE' : 'US',
        action,
        quantity,
        price: executionPrice,
        currency: isIndia ? 'INR' : 'USD',
        bypassMarketHours: allowSandbox,
      });

      if (action === 'BUY') {
        toast.success(`Virtual BUY Order Filled!`, {
          description: `Bought ${quantity} shares of ${selectedSymbol} at ${currencySymbol}${executionPrice.toFixed(2)}. Total: ${currencySymbol}${totalCost.toLocaleString()}`,
          action: revertOrder && filledOrder ? {
            label: 'Undo Trade',
            onClick: async () => {
              try {
                await revertOrder(filledOrder.id);
                toast.info(`Trade ${filledOrder.id} reverted! Virtual cash & holdings restored.`);
              } catch (revertErr) {
                toast.error(revertErr.message || 'Could not revert order.');
              }
            }
          } : undefined,
          duration: 10000,
        });
      } else {
        toast.success(`Virtual SELL Order Filled!`, {
          description: `Sold ${quantity} shares of ${selectedSymbol} at ${currencySymbol}${executionPrice.toFixed(2)}. Realized: ${isProfit ? '+' : ''}${currencySymbol}${estSellPnL.toFixed(2)} (${isProfit ? '+' : ''}${estSellPnLPct}%)`,
          action: revertOrder && filledOrder ? {
            label: 'Undo Trade',
            onClick: async () => {
              try {
                await revertOrder(filledOrder.id);
                toast.info(`Trade ${filledOrder.id} reverted! Shares restored to portfolio.`);
              } catch (revertErr) {
                toast.error(revertErr.message || 'Could not revert order.');
              }
            }
          } : undefined,
          duration: 10000,
        });
      }

      onClose();
    } catch (err) {
      console.error('Trade execution caught:', err);
      setError(err.message || 'Trade execution failed.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="newspaper-photo-plate bg-[#F6F4EE] border-4 border-[#111111] shadow-[8px_8px_0px_#111111] w-full max-w-lg max-h-[94vh] overflow-y-auto p-4 sm:p-6 relative font-mono text-xs my-auto text-[#111111]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] border border-[#111111] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          title="Close Order Ticket [Esc]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="border-b-2 border-[#111111] pb-3 mb-4 pr-10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-headline uppercase font-black text-xl sm:text-2xl text-[#111111] tracking-tight">
              EXCHANGE ORDER TICKET
            </span>
            <MarketStatusBadge market={isIndia ? 'NSE' : 'US'} size="sm" interactive={false} />
          </div>
          <p className="text-[11px] text-[#111111]/70 font-mono mt-0.5 uppercase tracking-wider">
            100% Risk-Free Virtual Trading • Real-World Price Quotation
          </p>
        </div>

        {/* Live Quote Freshness & Exchange Telemetry Strip */}
        <div className="flex items-center justify-between p-2.5 bg-white border-2 border-[#111111] mb-3 text-[10px] font-mono shadow-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.2 border font-bold uppercase ${freshness.badgeClass}`}>
              {freshness.label}
            </span>
            <span className="text-neutral-500 font-sans">
              As of: <strong className="text-neutral-900 font-mono">{freshness.asOf}</strong>
            </span>
            <span className="text-neutral-300">•</span>
            <span className="text-neutral-600 font-sans">{freshness.sourceLabel}</span>
          </div>

          <button
            type="button"
            onClick={handleRefreshQuote}
            disabled={loadingQuote}
            className="p-1 border border-neutral-300 hover:border-[#111111] hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Refresh quote from market floor"
          >
            <RefreshCw className={`w-3 h-3 text-[#111111] ${loadingQuote ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stale Quote Warning Banner */}
        {freshness.isStale && (
          <div className="mb-3 p-2.5 bg-rose-50 border-2 border-rose-600 text-rose-950 text-xs flex items-center justify-between gap-2 font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-800 shrink-0" />
              <span><strong>Stale Quote Warning:</strong> {freshness.warningMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleRefreshQuote}
              className="px-2 py-1 bg-rose-900 text-white font-bold text-[10px] uppercase hover:bg-rose-950 shrink-0 cursor-pointer"
            >
              Update Quote
            </button>
          </div>
        )}

        {/* Action Toggle (BUY vs SELL) */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAction('BUY')}
            className={`py-2.5 text-xs font-bold border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
              action === 'BUY'
                ? 'bg-[#111111] text-[#F6F4EE] border-[#111111] shadow-[2px_2px_0px_#111111]'
                : 'bg-white text-[#111111] border-[#111111] hover:bg-[#FAF8F3]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>BUY / LONG</span>
          </button>

          <button
            type="button"
            onClick={() => setAction('SELL')}
            className={`py-2.5 text-xs font-bold border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
              action === 'SELL'
                ? 'bg-red-800 text-white border-red-800 shadow-[2px_2px_0px_#111111]'
                : 'bg-white text-[#111111] border-[#111111] hover:bg-[#FAF8F3]'
            }`}
          >
            <TrendingDown className="w-4 h-4 text-red-300" />
            <span>SELL / CLOSE ({sharesOwned} OWNED)</span>
          </button>
        </div>

        {/* Active Holding Position & P&L Info Banner */}
        {sharesOwned > 0 && (
          <div className="mb-4 p-3 bg-[#FAF8F3] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold uppercase text-[#111111]">
                <span>Active Holding</span>
                <span className={`px-1.5 py-0.2 border text-[9px] font-bold uppercase inline-flex items-center gap-0.5 ${
                  currentMarketPrice >= avgBuyPrice
                    ? 'bg-emerald-50 border-emerald-700 text-emerald-800'
                    : 'bg-rose-50 border-rose-700 text-rose-800'
                }`}>
                  {currentMarketPrice >= avgBuyPrice ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  <span>{currentMarketPrice >= avgBuyPrice ? 'PROFIT' : 'LOSS'}</span>
                </span>
              </div>
              <span className="font-bold text-neutral-900">
                {sharesOwned} Shares Held
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] text-neutral-500 uppercase block font-bold">Unrealized P&L:</span>
                <div className={`font-bold text-xs ${currentMarketPrice >= avgBuyPrice ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {currentMarketPrice >= avgBuyPrice ? '+' : ''}{currencySymbol}{((currentMarketPrice - avgBuyPrice) * sharesOwned).toFixed(2)}
                  <span className="text-[10px] ml-1">
                    ({currentMarketPrice >= avgBuyPrice ? '+' : ''}{avgBuyPrice > 0 ? (((currentMarketPrice - avgBuyPrice) / avgBuyPrice) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <HoldingSparkline
                symbol={selectedSymbol}
                entryPrice={avgBuyPrice}
                currentPrice={currentMarketPrice}
                width={95}
                height={26}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200 text-[10px]">
              <div>
                <span className="text-neutral-500 uppercase block font-bold text-[9px]">Entry Price:</span>
                <strong className="text-neutral-900">{currencySymbol}{avgBuyPrice.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-neutral-500 uppercase block font-bold text-[9px]">Live CMP:</span>
                <strong className="text-neutral-900">{currencySymbol}{currentMarketPrice.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Market Hours Status Notice */}
        {!marketInfo.isOpen && (
          <div className="mb-4 p-3 bg-stone-100 border-2 border-[#111111] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-800" />
                <span className="uppercase tracking-wider">
                  {marketInfo.marketStatus?.isHoliday ? `Holiday: ${marketInfo.marketStatus.holidayName}` : 'Exchange Closed'}
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold">
                {marketInfo.marketStatus?.nextEventDesc || 'Opens Next Session'}
              </span>
            </div>

            <p className="text-[11px] text-neutral-700 font-sans leading-relaxed">
              Official hours: <strong>{marketInfo.marketStatus?.schedule || '9:15 - 15:30'}</strong>. You can enable Sandbox Mode below to execute paper trades anytime for training.
            </p>

            <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-neutral-300 select-none">
              <input
                type="checkbox"
                checked={allowSandbox}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAllowSandbox(val);
                  localStorage.setItem('paper_trading_sandbox_after_hours', val ? 'true' : 'false');
                }}
                className="w-4 h-4 rounded text-[#111111] cursor-pointer"
              />
              <span className="font-bold text-neutral-900 text-[11px] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Enable Practice Sandbox Mode (Allow 24/7 Execution)</span>
              </span>
            </label>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-800 text-red-900 text-xs flex items-center gap-2 font-bold animate-in fade-in duration-100">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-800" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleExecute} className="space-y-3.5">
          {/* Asset Selector & Search Bar */}
          <div>
            <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
              SELECT EQUITIES ASSET
            </label>

            {/* Quick Search & Auto-Suggest */}
            <div className="relative mb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  value={tickerSearch}
                  onChange={(e) => {
                    setTickerSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Instant Search Any Stock (e.g. RTNPOWER, GOLDSTAR, TATAPOWER)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-300 text-xs font-mono text-[#111111] placeholder:text-neutral-400 focus:bg-white focus:border-[#111111] outline-none"
                />
              </div>

              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] max-h-48 overflow-y-auto">
                  {searchSuggestions.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setTickerSearch('');
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 border-b border-neutral-200 hover:bg-amber-100 flex items-center justify-between font-mono text-xs cursor-pointer"
                    >
                      <div className="truncate mr-2">
                        <span className="font-bold text-[#111111] mr-1.5">{item.ticker || item.symbol}</span>
                        <span className="text-[10px] text-neutral-500 font-news truncate">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#111111] text-white shrink-0">
                        {item.market}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="block w-full px-3 py-2 bg-white border-2 border-[#111111] text-[#111111] text-xs font-mono font-bold outline-none min-h-[42px]"
            >
              <optgroup label="🇮🇳 Indian Market (NSE / BSE)">
                {Object.values(STOCK_DIRECTORY)
                  .filter((s) => s.market === 'NSE' || s.symbol.endsWith('.NS') || s.symbol.endsWith('.BO'))
                  .map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.ticker || s.symbol} — {s.name} (₹)
                    </option>
                  ))}
              </optgroup>
              <optgroup label="🇺🇸 US Market (NASDAQ / NYSE)">
                {Object.values(STOCK_DIRECTORY)
                  .filter((s) => s.market === 'US' && !s.symbol.endsWith('.NS') && !s.symbol.endsWith('.BO'))
                  .map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.ticker || s.symbol} — {s.name} ($)
                    </option>
                  ))}
              </optgroup>
              {!STOCK_DIRECTORY[selectedSymbol] && (
                <option value={selectedSymbol}>
                  {selectedSymbol} (Active Selection)
                </option>
              )}
            </select>
          </div>

          {/* Asset Live Quotation Plate */}
          <div className="p-3 bg-white border-2 border-[#111111] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                Live Market Quotation
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono font-bold text-lg text-[#111111] tabular-nums">
                  {currencySymbol}{loadingQuote ? '...' : currentMarketPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {quote && quote.changePercent !== undefined && (
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      quote.change >= 0 ? 'text-emerald-800' : 'text-red-800'
                    }`}
                  >
                    {quote.change >= 0 ? '+' : ''}{quote.changePercent}%
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                Your Holding
              </span>
              <span className="font-mono font-bold text-sm text-[#111111]">
                {sharesOwned} Shares
              </span>
              {sharesOwned > 0 && (
                <span className="text-[10px] text-neutral-400 block font-mono">
                  @ {currencySymbol}{avgBuyPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Order Type Toggle: Market vs Limit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                Execution Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full bg-white border border-[#111111] px-2 py-1.5 font-bold text-xs outline-none"
              >
                <option value="MARKET">Market (Instant Fill)</option>
                <option value="LIMIT">Limit (Target Price)</option>
              </select>
            </div>

            {orderType === 'LIMIT' ? (
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                  Limit Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(Number(e.target.value))}
                  className="w-full bg-white border border-[#111111] px-2 py-1.5 font-bold text-xs outline-none"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                  Fill Timing
                </label>
                <div className="px-2 py-1.5 bg-neutral-100 border border-neutral-300 text-neutral-600 text-[11px] font-bold">
                  Immediate Best Execution
                </div>
              </div>
            )}
          </div>

          {/* Quantity Input & Stepper */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-[#111111] uppercase tracking-wider">
                Quantity (Number of Shares)
              </label>
              <div className="flex items-center gap-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => handleAdjustQty(1)}
                  className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-900"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustQty(5)}
                  className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-900"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustQty(10)}
                  className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-900"
                >
                  +10
                </button>
              </div>
            </div>

            <input
              type="number"
              min="1"
              max={action === 'SELL' ? sharesOwned : 999999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="block w-full px-3 py-2 bg-white border-2 border-[#111111] text-[#111111] font-bold text-sm outline-none min-h-[42px]"
              required
            />
          </div>

          {/* Quick Capital / Position Allocation Buttons */}
          <div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase mb-1">
              {action === 'BUY' ? 'Quick Allocation (% Cash):' : 'Position Size (% Owned):'}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSetAllocation(25)}
                className="py-1 bg-white border border-[#111111] hover:bg-neutral-100 font-bold text-[10px] text-center transition-colors"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleSetAllocation(50)}
                className="py-1 bg-white border border-[#111111] hover:bg-neutral-100 font-bold text-[10px] text-center transition-colors"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleSetAllocation(75)}
                className="py-1 bg-white border border-[#111111] hover:bg-neutral-100 font-bold text-[10px] text-center transition-colors"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handleSetAllocation(100)}
                className="py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-white font-bold text-[10px] text-center transition-colors"
              >
                {action === 'BUY' ? 'MAX CASH' : `ALL (${sharesOwned})`}
              </button>
            </div>
          </div>

          {/* Pre-Flight Order Review Docket */}
          <div className="p-3 bg-[#FAF8F3] border-2 border-[#111111] space-y-2.5 text-xs shadow-[2px_2px_0px_#111111]">
            <div className="flex items-center justify-between border-b border-[#111111] pb-1.5">
              <span className="font-serif font-bold text-[11px] tracking-wider uppercase text-neutral-900">
                Pre-Flight Order Review
              </span>
              <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                action === 'BUY' ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-rose-100 text-rose-950 border-rose-400'
              }`}>
                {orderType} {action}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Instrument & Market</span>
                <strong className="text-neutral-900 font-bold block truncate">
                  {selectedSymbol} <span className="font-normal text-neutral-600">({isIndia ? 'NSE India' : 'US Markets'})</span>
                </strong>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Quote Timestamp & Status</span>
                <span className="font-mono text-neutral-800 text-[10px] flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    freshness.status === 'LIVE' ? 'bg-emerald-600' : freshness.status === 'DELAYED' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} />
                  {freshness.formattedTime} • <span className="font-bold">{freshness.label}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-neutral-300">
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Quantity & Fill Price</span>
                <strong className="text-neutral-900 font-mono">
                  {quantity} {quantity === 1 ? 'Share' : 'Shares'} @ {currencySymbol}{executionPrice.toFixed(2)}
                </strong>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Estimated Total</span>
                <strong className="text-neutral-900 font-mono text-sm font-bold">
                  {currencySymbol}{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {action === 'SELL' && (
              <div className="flex justify-between items-center pt-1 border-t border-neutral-300">
                <span className="text-neutral-600 text-[11px]">Estimated Realized P&L:</span>
                <span className={`font-mono font-bold text-[11px] ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isProfit ? '+' : ''}{currencySymbol}{estSellPnL.toFixed(2)} ({isProfit ? '+' : ''}{estSellPnLPct}%)
                </span>
              </div>
            )}

            <div className="pt-1.5 border-t border-neutral-300 space-y-1 text-[11px]">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Available Virtual Cash:</span>
                <span className="font-mono font-bold text-neutral-900">
                  {currencySymbol}{cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-800 font-semibold">Resulting Cash After Settlement:</span>
                <span className={`font-mono font-bold ${remainingCash < 0 ? 'text-rose-700 underline' : 'text-neutral-900'}`}>
                  {currencySymbol}{remainingCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Confirmation & Submit Button */}
          <button
            type="submit"
            disabled={executing || (!marketInfo.isOpen && !allowSandbox) || (action === 'SELL' && sharesOwned === 0) || freshness.status === 'UNAVAILABLE'}
            className={`w-full py-3 px-4 font-bold text-sm border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[46px] shadow-[2px_2px_0px_#111111] ${
              !marketInfo.isOpen && !allowSandbox
                ? 'bg-neutral-300 text-neutral-700 border-neutral-500'
                : freshness.status === 'UNAVAILABLE'
                ? 'bg-neutral-300 text-neutral-600 border-neutral-400'
                : action === 'BUY'
                ? 'bg-[#111111] hover:bg-neutral-800 text-[#F6F4EE] border-[#111111]'
                : 'bg-red-800 hover:bg-red-900 text-white border-red-800'
            }`}
          >
            {executing ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Executing Order on Local Ledger...</span>
              </span>
            ) : freshness.status === 'UNAVAILABLE' ? (
              <span>Quote Unavailable • Refresh Quote to Trade</span>
            ) : !marketInfo.isOpen && !allowSandbox ? (
              <span className="inline-flex items-center gap-1.5 justify-center text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Market Closed (Enable Sandbox Above to Trade)</span>
              </span>
            ) : action === 'BUY' ? (
              <span>Confirm BUY • {currencySymbol}{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            ) : (
              <span>Confirm SELL • {currencySymbol}{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
          </button>

          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Instant Local-First Settlement</span>
            </span>
            <span>Zero Brokerage Fees</span>
          </div>
        </form>
      </div>
    </div>
  );
}
