import React from 'react';
import { Link } from 'react-router-dom';
import BacktesterModal from '../components/BacktesterModal';
import { ArrowLeft, BarChart2, ShieldCheck, Zap } from 'lucide-react';

export default function BacktestPage() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 font-mono text-xs text-[#111111]">
      {/* Breadcrumb Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
        <div className="flex items-center gap-2 text-neutral-600">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 font-bold text-[#111111] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-700 font-bold uppercase flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5 text-stone-700" />
            Quantitative Strategy Backtester & Pattern Engine
          </span>
        </div>

        <div className="text-[11px] text-neutral-700 font-medium hidden sm:block">
          Engine: <strong className="text-emerald-700">100% Client-Side Web Worker</strong>
        </div>
      </div>

      {/* Embedded Full View of Backtester */}
      <BacktesterModal
        isOpen={true}
        onClose={() => window.history.back()}
        currentStock={{ symbol: 'RELIANCE.NS' }}
      />
    </div>
  );
}
