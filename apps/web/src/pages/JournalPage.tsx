import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { TradeJournalEntry } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { 
  BookOpen, 
  Plus, 
  Tag, 
  ShieldAlert, 
  Target, 
  CheckCircle2, 
  Clock,
  Sparkles
} from 'lucide-react';

export const JournalPage: React.FC = () => {
  const { account } = useAuth();
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form state
  const [symbol, setSymbol] = useState('');
  const [strategyTag, setStrategyTag] = useState('Breakout Momentum');
  const [entryRationale, setEntryRationale] = useState('');
  const [intendedRiskAmount, setIntendedRiskAmount] = useState<number>(500);
  const [targetProfitAmount, setTargetProfitAmount] = useState<number>(1500);
  const [postTradeReview, setPostTradeReview] = useState('');
  const [lessonLearned, setLessonLearned] = useState('');

  const fetchEntries = async () => {
    try {
      const data = await ApiClient.get<TradeJournalEntry[]>('/journal');
      setEntries(data);
    } catch (err) {
      console.warn('Failed to fetch journal entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/journal', {
        symbol: symbol.toUpperCase(),
        strategyTag,
        entryRationale,
        intendedRiskAmount: Number(intendedRiskAmount),
        targetProfitAmount: Number(targetProfitAmount),
        postTradeReview: postTradeReview.trim() || undefined,
        lessonLearned: lessonLearned.trim() || undefined
      });

      setShowModal(false);
      setSymbol('');
      setEntryRationale('');
      setPostTradeReview('');
      setLessonLearned('');
      fetchEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to save journal entry');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <BookOpen className="w-4 h-4" /> Quantitative Discipline
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Trade Journal & Strategy Log
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Record pre-trade risk-reward hypotheses, strategy taxonomy, emotional state, and post-trade qualitative retrospectives to build professional trade discipline.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Log Trade Rationale
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading journal records...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-navy-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Journal Entries Recorded</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Top institutional traders maintain rigorous journals documenting why each position was opened and what was learned from the outcome.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-emerald-400 border border-slate-700 transition-colors"
          >
            Create Your First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((item) => (
            <div
              key={item.id}
              className="bg-navy-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-base text-white">{item.symbol}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {item.strategyTag}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {formatDate(item.createdAt)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Entry Rationale</span>
                    <p className="text-xs text-slate-200 leading-relaxed bg-navy-950/60 p-3 rounded-xl border border-slate-850">
                      {item.entryRationale}
                    </p>
                  </div>

                  {item.postTradeReview && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Post-Trade Review</span>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-850/40 p-3 rounded-xl border border-slate-800">
                        {item.postTradeReview}
                      </p>
                    </div>
                  )}

                  {item.lessonLearned && (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-[11px] text-emerald-400 uppercase tracking-wide">Key Takeaway</span>
                        <span>{item.lessonLearned}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-850/60 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Risk/Reward Blueprint</span>
                    <div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Intended Risk (Stop):
                      </span>
                      <span className="font-mono text-sm font-bold text-red-400">
                        {account ? formatCurrency(item.intendedRiskAmount, account.baseCurrency) : item.intendedRiskAmount}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5 text-emerald-400" /> Target Profit:
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {account ? formatCurrency(item.targetProfitAmount, account.baseCurrency) : item.targetProfitAmount}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    R:R Ratio:{' '}
                    <span className="font-mono font-bold text-white">
                      1 : {(item.intendedRiskAmount > 0 ? (item.targetProfitAmount / item.intendedRiskAmount).toFixed(2) : 'N/A')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-lg bg-navy-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                Log Trade Hypothesis & Risk Plan
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Before executing or upon entry, define your edge and risk limits.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Symbol Ticker</label>
                <input
                  type="text"
                  placeholder="e.g. AAPL or RELIANCE.NS"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-750 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Strategy Taxonomy</label>
                <select
                  value={strategyTag}
                  onChange={(e) => setStrategyTag(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-750 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Breakout Momentum">Breakout Momentum</option>
                  <option value="Trend Following (EMA)">Trend Following (EMA)</option>
                  <option value="Mean Reversion (RSI)">Mean Reversion (RSI)</option>
                  <option value="Value Investing">Value Investing</option>
                  <option value="Macro / FX Arbitrage">Macro / FX Arbitrage</option>
                  <option value="Earnings Catalyst">Earnings Catalyst</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Entry Rationale & Setup Criteria</label>
              <textarea
                required
                rows={3}
                placeholder="Why are you taking this trade? What technical/fundamental triggers appeared?"
                value={entryRationale}
                onChange={(e) => setEntryRationale(e.target.value)}
                className="w-full bg-navy-950 border border-slate-750 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Intended Risk ({account?.baseCurrency || 'USD'})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={intendedRiskAmount}
                  onChange={(e) => setIntendedRiskAmount(Number(e.target.value))}
                  className="w-full bg-navy-950 border border-slate-750 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Profit ({account?.baseCurrency || 'USD'})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={targetProfitAmount}
                  onChange={(e) => setTargetProfitAmount(Number(e.target.value))}
                  className="w-full bg-navy-950 border border-slate-750 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Post-Trade Review & Lessons (Optional)</label>
              <input
                type="text"
                placeholder="What did you learn? Did you follow your discipline?"
                value={lessonLearned}
                onChange={(e) => setLessonLearned(e.target.value)}
                className="w-full bg-navy-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-navy-950 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Save Journal Entry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
