import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ApiClient } from '../lib/apiClient';
import { HistoricalCandle, MarketQuote, OrderSide, OrderType } from '@globaltrade/shared';
import { formatCurrency, formatPercent, formatDate } from '../lib/formatters';
import { TradingViewChart } from '../components/chart/TradingViewChart';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

export const InstrumentDetailPage: React.FC = () => {
  const { symbol = 'AAPL' } = useParams<{ symbol: string }>();
  const cleanSymbol = symbol.toUpperCase();
  const { account, refreshAccount } = useAuth();

  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [candles, setCandles] = useState<HistoricalCandle[]>([]);
  const [timeframe, setTimeframe] = useState<'1D' | '5D' | '1M' | '6M' | '1Y'>('1M');
  const [loading, setLoading] = useState(true);

  // Order Ticket state
  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [stopPrice, setStopPrice] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchInstrumentData = async () => {
    try {
      const q = await ApiClient.get<MarketQuote>(`/markets/quotes/${cleanSymbol}`);
      setQuote(q);
      setLimitPrice(q.price);
      setStopPrice(q.price);

      let days = 30;
      let interval = '1d';
      if (timeframe === '1D') { days = 1; interval = '5m'; }
      else if (timeframe === '5D') { days = 5; interval = '15m'; }
      else if (timeframe === '1M') { days = 30; interval = '1d'; }
      else if (timeframe === '6M') { days = 180; interval = '1d'; }
      else if (timeframe === '1Y') { days = 365; interval = '1d'; }

      const c = await ApiClient.get<HistoricalCandle[]>(`/markets/candles/${cleanSymbol}?interval=${interval}&days=${days}`);
      setCandles(c);
    } catch (err) {
      console.warn('Failed to load instrument:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstrumentData();
    const timer = setInterval(() => {
      ApiClient.get<MarketQuote>(`/markets/quotes/${cleanSymbol}`).then(setQuote).catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [cleanSymbol, timeframe]);

  // Order Calculations
  const currentPrice = quote?.price ?? 0;
  const executionBasePrice = type === 'LIMIT' ? limitPrice : currentPrice;
  const estimatedNotional = quantity * executionBasePrice;
  const simulatedFee = Number((estimatedNotional * 0.0005).toFixed(2)); // 0.05%
  const totalEstimatedCost = estimatedNotional + simulatedFee;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setExecutionMessage(null);

    try {
      const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload: any = {
        symbol: cleanSymbol,
        side,
        type,
        quantity: Number(quantity),
        idempotencyKey
      };

      if (type === 'LIMIT' || type === 'STOP_LIMIT') {
        payload.limitPrice = Number(limitPrice);
      }
      if (type === 'STOP' || type === 'STOP_LIMIT') {
        payload.stopPrice = Number(stopPrice);
      }

      const res = await ApiClient.post<any>('/orders', payload);
      await refreshAccount();

      const order = res.order;
      if (order.status === 'FILLED') {
        setExecutionMessage({
          text: `Success! Filled ${side} ${order.filledQuantity} shares of ${cleanSymbol} @ ${formatCurrency(order.avgFillPrice, quote?.currency)} (Fee: ${formatCurrency(order.fees, quote?.currency)})`
        });
      } else {
        setExecutionMessage({
          text: `Order submitted as ${order.status}. Awaiting trigger price condition.`
        });
      }
    } catch (err: any) {
      setExecutionMessage({
        text: err.message || 'Order submission failed',
        isError: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUp = (quote?.change ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/markets" className="hover:text-[#CCFF00] flex items-center gap-1.5 transition-colors font-bold">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Global Markets</span>
        </Link>
        <span>/</span>
        <span className="text-white font-mono font-bold">{cleanSymbol}</span>
      </div>

      {/* Quote Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{cleanSymbol}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#10151C] text-slate-300 border border-[#1B222D]">
              {quote?.currency || 'USD'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20">
              {quote?.marketStatus || 'OPEN'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Provider: {quote?.provider || 'GlobalData Gateway'}</span>
            </span>
            <span>•</span>
            <span>Updated: {quote ? formatDate(quote.timestamp) : '—'}</span>
          </div>
        </div>

        {/* Live Price Display */}
        <div className="text-left md:text-right">
          <div className="font-mono text-3xl md:text-4xl font-black text-white">
            {quote ? formatCurrency(quote.price, quote.currency) : '—'}
          </div>
          <div className="flex md:justify-end items-center gap-2 mt-1.5 font-mono text-xs font-bold">
            <span className={`flex items-center px-2.5 py-0.5 rounded-full ${
              isUp 
                ? 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {isUp ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              {quote ? formatCurrency(quote.change, quote.currency) : '0.00'} ({quote ? formatPercent(quote.changePercent) : '0.00%'})
            </span>
            <span className="text-slate-500 text-[10px] uppercase font-bold">Session</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart on Left (2 cols), Order Ticket on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chart & Key Metrics */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeframe Switcher */}
          <div className="flex items-center gap-2 p-1.5 rounded-full bg-[#0B0F14] border border-[#1B222D] w-fit">
            {(['1D', '5D', '1M', '6M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  timeframe === tf
                    ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/10'
                    : 'text-slate-400 hover:text-white hover:bg-[#10151C]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Interactive TradingView Chart */}
          <TradingViewChart candles={candles} symbol={cleanSymbol} height={440} />

          {/* Session Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase">Session High</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">
                {quote ? formatCurrency(quote.high, quote.currency) : '—'}
              </span>
            </div>
            <div className="p-4 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase">Session Low</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">
                {quote ? formatCurrency(quote.low, quote.currency) : '—'}
              </span>
            </div>
            <div className="p-4 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase">Open Price</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">
                {quote ? formatCurrency(quote.open, quote.currency) : '—'}
              </span>
            </div>
            <div className="p-4 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase">Prev Close</span>
              <span className="font-mono text-base font-bold text-white mt-1 block">
                {quote ? formatCurrency(quote.previousClose, quote.currency) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Simulated Order Ticket */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-6 h-fit">
          <div className="flex items-center justify-between border-b border-[#1B222D] pb-4">
            <h2 className="font-extrabold text-lg text-white">Order Execution</h2>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#CCFF00]">
              <ShieldCheck className="w-4 h-4" />
              <span>Simulated Fill</span>
            </div>
          </div>

          {/* Buy / Sell Tabs */}
          <div className="grid grid-cols-2 p-1.5 rounded-full bg-[#10151C] border border-[#1B222D]">
            <button
              type="button"
              onClick={() => setSide('BUY')}
              className={`py-2.5 rounded-full text-xs font-black transition-all ${
                side === 'BUY'
                  ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Buy {cleanSymbol}
            </button>
            <button
              type="button"
              onClick={() => setSide('SELL')}
              className={`py-2.5 rounded-full text-xs font-black transition-all ${
                side === 'SELL'
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sell {cleanSymbol}
            </button>
          </div>

          <form onSubmit={handlePlaceOrder} className="space-y-4 text-xs">
            {/* Order Type */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">Order Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OrderType)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-medium focus:outline-none focus:border-[#CCFF00] transition-colors"
              >
                <option value="MARKET">Market Order (Immediate Fill)</option>
                <option value="LIMIT">Limit Order</option>
                <option value="STOP">Stop Loss Order</option>
                <option value="STOP_LIMIT">Stop-Limit Order</option>
              </select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <label className="font-bold">Quantity (Shares)</label>
                <span className="font-mono text-[11px]">Available: {account ? formatCurrency(account.availableCash, account.baseCurrency) : '—'}</span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-[#CCFF00] transition-colors"
                required
              />
            </div>

            {/* Limit Price Input */}
            {(type === 'LIMIT' || type === 'STOP_LIMIT') && (
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Limit Price ({quote?.currency || 'USD'})</label>
                <input
                  type="number"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-[#CCFF00] transition-colors"
                  required
                />
              </div>
            )}

            {/* Stop Price Input */}
            {(type === 'STOP' || type === 'STOP_LIMIT') && (
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Trigger / Stop Price ({quote?.currency || 'USD'})</label>
                <input
                  type="number"
                  step="0.01"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-[#CCFF00] transition-colors"
                  required
                />
              </div>
            )}

            {/* Order Cost Breakdown */}
            <div className="p-4 rounded-2xl bg-[#10151C] border border-[#1B222D] space-y-2 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Notional Amount</span>
                <span className="text-slate-200 font-bold">{formatCurrency(estimatedNotional, quote?.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Simulated Fee (0.05%)</span>
                <span className="text-slate-200 font-bold">{formatCurrency(simulatedFee, quote?.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Simulated Slippage (0.05%)</span>
                <span className="text-[#CCFF00] font-bold">Included</span>
              </div>
              <div className="pt-2 border-t border-[#1B222D] flex justify-between font-black text-xs text-white">
                <span>Total Capital Impact</span>
                <span className="text-[#CCFF00]">{formatCurrency(totalEstimatedCost, quote?.currency)}</span>
              </div>
            </div>

            {/* Execution Result Banner */}
            {executionMessage && (
              <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 ${
                executionMessage.isError 
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00]'
              }`}>
                {executionMessage.isError ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{executionMessage.text}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-full font-black text-xs transition-all shadow-lg ${
                side === 'BUY'
                  ? 'bg-[#CCFF00] hover:bg-[#D4FF33] text-black shadow-[#CCFF00]/20'
                  : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? 'Processing Transaction...' : `Submit Simulated ${side} Order`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
