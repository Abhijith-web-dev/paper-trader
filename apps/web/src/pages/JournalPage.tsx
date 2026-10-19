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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1B222D] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#CCFF00] font-extrabold text-xs tracking-wider uppercase mb-1">
            <BookOpen className="w-4 h-4" /> Quantitative Discipline
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Trade Journal & Strategy Log
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Record pre-trade risk-reward hypotheses, strategy taxonomy, emotional state, and post-trade qualitative retrospectives to build professional trade discipline.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto px-6 py-3 rounded-full bg-[#CCFF00] hover:bg-[#D4FF33] text-black font-extrabold text-xs shadow-lg shadow-[#CCFF00]/15 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Log Trade Rationale
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium">Loading journal records...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-8 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[#10151C] border border-[#1B222D] flex items-center justify-center mx-auto text-[#CCFF00]">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-white">No Journal Entries Recorded</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Top institutional traders maintain rigorous journals documenting why each position was opened and what was learned from the outcome.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 rounded-full bg-[#10151C] hover:bg-[#CCFF00] text-slate-200 hover:text-black border border-[#1B222D] text-xs font-bold transition-all"
          >
            Create Your First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((item) => (
            <div
              key={item.id}
              className="bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 hover:border-[#CCFF00]/40 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1B222D] pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-lg text-white">{item.symbol}</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> {item.strategyTag}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {formatDate(item.createdAt)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Entry Rationale</span>
                    <p className="text-xs text-slate-200 leading-relaxed bg-[#10151C] p-4 rounded-2xl border border-[#1B222D]">
                      {item.entryRationale}
                    </p>
                  </div>

                  {item.postTradeReview && (
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Post-Trade Review</span>
                      <p className="text-xs text-slate-300 leading-relaxed bg-[#10151C] p-4 rounded-2xl border border-[#1B222D]">
                        {item.postTradeReview}
                      </p>
                    </div>
                  )}

                  {item.lessonLearned && (
                    <div className="p-4 bg-[#CCFF00]/5 border border-[#CCFF00]/20 rounded-2xl text-xs text-[#CCFF00] flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block text-[11px] uppercase tracking-wide">Key Takeaway</span>
                        <span className="text-slate-200">{item.lessonLearned}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[#10151C] p-5 rounded-2xl border border-[#1B222D] space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="text-[11px] text-slate-400 uppercase font-bold block">Risk/Reward Blueprint</span>
                    <div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Intended Risk (Stop):
                      </span>
                      <span className="font-mono text-base font-extrabold text-red-400">
                        {account ? formatCurrency(item.intendedRiskAmount, account.baseCurrency) : item.intendedRiskAmount}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <Target className="w-3.5 h-3.5 text-[#CCFF00]" /> Target Profit:
                      </span>
                      <span className="font-mono text-base font-extrabold text-[#CCFF00]">
                        {account ? formatCurrency(item.targetProfitAmount, account.baseCurrency) : item.targetProfitAmount}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#1B222D] text-[11px] text-slate-400">
                    R:R Ratio:{' '}
                    <span className="font-mono font-black text-white text-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-lg bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
            <div>
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#CCFF00]" />
                Log Trade Hypothesis & Risk Plan
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Before executing or upon entry, define your edge and risk limits.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Symbol Ticker</label>
                <input
                  type="text"
                  placeholder="e.g. AAPL or RELIANCE.NS"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#CCFF00] font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Strategy Taxonomy</label>
                <select
                  value={strategyTag}
                  onChange={(e) => setStrategyTag(e.target.value)}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#CCFF00]"
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
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Entry Rationale & Setup Criteria</label>
              <textarea
                required
                rows={3}
                placeholder="Why are you taking this trade? What technical/fundamental triggers appeared?"
                value={entryRationale}
                onChange={(e) => setEntryRationale(e.target.value)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-[#CCFF00]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Intended Risk ({account?.baseCurrency || 'USD'})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={intendedRiskAmount}
                  onChange={(e) => setIntendedRiskAmount(Number(e.target.value))}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#CCFF00] font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Target Profit ({account?.baseCurrency || 'USD'})</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={targetProfitAmount}
                  onChange={(e) => setTargetProfitAmount(Number(e.target.value))}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#CCFF00] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Post-Trade Review & Lessons (Optional)</label>
              <input
                type="text"
                placeholder="What did you learn? Did you follow your discipline?"
                value={lessonLearned}
                onChange={(e) => setLessonLearned(e.target.value)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#CCFF00]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-400 hover:text-white hover:bg-[#10151C] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#CCFF00] hover:bg-[#D4FF33] text-black transition-colors shadow-lg shadow-[#CCFF00]/15"
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
