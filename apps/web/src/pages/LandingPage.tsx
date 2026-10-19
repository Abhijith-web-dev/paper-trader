import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  ShieldCheck, 
  Globe2, 
  Cpu, 
  Award, 
  CheckCircle2, 
  ArrowRight,
  BookOpen,
  LineChart
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>100% Risk-Free • Powered by Real Market Data</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Master International Markets with <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Zero Risk</span>
        </h1>

        <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Practice trading US stocks, Indian equities, global indices, forex, and crypto against real live market feeds. Virtual capital with an institutional-grade matching engine and double-entry ledger.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/dashboard"
            className="px-6 py-3.5 rounded-xl bg-emerald-500 text-navy-950 font-bold text-sm hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/25 hover:scale-[1.02]"
          >
            <span>Launch Simulation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/markets"
            className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-sm transition-all border border-slate-700"
          >
            Explore Real Quotes
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 text-left">
          <div className="p-4 rounded-2xl bg-navy-900 border border-slate-800">
            <Globe2 className="w-6 h-6 text-emerald-400 mb-2" />
            <h3 className="font-bold text-sm text-white">US & Indian Equities</h3>
            <p className="text-xs text-slate-400 mt-1">AAPL, NVDA, RELIANCE, TCS, and indices.</p>
          </div>
          <div className="p-4 rounded-2xl bg-navy-900 border border-slate-800">
            <Cpu className="w-6 h-6 text-blue-400 mb-2" />
            <h3 className="font-bold text-sm text-white">Genuine Market Data</h3>
            <p className="text-xs text-slate-400 mt-1">Yahoo Finance & ECB live feeds with zero price fabrication.</p>
          </div>
          <div className="p-4 rounded-2xl bg-navy-900 border border-slate-800">
            <LineChart className="w-6 h-6 text-purple-400 mb-2" />
            <h3 className="font-bold text-sm text-white">Strategy Backtesting</h3>
            <p className="text-xs text-slate-400 mt-1">SMA crossovers, RSI reversal, equity curves.</p>
          </div>
          <div className="p-4 rounded-2xl bg-navy-900 border border-slate-800">
            <Award className="w-6 h-6 text-amber-400 mb-2" />
            <h3 className="font-bold text-sm text-white">Double-Entry Ledger</h3>
            <p className="text-xs text-slate-400 mt-1">Immutable transaction ledger and zero overselling.</p>
          </div>
        </div>
      </section>

      {/* Educational Notice Banner */}
      <section className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-navy-900 to-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <BookOpen className="w-4 h-4" />
            <span>FINANCIAL EDUCATION PLATFORM</span>
          </div>
          <h2 className="text-xl font-bold text-white">Simulated Funds Only • No Real-Money Brokerage</h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            GlobalTrade Simulator is strictly designed for educational and strategy testing purposes. We do not accept real-money deposits, connect real broker execution APIs, or sell securities. All profit and loss calculations reflect hypothetical executions.
          </p>
        </div>
        <Link
          to="/learn"
          className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors whitespace-nowrap border border-slate-700"
        >
          View Curriculum
        </Link>
      </section>
    </div>
  );
};
