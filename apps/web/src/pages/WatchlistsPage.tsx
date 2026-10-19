import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../lib/apiClient';
import { MarketQuote, Watchlist } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { Star, Plus, Trash2, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
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
            className="bg-navy-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1 shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
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
            <div key={sym} className="p-4 rounded-2xl bg-navy-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-lg relative group">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/instrument/${sym}`} className="font-bold text-base text-white hover:text-emerald-400 transition-colors block">
                    {sym}
                  </Link>
                  <span className="text-[11px] text-slate-400 uppercase font-medium">{q?.provider || 'Live'}</span>
                </div>

                <button
                  onClick={() => handleRemoveSymbol(sym)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Remove from Watchlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xl font-extrabold text-white">
                  {q ? formatCurrency(q.price, q.currency) : '—'}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                  isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {q ? formatPercent(q.changePercent) : '0.00%'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">Session: {q?.marketStatus || 'OPEN'}</span>
                <Link
                  to={`/instrument/${sym}`}
                  className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Trade</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
