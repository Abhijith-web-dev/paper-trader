import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Globe2, 
  Cpu, 
  Award, 
  ArrowRight,
  BookOpen,
  LineChart
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/25 text-xs font-extrabold text-[#CCFF00]">
          <ShieldCheck className="w-4 h-4" />
          <span>100% Risk-Free • Powered by Real Market Data</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
          Master International Markets with <span className="text-[#CCFF00]">Zero Risk</span>
        </h1>

        <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Practice trading US stocks, Indian equities, global indices, forex, and crypto against real live market feeds. Virtual capital with an institutional-grade matching engine and double-entry ledger.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/dashboard"
            className="px-8 py-4 rounded-full bg-[#CCFF00] text-black font-black text-sm hover:bg-[#D4FF33] transition-all flex items-center gap-2 shadow-xl shadow-[#CCFF00]/20 hover:scale-[1.02]"
          >
            <span>Launch Simulation</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </Link>
          <Link
            to="/markets"
            className="px-8 py-4 rounded-full bg-[#10151C] hover:border-[#CCFF00] hover:text-[#CCFF00] text-slate-200 font-extrabold text-sm transition-all border border-[#1B222D]"
          >
            Explore Real Quotes
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 text-left">
          <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
            <Globe2 className="w-6 h-6 text-[#CCFF00] mb-2" />
            <h3 className="font-extrabold text-sm text-white">US & Indian Equities</h3>
            <p className="text-xs text-slate-400 mt-1">AAPL, NVDA, RELIANCE, TCS, and indices.</p>
          </div>
          <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
            <Cpu className="w-6 h-6 text-[#CCFF00] mb-2" />
            <h3 className="font-extrabold text-sm text-white">Genuine Market Data</h3>
            <p className="text-xs text-slate-400 mt-1">Yahoo Finance & ECB live feeds with zero price fabrication.</p>
          </div>
          <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
            <LineChart className="w-6 h-6 text-[#CCFF00] mb-2" />
            <h3 className="font-extrabold text-sm text-white">Strategy Backtesting</h3>
            <p className="text-xs text-slate-400 mt-1">SMA crossovers, RSI reversal, equity curves.</p>
          </div>
          <div className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D]">
            <Award className="w-6 h-6 text-[#CCFF00] mb-2" />
            <h3 className="font-extrabold text-sm text-white">Double-Entry Ledger</h3>
            <p className="text-xs text-slate-400 mt-1">Immutable transaction ledger and zero overselling.</p>
          </div>
        </div>
      </section>

      {/* Educational Notice Banner */}
      <section className="p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#CCFF00] font-extrabold text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>FINANCIAL EDUCATION PLATFORM</span>
          </div>
          <h2 className="text-xl font-black text-white">Simulated Funds Only • No Real-Money Brokerage</h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            GlobalTrade Simulator is strictly designed for educational and strategy testing purposes. We do not accept real-money deposits, connect real broker execution APIs, or sell securities. All profit and loss calculations reflect hypothetical executions.
          </p>
        </div>
        <Link
          to="/learn"
          className="px-6 py-3 rounded-full bg-[#10151C] text-slate-200 text-xs font-extrabold hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors whitespace-nowrap border border-[#1B222D]"
        >
          View Curriculum
        </Link>
      </section>
    </div>
  );
};
