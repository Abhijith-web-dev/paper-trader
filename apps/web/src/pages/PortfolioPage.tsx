import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../lib/apiClient';
import { PortfolioSummary, Position, VirtualAccount } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  ArrowUpRight,
  PieChart,
  Wallet,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const PortfolioPage: React.FC = () => {
  const { account, refreshAccount } = useAuth();
  const [data, setData] = useState<{
    summary: PortfolioSummary;
    positions: Position[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.get<{ summary: PortfolioSummary; positions: Position[] }>('/portfolio');
      setData(res);
    } catch (err) {
      console.warn('Portfolio load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleResetPortfolio = async () => {
    if (!window.confirm('Reset virtual portfolio to initial $100,000 balance? All positions and orders will be cleared.')) {
      return;
    }
    setResetting(true);
    try {
      await ApiClient.post('/portfolio/reset');
      await refreshAccount();
      await fetchPortfolio();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    } catch (err) {
      alert('Failed to reset portfolio');
    } finally {
      setResetting(false);
    }
  };

  const summary = data?.summary;
  const positions = data?.positions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-400" />
            <span>Virtual Portfolio & Holdings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Realized & unrealized profit/loss calculated against live market quotes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetPortfolio}
            disabled={resetting}
            className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-slate-700 flex items-center gap-2 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Account ($100k)</span>
          </button>
        </div>
      </div>

      {resetSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Virtual portfolio reset successfully to $100,000 USD!</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-1.5">
          <span className="text-xs text-slate-400">Total Net Worth</span>
          <div className="font-mono text-2xl font-extrabold text-white">
            {formatCurrency(summary?.totalEquity ?? 100000, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500">Cash + Live Market Value</p>
        </div>

        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-1.5">
          <span className="text-xs text-slate-400">Available Liquid Cash</span>
          <div className="font-mono text-2xl font-extrabold text-emerald-400">
            {formatCurrency(account?.availableCash ?? 100000, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500">Deployable for orders</p>
        </div>

        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-1.5">
          <span className="text-xs text-slate-400">Unrealized P&L</span>
          <div className={`font-mono text-2xl font-extrabold ${(summary?.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(summary?.unrealizedPnl ?? 0, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {formatPercent(summary?.unrealizedPnlPercent ?? 0)} of invested capital
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-1.5">
          <span className="text-xs text-slate-400">Realized P&L (All-Time)</span>
          <div className={`font-mono text-2xl font-extrabold ${(summary?.realizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(summary?.realizedPnl ?? 0, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500">Booked from closed positions</p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="rounded-2xl bg-navy-900 border border-slate-800 overflow-hidden shadow-xl space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>Open Asset Holdings ({positions.length})</span>
          </h2>
          <Link to="/orders" className="text-xs text-emerald-400 hover:underline font-semibold">
            View Ledger Transactions
          </Link>
        </div>

        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850/50 text-slate-400">
                  <th className="py-3 px-3 font-semibold">Asset / Symbol</th>
                  <th className="py-3 px-3 font-semibold text-right">Quantity</th>
                  <th className="py-3 px-3 font-semibold text-right">Avg Entry Price</th>
                  <th className="py-3 px-3 font-semibold text-right">Current Mark Price</th>
                  <th className="py-3 px-3 font-semibold text-right">Market Value</th>
                  <th className="py-3 px-3 font-semibold text-right">Unrealized P&L</th>
                  <th className="py-3 px-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {positions.map((pos) => {
                  const isUp = pos.unrealizedPnl >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-slate-850/40">
                      <td className="py-3.5 px-3">
                        <Link to={`/instrument/${pos.symbol}`} className="font-bold text-white hover:text-emerald-400 transition-colors block text-sm font-sans">
                          {pos.symbol}
                        </Link>
                        <span className="text-[10px] text-slate-500 font-sans">{pos.exchange}</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-white">
                        {pos.quantity}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300">
                        {formatCurrency(pos.averageEntryPrice)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-100 font-bold">
                        {formatCurrency(pos.currentPrice)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-white">
                        {formatCurrency(pos.marketValue)}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {formatCurrency(pos.unrealizedPnl)} ({formatPercent(pos.unrealizedPnlPercent ?? 0)})
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-sans">
                        <Link
                          to={`/instrument/${pos.symbol}`}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
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
        ) : (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-200 text-sm">No Active Positions</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't purchased any virtual assets yet. Go to Global Markets to buy shares with your virtual cash.
            </p>
            <Link
              to="/markets"
              className="inline-block px-4 py-2 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Explore Markets
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
