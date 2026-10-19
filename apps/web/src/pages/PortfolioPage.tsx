import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../lib/apiClient';
import { PortfolioSummary, Position } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { 
  Briefcase, 
  RotateCcw, 
  PieChart, 
  CheckCircle2,
  AlertTriangle,
  Globe
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B222D]">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
              <Briefcase className="w-5 h-5" />
            </span>
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
            className="px-4 py-2.5 rounded-full bg-[#10151C] text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-[#1B222D] flex items-center gap-2 text-xs font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Account ($100k)</span>
          </button>
        </div>
      </div>

      {resetSuccess && (
        <div className="p-4 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Virtual portfolio reset successfully to initial virtual balance!</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Net Worth</span>
          <div className="font-mono text-3xl font-black text-white">
            {formatCurrency(summary?.totalEquity ?? 100000, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500">Cash + Live Market Value</p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Liquid Cash</span>
          <div className="font-mono text-3xl font-black text-[#CCFF00]">
            {formatCurrency(account?.availableCash ?? 100000, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500">Deployable for market & limit orders</p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unrealized P&L</span>
          <div className={`font-mono text-3xl font-black ${(summary?.unrealizedPnl ?? 0) >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>
            {formatCurrency(summary?.unrealizedPnl ?? 0, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {formatPercent(summary?.unrealizedPnlPercent ?? 0)} of invested capital
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Realized P&L</span>
          <div className={`font-mono text-3xl font-black ${(summary?.realizedPnl ?? 0) >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>
            {formatCurrency(summary?.realizedPnl ?? 0, account?.baseCurrency)}
          </div>
          <p className="text-[11px] text-slate-500">Booked from closed positions</p>
        </div>
      </div>

      {/* Portfolio Risk & Exposure Analysis Card */}
      {summary?.riskAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#CCFF00]" /> Concentration Risk Analysis
              </span>
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${
                summary.riskAnalysis.concentrationRisk === 'HIGH'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : summary.riskAnalysis.concentrationRisk === 'MODERATE'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20'
              }`}>
                {summary.riskAnalysis.concentrationRisk} RISK
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-300">
              <div>
                <span className="text-[11px] text-slate-500 block">Top Holding Symbol</span>
                <span className="font-mono font-bold text-white text-base">{summary.riskAnalysis.topHoldingSymbol}</span>
              </div>
              <div className="border-l border-[#1B222D] pl-6">
                <span className="text-[11px] text-slate-500 block">Top Asset Weight</span>
                <span className="font-mono font-bold text-[#CCFF00] text-base">{summary.riskAnalysis.topHoldingWeightPercent}%</span>
              </div>
            </div>

            {summary.riskAnalysis.warnings.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {summary.riskAnalysis.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-2xl">
                    ⚠️ {w}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#CCFF00] bg-[#CCFF00]/10 border border-[#CCFF00]/20 px-3.5 py-2 rounded-2xl font-medium">
                ✓ Portfolio concentration is balanced (no single security exceeds 20% total equity).
              </p>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" /> Currency Exposure
            </span>
            <div className="space-y-3">
              {summary.riskAnalysis.currencyExposures.map(exp => (
                <div key={exp.currency} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono font-bold text-slate-200">{exp.currency}</span>
                    <span className="font-mono font-bold text-slate-400">{exp.percentage}%</span>
                  </div>
                  <div className="w-full bg-[#10151C] h-2 rounded-full overflow-hidden border border-[#1B222D]">
                    <div 
                      className="bg-[#CCFF00] h-full rounded-full transition-all" 
                      style={{ width: `${Math.min(100, Math.max(2, exp.percentage))}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="rounded-3xl bg-[#0B0F14] border border-[#1B222D] overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-white flex items-center gap-2.5">
            <PieChart className="w-5 h-5 text-[#CCFF00]" />
            <span>Open Asset Holdings ({positions.length})</span>
          </h2>
          <Link to="/orders" className="text-xs text-[#CCFF00] hover:underline font-bold">
            View Ledger Transactions →
          </Link>
        </div>

        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1B222D] bg-[#10151C]/60 text-slate-400">
                  <th className="py-3.5 px-4 font-bold rounded-l-xl">Asset / Symbol</th>
                  <th className="py-3.5 px-4 font-bold text-right">Quantity</th>
                  <th className="py-3.5 px-4 font-bold text-right">Avg Entry Price</th>
                  <th className="py-3.5 px-4 font-bold text-right">Current Mark Price</th>
                  <th className="py-3.5 px-4 font-bold text-right">Market Value</th>
                  <th className="py-3.5 px-4 font-bold text-right">Unrealized P&L</th>
                  <th className="py-3.5 px-4 font-bold text-center rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B222D]/60 font-mono">
                {positions.map((pos) => {
                  const isUp = pos.unrealizedPnl >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-[#10151C]/40 transition-colors">
                      <td className="py-4 px-4">
                        <Link to={`/instrument/${pos.symbol}`} className="font-bold text-white hover:text-[#CCFF00] transition-colors block text-sm font-sans">
                          {pos.symbol}
                        </Link>
                        <span className="text-[11px] text-slate-500 font-sans">{pos.exchange}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-white">
                        {pos.quantity}
                      </td>
                      <td className="py-4 px-4 text-right text-slate-300">
                        {formatCurrency(pos.averageEntryPrice)}
                      </td>
                      <td className="py-4 px-4 text-right text-white font-bold">
                        {formatCurrency(pos.currentPrice)}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-white">
                        {formatCurrency(pos.marketValue)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isUp ? 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {formatCurrency(pos.unrealizedPnl)} ({formatPercent(pos.unrealizedPnlPercent ?? 0)})
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-sans">
                        <Link
                          to={`/instrument/${pos.symbol}`}
                          className="px-4 py-1.5 rounded-full bg-[#10151C] hover:bg-[#CCFF00] text-slate-200 hover:text-black text-xs font-bold transition-all border border-[#1B222D]"
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
          <div className="text-center py-14 space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-[#10151C] border border-[#1B222D] text-[#CCFF00] flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-200 text-base">No Active Positions</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven't purchased any virtual assets yet. Go to Global Markets to buy shares with your virtual cash.
            </p>
            <Link
              to="/markets"
              className="inline-block px-6 py-3 rounded-full bg-[#CCFF00] text-black font-extrabold text-xs hover:bg-[#D4FF33] transition-all shadow-lg shadow-[#CCFF00]/10"
            >
              Explore Markets
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
