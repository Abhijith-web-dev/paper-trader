import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../lib/apiClient';
import { MarketQuote, Watchlist } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { Star, Plus, Trash2, ArrowUpRight } from 'lucide-react';

export const WatchlistsPage: React.FC = () => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchWatchlists = async () => {
    try {
      setLoading(true);
      const lists = await ApiClient.get<Watchlist[]>('/watchlists');
      setWatchlists(lists);

      const symbols = lists[0]?.symbols || ['AAPL', 'NVDA', 'RELIANCE.NS'];
      const qMap = await ApiClient.get<Record<string, MarketQuote>>(`/markets/quotes?symbols=${symbols.join(',')}`);
      setQuotes(qMap);
    } catch (err) {
      console.warn('Watchlists fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlists();
  }, []);

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const sym = newSymbol.trim().toUpperCase();
    const current = watchlists[0];
    if (!current) return;

    if (current.symbols.includes(sym)) {
      alert('Symbol is already in watchlist');
      return;
    }

    const updatedSymbols = [...current.symbols, sym];
    try {
      await ApiClient.put(`/watchlists/${current.id}`, { symbols: updatedSymbols });
      setNewSymbol('');
      fetchWatchlists();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveSymbol = async (symbolToRemove: string) => {
    const current = watchlists[0];
    if (!current) return;

    const updatedSymbols = current.symbols.filter(s => s !== symbolToRemove);
    try {
      await ApiClient.put(`/watchlists/${current.id}`, { symbols: updatedSymbols });
      fetchWatchlists();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentList = watchlists[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B222D]">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
              <Star className="w-5 h-5 fill-[#CCFF00]" />
            </span>
            <span>Market Watchlists</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pin preferred US equities, Indian stocks, forex, and crypto for quick tracking
          </p>
        </div>

        {/* Add Ticker Input */}
        <form onSubmit={handleAddSymbol} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add ticker (e.g. TSLA, INFY.NS)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="bg-[#10151C] border border-[#1B222D] rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00] uppercase font-mono"
          />
          <button
            type="submit"
            className="px-5 py-2 rounded-full bg-[#CCFF00] hover:bg-[#D4FF33] text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-[#CCFF00]/15"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {/* Watchlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentList?.symbols.map((sym) => {
          const q = quotes[sym];
          const isUp = (q?.changePercent ?? 0) >= 0;

          return (
            <div key={sym} className="p-6 rounded-3xl bg-[#0B0F14] border border-[#1B222D] hover:border-[#CCFF00]/40 transition-all space-y-4 relative group">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/instrument/${sym}`} className="font-extrabold text-lg text-white hover:text-[#CCFF00] transition-colors block">
                    {sym}
                  </Link>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">{q?.provider || 'Live'}</span>
                </div>

                <button
                  onClick={() => handleRemoveSymbol(sym)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Remove from Watchlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <span className="text-2xl font-black text-white">
                  {q ? formatCurrency(q.price, q.currency) : '—'}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                  isUp ? 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {q ? formatPercent(q.changePercent) : '0.00%'}
                </span>
              </div>

              <div className="pt-3 border-t border-[#1B222D] flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-bold">Session: {q?.marketStatus || 'OPEN'}</span>
                <Link
                  to={`/instrument/${sym}`}
                  className="text-xs font-bold text-[#CCFF00] hover:underline flex items-center gap-1"
                >
                  <span>Trade</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
