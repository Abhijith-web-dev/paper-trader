import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STOCK_DIRECTORY, getStockQuote, getOrderBook, fetchSingleYahooQuote } from '../lib/yahooFinance';
import { registerLiveSymbols } from '../lib/omniFeed';
import { browserMarketServer } from '../lib/browserMarketServer';
import { isMarketOpenForSymbol } from '../lib/marketHours';
import MarketStatusBadge from './MarketStatusBadge';
import StockChart from './StockChart';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import HoldingSparkline from './HoldingSparkline';
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Activity, 
  DollarSign, 
  Wallet, 
  BarChart2, 
  AlertCircle, 
  CheckCircle2,
  X,
  ExternalLink,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';

export default function StockDetailsPanel({ symbol, onClose }) {
  const { userProfile, executeOrder } = useAuth();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('BUY'); // 'BUY' | 'SELL'
  const [quantity, setQuantity] = useState(1);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
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

  const stockInfo = useMemo(() => {
    return STOCK_DIRECTORY[symbol] || {
      name: symbol,
      ticker: symbol.replace(/\.(NS|BO)$/, ''),
      market: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'NSE' : 'US',
      currency: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD',
      sector: 'Equities',
      marketCap: 'N/A',
      peRatio: 'N/A',
      high52: 100,
      low52: 50,
    };
  }, [symbol]);

  const isIndia = stockInfo.market === 'NSE' || stockInfo.currency === 'INR' || symbol.endsWith('.NS') || symbol.endsWith('.BO');
  const currencySymbol = isIndia ? '₹' : '$';
  const walletKey = isIndia ? 'inr' : 'usd';
  const cashBalance = userProfile?.wallets?.[walletKey]?.cashBalance ?? (isIndia ? 1000000 : 100000);

  // Shares currently held by user
  const holdingKey = symbol.replace(/[^a-zA-Z0-9]/g, '_');
  const existingHolding = userProfile?.holdings?.[holdingKey];
  const sharesOwned = existingHolding?.quantity || 0;

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const unsubscribe = browserMarketServer.subscribe(symbol, (live) => {
      if (!mounted || !live) return;
      setQuote(live);
      setOrderBook(browserMarketServer.getOrderBook(symbol, live.price));
      setLoading(false);
    });

    return () => { 
      mounted = false; 
      unsubscribe();
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

  const currentPrice = quote?.price || stockInfo.basePrice || 100;
  const totalCost = Number((quantity * currentPrice).toFixed(2));

  // Holding position metrics
  const holdingEntryPrice = existingHolding?.avgBuyPrice || 0;
  const positionCost = sharesOwned * holdingEntryPrice;
  const positionValue = sharesOwned * currentPrice;
  const positionPnl = positionValue - positionCost;
  const positionPnlPct = positionCost > 0 ? (positionPnl / positionCost) * 100 : 0;
  const isPositionProfit = positionPnl >= 0;

  // Quick allocation buttons (25%, 50%, 100% of cash or owned shares)
  const setPercentAlloc = (percent) => {
    if (action === 'BUY') {
      const budget = cashBalance * (percent / 100);
      const calculatedQty = Math.max(1, Math.floor(budget / currentPrice));
      setQuantity(calculatedQty);
    } else {
      const calculatedQty = Math.max(1, Math.floor(sharesOwned * (percent / 100)));
      setQuantity(calculatedQty);
    }
  };

  const handleTrade = async (e) => {
    e.preventDefault();
    setError('');

    if (!marketInfo.isOpen) {
      setError(`Cannot execute trade: ${symbol} exchange is closed. ${marketInfo.reason}. Real-world exchange hours are enforced.`);
      return;
    }

    if (quantity <= 0) {
      setError('Please enter a valid quantity of at least 1 share.');
      return;
    }

    if (action === 'BUY' && totalCost > cashBalance) {
      setError(`Insufficient cash! Required: ${currencySymbol}${totalCost.toLocaleString()}, Available: ${currencySymbol}${cashBalance.toLocaleString()}`);
      return;
    }

    if (action === 'SELL' && quantity > sharesOwned) {
      setError(`Cannot sell ${quantity} shares. You only own ${sharesOwned} shares.`);
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
        action === 'BUY' ? 'Virtual Buy Executed!' : 'Virtual Sell Executed!',
        {
          description: `${action} ${quantity}x ${symbol} @ ${currencySymbol}${currentPrice}`,
        }
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Execution error.');
    } finally {
      setExecuting(false);
    }
  };

  // Day Range calculation strictly harmonized with current price
  const rawLow = quote?.low != null ? Number(quote.low) : currentPrice * 0.99;
  const rawHigh = quote?.high != null ? Number(quote.high) : currentPrice * 1.01;
  const dayLow = Math.min(rawLow, currentPrice);
  const dayHigh = Math.max(rawHigh, currentPrice);
  const dayRangeProgress = Math.min(100, Math.max(0, ((currentPrice - dayLow) / (dayHigh - dayLow || 1)) * 100));

  return (
    <div className="newspaper-photo-plate p-5 sm:p-6 mb-8 font-mono text-xs relative">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-4 border-b-2 border-[#111111] gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-headline uppercase font-black text-3xl text-[#111111] tracking-tight leading-none">
              {symbol}
            </h2>
            <span className="px-2 py-0.5 bg-[#111111] text-[#F6F4EE] text-[10px] font-bold uppercase">
              {stockInfo.market}
            </span>
            <span className="text-[#111111]/70 font-news text-sm">
              {quote?.name || stockInfo.name}
            </span>
          </div>
          <div className="text-[11px] text-[#111111]/70 font-mono mt-1">
            SECTOR: <strong className="text-[#111111]">{stockInfo.sector}</strong>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-bold text-2xl text-[#111111] tabular-nums">
              {currencySymbol}{currentPrice.toLocaleString()}
            </div>
            {quote && (
              <div className={`text-xs font-bold flex items-center justify-end gap-1 tabular-nums ${
                quote.change >= 0 ? 'text-emerald-800' : 'text-red-800'
              }`}>
                {quote.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{quote.change >= 0 ? '+' : ''}{quote.change} ({quote.changePercent}%)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/stock/${encodeURIComponent(symbol)}`}
              title="Open Full Stock Trading Page & URL"
              className="px-3 py-1.5 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] text-[11px] font-mono font-bold flex items-center gap-1 transition-all min-h-[36px]"
            >
              <span>Full Graph</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Side Chart & Stats | Right Side Fast Execution & Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Interactive Candlestick Chart & Fundamental Metrics */}
        <div className="lg:col-span-2 space-y-4">
          {/* Lightweight Chart with Isolated Safeguard */}
          <div className="border border-[#111111] p-1 bg-white overflow-hidden">
            <WidgetErrorBoundary title="Interactive Candlestick Chart">
              <StockChart 
                symbol={symbol} 
                currencySymbol={currencySymbol} 
                livePrice={quote?.price} 
                onQuoteSync={handleQuoteSyncFromChart}
              />
            </WidgetErrorBoundary>
          </div>

          {/* Fundamentals & Day Range Card */}
          <div className="p-4 bg-[#FAF8F3] border border-[#111111] space-y-3">
            {/* Day Price Range Slider Bar */}
            <div>
              <div className="flex justify-between text-[11px] text-[#111111]/70 mb-1">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#D8D2C4] text-[11px]">
              <div>
                <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">Market Cap:</span>
                <span className="font-bold text-[#111111]">{stockInfo.marketCap}</span>
              </div>
              <div>
                <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">P/E Ratio:</span>
                <span className="font-bold text-[#111111]">{stockInfo.peRatio}</span>
              </div>
              <div>
                <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">52-Wk High:</span>
                <span className="font-bold text-emerald-800">{currencySymbol}{stockInfo.high52}</span>
              </div>
              <div>
                <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">52-Wk Low:</span>
                <span className="font-bold text-red-800">{currencySymbol}{stockInfo.low52}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Fast Trade Execution + Order Book */}
        <div className="space-y-4">
          {/* Active Holding Position Card if user holds this asset */}
          {sharesOwned > 0 && (
            <div className="p-3.5 bg-[#FAF8F3] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
                <div className="flex items-center gap-1.5 font-bold uppercase text-[#111111]">
                  <span>Your Active Position</span>
                  <span className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase inline-flex items-center gap-0.5 ${
                    isPositionProfit
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-800'
                      : 'bg-rose-50 border-rose-700 text-rose-800'
                  }`}>
                    {isPositionProfit ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    <span>{isPositionProfit ? 'PROFIT' : 'LOSS'}</span>
                  </span>
                </div>
                <span className="font-bold text-[#111111] text-xs">
                  {sharesOwned} Shares
                </span>
              </div>

              {/* Sparkline & P&L Spread */}
              <div className="flex items-center justify-between p-2 bg-white border border-neutral-300">
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase font-bold block">Trajectory:</span>
                  <div className={`text-[11px] font-bold flex items-center gap-1 ${isPositionProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                    <span>{isPositionProfit ? '+' : ''}{currencySymbol}{positionPnl.toFixed(2)}</span>
                    <span className="text-[10px]">({isPositionProfit ? '+' : ''}{positionPnlPct.toFixed(1)}%)</span>
                  </div>
                </div>
                <HoldingSparkline
                  symbol={symbol}
                  entryPrice={holdingEntryPrice}
                  currentPrice={currentPrice}
                  width={110}
                  height={28}
                />
              </div>

              {/* Entry Price vs Current Price Grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-1.5 bg-white border border-neutral-200">
                  <span className="text-neutral-500 uppercase block font-bold text-[9px]">Entry Price:</span>
                  <strong className="text-neutral-900 text-xs">{currencySymbol}{holdingEntryPrice.toFixed(2)}</strong>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">Cost: {currencySymbol}{positionCost.toFixed(2)}</span>
                </div>
                <div className="p-1.5 bg-white border border-neutral-200">
                  <span className="text-neutral-500 uppercase block font-bold text-[9px]">Live Price:</span>
                  <strong className="text-neutral-900 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{currencySymbol}{currentPrice.toFixed(2)}</span>
                  </strong>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">Value: {currencySymbol}{positionValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Trade Box */}
          <div className="p-4 bg-white border-2 border-[#111111]">
            <h3 className="font-headline uppercase font-bold text-base text-[#111111] pb-2 border-b border-[#111111]">
              QUICK ORDER TERMINAL
            </h3>

            {error && (
              <div className="mt-2 p-2 bg-red-100 border border-red-800 text-red-900 text-[11px] flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-800" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleTrade} className="mt-3 space-y-3" data-no-popunder="true">
              {/* Buy / Sell Tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAction('BUY')}
                  className={`py-2 font-bold border-2 transition-all cursor-pointer min-h-[44px] ${
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
                  className={`py-2 font-bold border-2 transition-all cursor-pointer min-h-[44px] ${
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

              {/* Quantity */}
              <div>
                <div className="flex justify-between items-center text-[11px] text-[#111111]/70 mb-1">
                  <span className="font-bold uppercase">Quantity:</span>
                  <span>Owned: <strong className="text-[#111111]">{sharesOwned}</strong></span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={action === 'SELL' ? sharesOwned : 999999}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-white border-2 border-[#111111] focus:bg-[#FAF8F3] font-bold text-sm outline-none min-h-[44px]"
                />
              </div>

              {/* Quick Percentage Chips */}
              <div className="flex items-center gap-1.5">
                {[10, 25, 50, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentAlloc(pct)}
                    className="flex-1 py-1.5 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[10px] text-[#111111] font-bold transition-colors cursor-pointer min-h-[36px]"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>

              {/* Summary Pill */}
              <div className="p-3 bg-[#FAF8F3] border border-[#111111] space-y-1 text-[11px]">
                <div className="flex justify-between text-[#111111]/70">
                  <span>Order Value:</span>
                  <span className="font-bold text-[#111111]">{currencySymbol}{totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#111111]/70">
                  <span>Available Cash:</span>
                  <span className="font-bold text-emerald-800">{currencySymbol}{cashBalance.toLocaleString()}</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={executing || !marketInfo.isOpen || (action === 'SELL' && sharesOwned === 0)}
                className={`w-full py-2.5 font-bold text-xs border-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] ${
                  !marketInfo.isOpen
                    ? 'bg-stone-300 text-stone-700 border-stone-500'
                    : action === 'BUY'
                      ? 'bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] border-[#111111]'
                      : 'bg-red-800 hover:bg-red-900 text-white border-red-800'
                }`}
              >
                {executing ? 'Executing...' : !marketInfo.isOpen ? `🔒 Market Closed (${marketInfo.marketStatus?.nextEventDesc || 'Opens Next Session'})` : `Execute ${action} Order`}
              </button>
            </form>
          </div>

          {/* Level 2 Order Book Depth Simulator */}
          <div className="p-4 bg-white border border-[#111111]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#111111]">
              <span className="font-headline uppercase font-bold text-xs text-[#111111] flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#111111]" />
                Level 2 Depth
              </span>
              <span className="text-[10px] text-stone-500">Spread: 0.02%</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[10px]">
              {/* Bids */}
              <div>
                <div className="font-bold text-emerald-900 border-b border-[#111111] pb-0.5 mb-1 flex justify-between">
                  <span>BID</span>
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
                <div className="font-bold text-red-900 border-b border-[#111111] pb-0.5 mb-1 flex justify-between">
                  <span>ASK</span>
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
