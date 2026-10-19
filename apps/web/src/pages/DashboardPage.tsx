import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../lib/apiClient';
import { MarketQuote, PortfolioSummary, Position } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  Activity, 
  Sparkles,
  RefreshCw,
  Plus
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, account, refreshAccount } = useAuth();
  const [portfolioData, setPortfolioData] = useState<{
    summary: PortfolioSummary;
    positions: Position[];
  } | null>(null);

  const [marketQuotes, setMarketQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [port, quotes] = await Promise.all([
        ApiClient.get<{ summary: PortfolioSummary; positions: Position[] }>('/portfolio'),
        ApiClient.get<Record<string, MarketQuote>>('/markets/quotes?symbols=AAPL,NVDA,MSFT,RELIANCE.NS,TCS.NS,^GSPC,BTC-USD')
      ]);
      setPortfolioData(port);
      setMarketQuotes(quotes);
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  const summary = portfolioData?.summary;
  const isPositiveDay = (summary?.dayChange ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Welcome & Account Summary Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Welcome back, {user?.displayName || 'Trader'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Simulation Mode
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-market prices from Yahoo Finance & ECB • Virtual capital
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              loadDashboardData();
            }}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 transition-colors border border-slate-700"
            title="Refresh Quotes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/markets"
            className="px-4 py-2 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Place Order</span>
          </Link>
        </div>
      </div>

      {/* Portfolio Stats Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Equity */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Virtual Equity</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {formatCurrency(summary?.totalEquity ?? account?.initialBalance ?? 100000, account?.baseCurrency)}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {isPositiveDay ? (
              <span className="flex items-center text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                {formatPercent(summary?.dayChangePercent ?? 0)}
              </span>
            ) : (
              <span className="flex items-center text-red-400">
                <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                {formatPercent(summary?.dayChangePercent ?? 0)}
              </span>
            )}
            <span className="text-slate-500 text-[11px]">unrealized P&L</span>
          </div>
        </div>

        {/* Available Cash */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Available Cash</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-emerald-400">
            {formatCurrency(account?.availableCash ?? 100000, account?.baseCurrency)}
          </div>
          <div className="text-[11px] text-slate-400">
            Reserved for Limit Orders: <span className="font-mono text-slate-200">{formatCurrency(account?.reservedCash ?? 0, account?.baseCurrency)}</span>
          </div>
        </div>

        {/* Invested Capital */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Invested Assets</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {formatCurrency(summary?.investedValue ?? 0, account?.baseCurrency)}
          </div>
          <div className="text-[11px] text-slate-400">
            Active Positions: <span className="font-bold text-white">{portfolioData?.positions.length ?? 0}</span>
          </div>
        </div>

        {/* Realized Profit & Loss */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Realized P&L (Booked)</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`font-mono text-2xl font-extrabold ${(summary?.realizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(summary?.realizedPnl ?? 0, account?.baseCurrency)}
          </div>
          <div className="text-[11px] text-slate-400">
            Settled via Double-Entry Ledger
          </div>
        </div>
      </div>

      {/* Main Market Movers & Live Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Movers Table (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Market Movers</span>
            </h2>
            <Link to="/markets" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
              <span>View All 17 Markets</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 pb-2">
                  <th className="pb-3 font-semibold">Symbol / Name</th>
                  <th className="pb-3 font-semibold text-right">Price</th>
                  <th className="pb-3 font-semibold text-right">24h Change</th>
                  <th className="pb-3 font-semibold text-right">Status</th>
                  <th className="pb-3 font-semibold text-right">Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.values(marketQuotes).map((quote) => {
                  const isUp = quote.change >= 0;
                  return (
                    <tr key={quote.symbol} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-3">
                        <Link to={`/instrument/${quote.symbol}`} className="font-bold text-white hover:text-emerald-400 transition-colors block">
                          {quote.symbol}
                        </Link>
                        <span className="text-[10px] text-slate-500 uppercase">{quote.provider}</span>
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-slate-100">
                        {formatCurrency(quote.price, quote.currency)}
                      </td>
                      <td className="py-3 text-right font-mono">
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {formatPercent(quote.changePercent)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {quote.marketStatus}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={`/instrument/${quote.symbol}`}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-navy-950 font-bold text-[11px] transition-colors inline-block"
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Portfolio Holdings or Empty State (1 Col) */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-400" />
              <span>Current Holdings</span>
            </h2>
            <Link to="/portfolio" className="text-xs text-blue-400 hover:underline font-semibold">
              Manage
            </Link>
          </div>

          {portfolioData?.positions && portfolioData.positions.length > 0 ? (
            <div className="space-y-3">
              {portfolioData.positions.map((p) => {
                const isPos = p.unrealizedPnl >= 0;
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-850/80 border border-slate-750 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-white">{p.symbol}</span>
                      <p className="text-[11px] text-slate-400">{p.quantity} shares @ {formatCurrency(p.averageEntryPrice)}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-slate-200">{formatCurrency(p.marketValue)}</p>
                      <p className={`text-xs font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercent(p.unrealizedPnlPercent ?? 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No Open Positions</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Select an instrument from global markets and place a simulated market or limit order.
              </p>
              <Link
                to="/markets"
                className="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold transition-colors"
              >
                Browse Markets
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
