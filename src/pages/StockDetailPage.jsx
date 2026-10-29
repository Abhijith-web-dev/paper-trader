import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTradingTools } from '../context/TradingToolsContext';
import { STOCK_DIRECTORY, getStockQuote, getOrderBook, fetchSingleYahooQuote } from '../lib/yahooFinance';
import { subscribeToMarketStream, registerLiveSymbols } from '../lib/omniFeed';
import { browserMarketServer } from '../lib/browserMarketServer';
import { getQuoteFreshness } from '../lib/quoteFreshness';
import { isMarketOpenForSymbol } from '../lib/marketHours';
import MarketStatusBadge from '../components/MarketStatusBadge';
import StockChart from '../components/StockChart';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import HoldingSparkline from '../components/HoldingSparkline';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft, 
  Wallet, 
  Layers, 
  Activity, 
  Share2, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Clock, 
  Sparkles,
  Zap,
  Lock,
  Calculator,
  BarChart2,
  BookOpen,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';

export default function StockDetailPage() {
  const { symbol: rawSymbol } = useParams();
  const navigate = useNavigate();
  const { userProfile, executeOrder } = useAuth();
  const { 
    openRiskCalculator, 
    openBacktester, 
    openJournal, 
    openAlerts,
    setContextStock,
    activeIndicators,
    toggleIndicator
  } = useTradingTools();

  const symbol = decodeURIComponent(rawSymbol || 'AAPL').toUpperCase();
  const stockInfo = useMemo(() => {
    return STOCK_DIRECTORY[symbol] || {
      symbol,
      ticker: symbol.replace(/\.(NS|BO)$/, ''),
      name: symbol,
      market: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'NSE' : 'US',
      currency: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD',
      sector: 'Equities',
      basePrice: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 50 : 150,
      marketCap: 'N/A',
      peRatio: 'N/A',
      high52: 180,
      low52: 120,
      volume: '2.5M',
    };
  }, [symbol]);

  const isIndia = stockInfo.market === 'NSE' || stockInfo.currency === 'INR' || symbol.endsWith('.NS') || symbol.endsWith('.BO');
  const currencySymbol = isIndia ? '₹' : '$';
  const walletKey = isIndia ? 'inr' : 'usd';

  // Live price quote state
  const [quote, setQuote] = useState(null);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });

  // Trade form state
  const [action, setAction] = useState('BUY'); // 'BUY' | 'SELL'
  const [quantity, setQuantity] = useState(1);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  // Cash & Holdings
  const cashBalance = userProfile?.wallets?.[walletKey]?.cashBalance ?? (isIndia ? 1000000 : 100000);
  const holdingKey = symbol.replace(/[^a-zA-Z0-9]/g, '_');
  const existingHolding = userProfile?.holdings?.[holdingKey];
  const sharesOwned = existingHolding?.quantity || 0;

  // Real-world exchange market hours status
  const [marketInfo, setMarketInfo] = useState(() => isMarketOpenForSymbol(symbol));
  const [allowSandbox, setAllowSandbox] = useState(() => {
    try {
      return localStorage.getItem('paper_trading_sandbox_after_hours') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setMarketInfo(isMarketOpenForSymbol(symbol));
    if (symbol) {
      registerLiveSymbols(symbol);
    }
  }, [symbol, allowSandbox]);

  // 1. High-Precision In-Browser Market Server Engine (0ms initial render + 1s micro-ticks)
  const refreshIntervalSec = 1;
  const [lastTickTime, setLastTickTime] = useState(Date.now());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(refreshIntervalSec);

  useEffect(() => {
    let isMounted = true;

    // Connect to the autonomous In-Browser Market Node
    const unsubscribe = browserMarketServer.subscribe(symbol, (live) => {
      if (!isMounted || !live) return;
      setQuote(live);
      setOrderBook(browserMarketServer.getOrderBook(symbol, live.price));
      setLastTickTime(Date.now());
      setSecondsUntilRefresh(refreshIntervalSec);
    });

    // 1-second countdown display ticker
    const countdownInterval = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? refreshIntervalSec : prev - 1));
    }, 1000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(countdownInterval);
    };
  }, [symbol, currencySymbol]);

  // Synchronize normalized quote from the chart canvas
  const handleQuoteSyncFromChart = useCallback((syncedQuote) => {
    if (!syncedQuote || !syncedQuote.price) return;
    setQuote((prev) => {
      if (
        prev?.price === syncedQuote.price &&
        prev?.high === syncedQuote.high &&
        prev?.low === syncedQuote.low
      ) {
        return prev;
      }
      return {
        ...prev,
        ...syncedQuote,
        name: prev?.name || stockInfo.name,
        market: prev?.market || stockInfo.market,
      };
    });
    browserMarketServer.updateQuote(symbol, syncedQuote);
  }, [symbol, stockInfo]);

  const currentPrice = quote?.price || stockInfo.basePrice || 150;
  const totalCost = Number((quantity * currentPrice).toFixed(2));

  // Quick percentage allocation
  const handleQuickPercent = (pct) => {
    if (action === 'BUY') {
      const budget = cashBalance * (pct / 100);
      const calculatedQty = Math.max(1, Math.floor(budget / currentPrice));
      setQuantity(calculatedQty);
    } else {
      const calculatedQty = Math.max(1, Math.floor(sharesOwned * (pct / 100)));
      setQuantity(calculatedQty);
    }
  };

  // Trade order execution
  const handleExecuteTrade = async (e) => {
    e.preventDefault();
    setError('');

    if (!marketInfo.isOpen) {
      setError(`Cannot execute trade: ${symbol} market is closed. ${marketInfo.reason}. Real-world exchange hours are enforced.`);
      return;
    }

    if (quantity <= 0) {
      setError('Please enter a valid share quantity of 1 or more.');
      return;
    }

    if (action === 'BUY' && totalCost > cashBalance) {
      setError(`Insufficient cash! Required: ${currencySymbol}${totalCost.toLocaleString()}, Available: ${currencySymbol}${cashBalance.toLocaleString()}`);
      return;
    }

    if (action === 'SELL' && quantity > sharesOwned) {
      setError(`Cannot sell ${quantity} shares. You currently own ${sharesOwned} shares.`);
      return;
    }

    try {
      setExecuting(true);
      await executeOrder({
        symbol,
        name: quote?.name || stockInfo.name,
        market: stockInfo.market,
        action,
        quantity,
        price: currentPrice,
        currency: stockInfo.currency,
      });

      toast.success(
        action === 'BUY' ? 'Virtual Buy Order Filled!' : 'Virtual Sell Order Filled!',
        {
          description: `${action} ${quantity}x ${symbol} @ ${currencySymbol}${currentPrice.toLocaleString()}`,
        }
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Trade execution failed.');
    } finally {
      setExecuting(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Stock Link Copied to Clipboard!');
  };

  // Day range bounds strictly harmonized with current price
  const rawLow = quote?.low != null ? Number(quote.low) : currentPrice * 0.985;
  const rawHigh = quote?.high != null ? Number(quote.high) : currentPrice * 1.015;
  const dayLow = Math.min(rawLow, currentPrice);
  const dayHigh = Math.max(rawHigh, currentPrice);
  const dayRangeProgress = Math.min(100, Math.max(0, ((currentPrice - dayLow) / (dayHigh - dayLow || 1)) * 100));

  // Quote freshness telemetry
  const quoteFreshness = useMemo(() => {
    return getQuoteFreshness(quote || { price: currentPrice, timestamp: Date.now() });
  }, [quote, currentPrice]);

  return (
    <div className="max-w-7xl mx-auto px-2.5 py-4 sm:px-6 lg:px-8 font-mono text-xs text-[#111111]">
      {/* Top Breadcrumb & Share Header */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-4 sm:mb-6 border-b-2 border-[#111111]">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[#111111] hover:underline font-bold transition-colors min-h-[44px] text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">← Return to Trader's Desk & Portfolio</span>
          <span className="sm:hidden font-headline">← Dashboard</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#111111] text-[#111111] text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            <span>Live Real-Time Feed • 2s Fast Ticks ({secondsUntilRefresh}s)</span>
          </div>

          <button
            onClick={copyShareLink}
            className="px-2.5 sm:px-3 py-1.5 bg-white border-2 border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] font-bold flex items-center gap-1 transition-colors cursor-pointer min-h-[36px] text-xs"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Share Quotation</span>
            <span className="sm:hidden">Share</span>
          </button>
        </div>
      </div>

      {/* Stock Broadsheet Masthead Banner */}
      <div className="newspaper-photo-plate p-3 sm:p-6 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        <div className="min-w-0 w-full md:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="font-headline uppercase font-black text-2xl sm:text-4xl lg:text-5xl text-[#111111] tracking-tight leading-none break-all sm:break-normal">
              {symbol}
            </h1>
            <span className="px-1.5 sm:px-2 py-0.5 bg-[#111111] text-[#F6F4EE] text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              {stockInfo.market}
            </span>
            <span className="text-[#111111]/70 font-news text-xs sm:text-base font-medium truncate max-w-[180px] sm:max-w-none">
              {quote?.name || stockInfo.name}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3 text-[#111111]/80 font-mono text-[10px] sm:text-xs">
            <span>SECTOR: <strong>{stockInfo.sector}</strong></span>
            <span className="hidden sm:inline">•</span>
            <span>CURRENCY: <strong>{stockInfo.currency} ({currencySymbol})</strong></span>
          </div>
        </div>

        {/* Live Price Display */}
        <div className="text-left md:text-right pt-2 md:pt-0 border-t md:border-t-0 border-[#111111]/20 w-full md:w-auto flex flex-col md:items-end justify-between">
          <div className="font-mono font-black text-2xl sm:text-4xl text-[#111111] tabular-nums">
            {currencySymbol}{currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {quote && (
            <div className={`text-xs sm:text-sm font-bold flex items-center md:justify-end gap-1 mt-0.5 tabular-nums ${
              quote.change >= 0 ? 'text-emerald-800' : 'text-red-800'
            }`}>
              {quote.change >= 0 ? <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span>{quote.change >= 0 ? '+' : ''}{Number(quote.change).toFixed(2)} ({Number(quote.changePercent).toFixed(2)}%)</span>
              <span className="text-[9px] sm:text-[10px] text-stone-500 font-normal ml-0.5 sm:ml-1">TODAY</span>
            </div>
          )}
          {/* Quote Freshness & Exchange Timestamp */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-500 mt-1 md:justify-end">
            <span className={`w-1.5 h-1.5 rounded-full ${quoteFreshness.isStale ? 'bg-amber-500' : 'bg-emerald-600 animate-pulse'}`} />
            <span>AS OF {quoteFreshness.asOf}</span>
            <span className="text-stone-300">•</span>
            <span className="font-semibold text-stone-700 uppercase">{quoteFreshness.label}</span>
          </div>
        </div>
      </div>

      {/* Quick Trading Tools Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5 p-2.5 bg-white border-2 border-[#111111] text-xs font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase text-neutral-500">Self-Hosted Tools:</span>
          <button
            onClick={() => openRiskCalculator({ symbol, price: currentPrice, market: isIndia ? 'IN' : 'US' })}
            className="px-2.5 py-1 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-700" />
            <span>Position & Risk Sizer</span>
          </button>
          <button
            onClick={() => openBacktester({ symbol, price: currentPrice, market: isIndia ? 'IN' : 'US' })}
            className="px-2.5 py-1 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-700" />
            <span>Backtest Strategy (Worker)</span>
          </button>
          <button
            onClick={() => openJournal()}
            className="px-2.5 py-1 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>Trade Journal</span>
          </button>
          <button
            onClick={() => openAlerts()}
            className="px-2.5 py-1 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-purple-700" />
            <span>Set Local Alert</span>
          </button>
        </div>
        <div className="text-[10px] text-neutral-500 font-sans hidden md:block">
          Press <kbd className="px-1 border border-neutral-400 bg-neutral-100 font-bold font-mono">/</kbd> for Command Terminal
        </div>
      </div>

      {/* Main Grid: TradingView Interactive Chart & Fundamentals (Left) + Trade Terminal & Order Book (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Interactive Candlestick Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Candlestick Chart Container with Isolated Safeguard */}
          <div className="newspaper-photo-plate p-1 bg-white overflow-hidden">
            <WidgetErrorBoundary title="Interactive Candlestick Chart">
              <StockChart 
                symbol={symbol} 
                currencySymbol={currencySymbol} 
                livePrice={quote?.price}
                onQuoteSync={handleQuoteSyncFromChart}
                activeIndicators={activeIndicators} 
                onToggleIndicator={toggleIndicator} 
              />
            </WidgetErrorBoundary>
          </div>

          {/* Fundamentals & Technical Metrics Card */}
          <div className="newspaper-photo-plate p-3 sm:p-5 space-y-3 sm:space-y-4">
            <h2 className="font-headline uppercase font-black text-base sm:text-lg text-[#111111] pb-2 border-b-2 border-[#111111] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#111111] shrink-0" />
                <span>Asset Valuation & Technical Quotation</span>
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-normal text-stone-500 hidden sm:inline">OFFICIAL METRICS</span>
            </h2>

            {/* Day Price Range Slider */}
            <div>
              <div className="flex justify-between text-[#111111]/70 text-[11px] mb-1">
                <span>Day Low: <strong>{currencySymbol}{Number(dayLow || 0).toFixed(2)}</strong></span>
                <span className="font-bold text-[#111111]">Current: {currencySymbol}{Number(currentPrice || 0).toFixed(2)}</span>
                <span>Day High: <strong>{currencySymbol}{Number(dayHigh || 0).toFixed(2)}</strong></span>
              </div>
              <div className="w-full bg-[#EFECE3] border border-[#111111] h-2.5 overflow-hidden relative">
                <div
                  className="bg-[#111111] h-full transition-all duration-300"
                  style={{ width: `${dayRangeProgress}%` }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#D8D2C4]">
              <div className="p-3 bg-[#FAF8F3] border border-[#111111]">
                <span className="text-[#111111]/60 text-[9px] uppercase font-bold block">Market Cap</span>
                <span className="font-bold text-[#111111] text-sm mt-0.5 block">{stockInfo.marketCap}</span>
              </div>
              <div className="p-3 bg-[#FAF8F3] border border-[#111111]">
                <span className="text-[#111111]/60 text-[9px] uppercase font-bold block">P/E Ratio</span>
                <span className="font-bold text-[#111111] text-sm mt-0.5 block">{stockInfo.peRatio}</span>
              </div>
              <div className="p-3 bg-[#FAF8F3] border border-[#111111]">
                <span className="text-[#111111]/60 text-[9px] uppercase font-bold block">52-Wk High</span>
                <span className="font-bold text-emerald-800 text-sm mt-0.5 block">{currencySymbol}{stockInfo.high52}</span>
              </div>
              <div className="p-3 bg-[#FAF8F3] border border-[#111111]">
                <span className="text-[#111111]/60 text-[9px] uppercase font-bold block">52-Wk Low</span>
                <span className="font-bold text-red-800 text-sm mt-0.5 block">{currencySymbol}{stockInfo.low52}</span>
              </div>
            </div>

            {/* Trading Volume & Exchange Note */}
            <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] text-[#111111]/70 border-t border-dashed border-[#D8D2C4]">
              <span>Avg Daily Volume: <strong className="text-[#111111] font-bold">{stockInfo.volume}</strong></span>
              <span>Primary Exchange: <strong className="text-[#111111] font-bold">{stockInfo.market}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Instant Order Terminal + Level 2 Depth */}
        <div className="space-y-6">
          {/* Interactive Paper Order Terminal Card */}
          <div className="newspaper-photo-plate p-3 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111] flex-wrap gap-2">
              <h2 className="font-headline uppercase font-black text-lg sm:text-xl text-[#111111]">
                ORDER EXECUTION DESK
              </h2>
              <MarketStatusBadge market={isIndia ? 'NSE' : 'US'} size="sm" />
            </div>

            {/* Active Position Card */}
            {sharesOwned > 0 && (
              <div className="mt-4 p-3 bg-[#FAF8F3] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[#111111]">
                    <span>Your Active Position</span>
                    <span className={`px-1.5 py-0.2 border text-[9px] font-bold uppercase inline-flex items-center gap-0.5 ${
                      currentPrice >= (existingHolding?.avgBuyPrice || 0)
                        ? 'bg-emerald-50 border-emerald-700 text-emerald-800'
                        : 'bg-rose-50 border-rose-700 text-rose-800'
                    }`}>
                      {currentPrice >= (existingHolding?.avgBuyPrice || 0) ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      <span>{currentPrice >= (existingHolding?.avgBuyPrice || 0) ? 'PROFIT' : 'LOSS'}</span>
                    </span>
                  </div>
                  <span className="font-bold text-neutral-900">{sharesOwned} Shares Held</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block font-bold">Unrealized P&L:</span>
                    <div className={`font-bold text-xs ${currentPrice >= (existingHolding?.avgBuyPrice || 0) ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {currentPrice >= (existingHolding?.avgBuyPrice || 0) ? '+' : ''}{currencySymbol}{((currentPrice - (existingHolding?.avgBuyPrice || 0)) * sharesOwned).toFixed(2)}
                      <span className="text-[10px] ml-1">
                        ({currentPrice >= (existingHolding?.avgBuyPrice || 0) ? '+' : ''}{existingHolding?.avgBuyPrice ? (((currentPrice - existingHolding.avgBuyPrice) / existingHolding.avgBuyPrice) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                  <HoldingSparkline
                    symbol={symbol}
                    entryPrice={existingHolding?.avgBuyPrice || currentPrice}
                    currentPrice={currentPrice}
                    width={105}
                    height={28}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200 text-[10px]">
                  <div>
                    <span className="text-neutral-500 uppercase block font-bold text-[9px]">Entry Price:</span>
                    <strong className="text-neutral-900">{currencySymbol}{(existingHolding?.avgBuyPrice || 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 uppercase block font-bold text-[9px]">Live CMP:</span>
                    <strong className="text-neutral-900">{currencySymbol}{currentPrice.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Market Closed or Holiday Notice Box */}
            {!marketInfo.isOpen && (
              <div className="mt-4 p-3.5 newspaper-black-box text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1">
                  {marketInfo.marketStatus?.isHoliday ? (
                    <>
                      <span className="text-base">🏛️</span>
                      <span className="uppercase tracking-wider">
                        GOVERNMENT HOLIDAY: {(marketInfo.marketStatus?.holidayName || 'Official Holiday').toUpperCase()}
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 shrink-0" />
                      <span className="uppercase tracking-wider">EXCHANGE IS CLOSED</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed font-news">
                  {marketInfo.marketStatus?.isHoliday ? (
                    <>
                      {stockInfo.market} is officially closed today in observance of <strong>{marketInfo.marketStatus?.holidayName || 'Official Holiday'}</strong>. 
                      Standard trading runs {marketInfo.marketStatus?.openTimeStr || '09:30 AM'} – {marketInfo.marketStatus?.closeTimeStr || '04:00 PM'}. {marketInfo.marketStatus?.nextEventDesc || ''}.
                    </>
                  ) : (
                    <>
                      {stockInfo.market} operates <strong className="text-white font-mono">{marketInfo.marketStatus?.schedule || 'Standard Exchange Hours'}</strong>.
                      Orders cannot be placed when market is closed ({marketInfo.marketStatus?.nextEventDesc || 'Opens next regular session'}).
                    </>
                  )}
                </p>
                <div className="mt-2.5 pt-2 border-t border-white/20">
                  <label className="flex items-center gap-2 cursor-pointer text-white select-none text-[11px] hover:text-amber-300">
                    <input
                      type="checkbox"
                      aria-label="Sandbox Mode (Bypass holiday/closed market lock)"
                      checked={allowSandbox}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAllowSandbox(val);
                        localStorage.setItem('paper_trading_sandbox_after_hours', val ? 'true' : 'false');
                      }}
                      className="w-3.5 h-3.5 rounded text-black cursor-pointer"
                    />
                    <span className="font-bold">Sandbox Mode (Bypass holiday/closed market lock)</span>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-100 border-2 border-red-800 text-red-900 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-800" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTrade} className="mt-4 space-y-4">
              {/* Action Tabs: BUY vs SELL */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAction('BUY')}
                  className={`py-2.5 text-xs font-bold border-2 transition-all cursor-pointer min-h-[44px] ${
                    action === 'BUY'
                      ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                      : 'bg-white text-[#111111] border-[#111111] hover:bg-[#FAF8F3]'
                  }`}
                >
                  BUY (LONG)
                </button>
                <button
                  type="button"
                  onClick={() => setAction('SELL')}
                  disabled={sharesOwned === 0}
                  className={`py-2.5 text-xs font-bold border-2 transition-all cursor-pointer min-h-[44px] ${
                    sharesOwned === 0
                      ? 'opacity-40 cursor-not-allowed bg-stone-100 border-[#D8D2C4] text-stone-400'
                      : action === 'SELL'
                      ? 'bg-red-800 text-white border-red-800'
                      : 'bg-white text-[#111111] border-[#111111] hover:bg-[#FAF8F3]'
                  }`}
                >
                  SELL ({sharesOwned})
                </button>
              </div>

              {/* Quantity Input */}
              <div>
                <div className="flex justify-between items-center text-[11px] text-[#111111]/70 mb-1">
                  <label htmlFor="order-shares-qty" className="font-bold uppercase cursor-pointer">Shares Quantity:</label>
                  <span>Owned: <strong className="text-[#111111] font-bold">{sharesOwned}</strong> shares</span>
                </div>
                <input
                  id="order-shares-qty"
                  type="number"
                  aria-label="Shares Quantity"
                  min="1"
                  max={action === 'SELL' ? sharesOwned : 999999}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-white border-2 border-[#111111] focus:bg-[#FAF8F3] text-[#111111] font-bold text-base outline-none min-h-[44px]"
                />
              </div>

              {/* Quick Cash Allocation Chips */}
              <div>
                <span className="text-[10px] text-[#111111]/60 uppercase tracking-wider block mb-1 font-bold">
                  Quick Capital Allocation:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickPercent(pct)}
                      className="py-1.5 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[10px] text-[#111111] font-bold transition-colors cursor-pointer min-h-[36px]"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Cost & Available Virtual Balance Box */}
              <div className="p-3.5 bg-[#FAF8F3] border border-[#111111] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#111111]/70">
                  <span>Execution Price:</span>
                  <span className="font-bold text-[#111111]">{currencySymbol}{Number(currentPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[#111111]/70">
                  <span>Total Order Amount:</span>
                  <span className="font-bold text-[#111111] text-sm">{currencySymbol}{Number(totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-[#D8D2C4] flex justify-between text-[#111111]/70">
                  <span>Available Balance:</span>
                  <span className="font-bold text-emerald-800">{currencySymbol}{Number(cashBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Submit Execution Button */}
              <button
                type="submit"
                disabled={executing || !marketInfo.isOpen || (action === 'SELL' && sharesOwned === 0)}
                className={`w-full py-3 font-bold text-sm border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] ${
                  !marketInfo.isOpen
                    ? 'bg-stone-300 text-stone-700 border-stone-500'
                    : action === 'BUY'
                      ? 'bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] border-[#111111]'
                      : 'bg-red-800 hover:bg-red-900 text-white border-red-800'
                }`}
              >
                {executing ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Executing Virtual Trade...
                  </span>
                ) : !marketInfo.isOpen ? (
                  <span className="inline-flex items-center justify-center gap-1.5 text-xs">
                    {marketInfo.marketStatus?.isHoliday ? (
                      <span>🏛️ Closed Today: {marketInfo.marketStatus?.holidayName || 'Official Holiday'}</span>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[#111111]" />
                        <span>Market Closed ({marketInfo.marketStatus?.nextEventDesc || 'Opens Next Session'})</span>
                      </>
                    )}
                  </span>
                ) : (
                  `Confirm ${action} (${currencySymbol}${Number(totalCost || 0).toLocaleString()})`
                )}
              </button>

              <p className="text-[10px] text-center font-mono text-[#111111]/60 mt-2">
                💾 0ms Local-First: Immediate balance & shares update.
              </p>
            </form>
          </div>

          {/* Level 2 Market Depth / Order Book */}
          <div className="newspaper-photo-plate p-5">
            <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-[#111111]">
              <span className="font-headline uppercase font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#111111]" />
                Level 2 Order Book Depth
              </span>
              <span className="text-[10px] text-stone-500">SPREAD: 0.02%</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[11px]">
              {/* Bids */}
              <div>
                <div className="font-bold text-emerald-900 border-b border-[#111111] pb-1 mb-1.5 flex justify-between text-[10px]">
                  <span>BID (BUY)</span>
                  <span>QTY</span>
                </div>
                {orderBook.bids.map((b, idx) => (
                  <div key={idx} className="flex justify-between text-[#111111] py-0.5 tabular-nums">
                    <span className="text-emerald-800 font-bold">{b.price.toFixed(2)}</span>
                    <span className="text-stone-500">{b.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Asks */}
              <div>
                <div className="font-bold text-red-900 border-b border-[#111111] pb-1 mb-1.5 flex justify-between text-[10px]">
                  <span>ASK (SELL)</span>
                  <span>QTY</span>
                </div>
                {orderBook.asks.map((a, idx) => (
                  <div key={idx} className="flex justify-between text-[#111111] py-0.5 tabular-nums">
                    <span className="text-red-800 font-bold">{a.price.toFixed(2)}</span>
                    <span className="text-stone-500">{a.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
