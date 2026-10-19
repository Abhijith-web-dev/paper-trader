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
  Plus,
  ShieldAlert,
  Clock,
  Send,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, account } = useAuth();
  const [portfolioData, setPortfolioData] = useState<{
    summary: PortfolioSummary;
    positions: Position[];
  } | null>(null);

  const [marketQuotes, setMarketQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('6m');

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
  }, [account]);

  const summary = portfolioData?.summary;
  const isPositiveDay = (summary?.dayChange ?? 0) >= 0;
  const positions = portfolioData?.positions || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Account Overview matching the Reference Style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Main Wallet Value & Hero Chart Box */}
        <div className="lg:col-span-2 bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Wallet Value</span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="font-sans text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                  {formatCurrency(summary?.totalEquity ?? account?.initialBalance ?? 100000, account?.baseCurrency)}
                </span>
                <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                  isPositiveDay ? 'text-[#CCFF00] bg-[#CCFF00]/10' : 'text-red-400 bg-red-500/10'
                }`}>
                  {isPositiveDay ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                  {formatPercent(summary?.dayChangePercent ?? 0)}
                </span>
              </div>
            </div>

            {/* Timeframe pill selector as seen in ref image */}
            <div className="flex items-center gap-1 bg-[#10151C] p-1.5 rounded-2xl border border-[#1B222D]">
              {['1h', '8h', '1d', '1w', '1m', '6m', '1y'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    activeTimeframe === tf
                      ? 'bg-black text-[#CCFF00] shadow-md border border-[#1B222D]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Stylized Vertical Bar & Neon Wave Chart Canvas */}
          <div className="relative h-64 w-full bg-[#070A0F] rounded-2xl border border-[#1B222D] p-4 flex flex-col justify-between overflow-hidden">
            {/* Background vertical soundwave/histogram bars from ref image */}
            <div className="absolute inset-0 flex items-end justify-between px-6 py-6 opacity-20 pointer-events-none">
              {[40, 65, 30, 85, 45, 90, 75, 50, 80, 95, 60, 40, 70, 85, 90, 65, 50, 80, 95, 70, 45, 60, 75, 90].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            {/* Neon Yellow Wave Line SVG Overlay */}
            <svg className="absolute inset-0 w-full h-full p-4 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#CCFF00" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#CCFF00" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,80 Q 15,75 25,65 T 50,55 T 75,68 T 90,40 L 100,38 L 100,100 L 0,100 Z"
                fill="url(#neonGradient)"
              />
              <path
                d="M 0,80 Q 15,75 25,65 T 50,55 T 75,68 T 90,40 L 100,38"
                fill="none"
                stroke="#CCFF00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Highlight Marker Dot */}
              <circle cx="50" cy="55" r="3.5" fill="#CCFF00" stroke="#000000" strokeWidth="2" />
            </svg>

            {/* Active Floating Value Tag */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-[#CCFF00]/40 px-3 py-1 rounded-full text-xs font-mono font-bold text-[#CCFF00] flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-ping" />
              <span>+{formatCurrency(summary?.unrealizedPnl ?? 1859.48, account?.baseCurrency)}</span>
            </div>

            {/* Time markers axis */}
            <div className="relative z-10 flex justify-between text-[11px] font-mono text-slate-500 pt-auto mt-auto">
              <span>8:00 AM</span>
              <span>10:00 AM</span>
              <span>12:00 PM</span>
              <span>2:00 PM</span>
              <span>4:00 PM</span>
            </div>
          </div>

          {/* 4 Bottom Financial Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 bg-[#10151C] rounded-2xl border border-[#1B222D]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Realized P&L</span>
              <div className="font-mono text-base font-extrabold text-white mt-1">
                {formatCurrency(summary?.realizedPnl ?? 0, account?.baseCurrency)}
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">Booked Trades</span>
            </div>

            <div className="p-3.5 bg-[#10151C] rounded-2xl border border-[#1B222D]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Unrealized P&L</span>
              <div className={`font-mono text-base font-extrabold mt-1 ${(summary?.unrealizedPnl ?? 0) >= 0 ? 'text-[#CCFF00]' : 'text-red-400'}`}>
                {formatCurrency(summary?.unrealizedPnl ?? 0, account?.baseCurrency)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Mark-to-Market</span>
            </div>

            <div className="p-3.5 bg-[#10151C] rounded-2xl border border-[#1B222D]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Available Cash</span>
              <div className="font-mono text-base font-extrabold text-[#CCFF00] mt-1">
                {formatCurrency(account?.availableCash ?? 100000, account?.baseCurrency)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Liquid Capital</span>
            </div>

            <div className="p-3.5 bg-[#10151C] rounded-2xl border border-[#1B222D]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Day Change</span>
              <div className={`font-mono text-base font-extrabold mt-1 ${isPositiveDay ? 'text-[#CCFF00]' : 'text-red-400'}`}>
                {formatCurrency(summary?.dayChange ?? 0, account?.baseCurrency)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Today's Session</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Portfolio Risk Score & Transactions Section from Reference */}
        <div className="space-y-6">
          {/* Portfolio Risk Score Card (Exact replica of top-right in ref image) */}
          <div className="bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Portfolio Risk Score</h3>
                <span className="text-[10px] text-slate-500 block">Calculated Real-Time</span>
              </div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Updated Just Now</span>
            </div>

            {/* Neon Yellow Risk Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-[#10151C] h-3 rounded-full overflow-hidden flex border border-[#1B222D]">
                <div 
                  className="bg-[#CCFF00] h-full rounded-full transition-all duration-500 shadow-sm shadow-[#CCFF00]" 
                  style={{ width: `${summary?.riskAnalysis?.concentrationRisk === 'HIGH' ? 85 : summary?.riskAnalysis?.concentrationRisk === 'MODERATE' ? 45 : 25}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <span className="text-emerald-400">Low Risk</span>
                <span className="text-red-400">High Risk</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-[#10151C] p-3 rounded-2xl border border-[#1B222D] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Risk Status: <span className="font-bold text-white">{summary?.riskAnalysis?.concentrationRisk || 'LOW'}</span>. Single-asset concentration is under institutional limits.
              </p>
            </div>
          </div>

          {/* Quick Transactions / Holdings Panel from Ref Image */}
          <div className="bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Recent Transactions</h3>
              <Link to="/orders" className="text-xs font-bold text-[#CCFF00] hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-2.5">
              {/* Highlighted Yellow Card (As in Ref Image) */}
              <div className="p-3.5 rounded-2xl bg-[#CCFF00] text-black space-y-2 shadow-lg shadow-[#CCFF00]/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-black text-[#CCFF00] flex items-center justify-center font-bold text-xs">
                      $
                    </div>
                    <div>
                      <span className="font-extrabold text-xs block">Simulated Execution</span>
                      <span className="text-[10px] font-semibold text-black/70">Apple Inc. (AAPL)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded-md">
                    Confirmed
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-1">
                  <span className="font-mono text-sm font-extrabold">+10 Shares</span>
                  <span className="font-mono text-xs font-bold">Filled @ Market</span>
                </div>
              </div>

              {/* Dark Card Transactions */}
              <div className="p-3.5 rounded-2xl bg-[#10151C] border border-[#1B222D] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#1B222D] text-slate-300 flex items-center justify-center font-bold text-xs">
                      ₹
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block">Reliance Industries</span>
                      <span className="text-[10px] text-slate-400">NSE • Limit Order</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Active
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs font-mono">
                  <span className="text-slate-400">Qty: 25</span>
                  <span className="font-bold text-white">₹1,220.50</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#10151C] border border-[#1B222D] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[#1B222D] text-slate-300 flex items-center justify-center font-bold text-xs">
                      ₿
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block">Bitcoin Spot</span>
                      <span className="text-[10px] text-slate-400">CoinGecko Feed</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    Simulated
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs font-mono">
                  <span className="text-slate-400">Qty: 0.15 BTC</span>
                  <span className="font-bold text-white">$82,717.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Market Movers Universe Table */}
      <div className="bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#CCFF00]" />
              <span>International Market Feeds</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Live rates from Yahoo Finance, ECB, and CoinGecko</p>
          </div>

          <Link to="/markets" className="px-4 py-2 rounded-xl bg-[#10151C] hover:bg-[#1B222D] text-xs font-bold text-[#CCFF00] border border-[#1B222D] transition-colors flex items-center gap-1.5">
            <span>Explore All 17 Markets</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1B222D] text-slate-400 font-semibold">
                <th className="py-3 px-3">Symbol / Security</th>
                <th className="py-3 px-3 text-right">Last Price</th>
                <th className="py-3 px-3 text-right">24h Net Change</th>
                <th className="py-3 px-3 text-right">Session Status</th>
                <th className="py-3 px-3 text-center">Simulated Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B222D]/60 font-mono">
              {Object.values(marketQuotes).map((quote) => {
                const isUp = quote.change >= 0;
                return (
                  <tr key={quote.symbol} className="hover:bg-[#10151C]/60 transition-colors">
                    <td className="py-3 px-3 font-sans">
                      <Link to={`/instrument/${quote.symbol}`} className="font-bold text-white hover:text-[#CCFF00] transition-colors block text-sm">
                        {quote.symbol}
                      </Link>
                      <span className="text-[10px] text-slate-500 uppercase">{quote.provider}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-white text-sm">
                      {formatCurrency(quote.price, quote.currency)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-xs inline-block ${
                        isUp ? 'bg-[#CCFF00]/10 text-[#CCFF00]' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {formatPercent(quote.changePercent)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#10151C] border border-[#1B222D] text-slate-300">
                        {quote.marketStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-sans">
                      <Link
                        to={`/instrument/${quote.symbol}`}
                        className="px-4 py-1.5 rounded-full bg-[#10151C] hover:bg-[#CCFF00] text-slate-300 hover:text-black font-bold text-xs border border-[#1B222D] hover:border-[#CCFF00] transition-all inline-block"
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
    </div>
  );
};
