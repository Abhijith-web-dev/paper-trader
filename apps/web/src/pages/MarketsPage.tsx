import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiClient } from '../lib/apiClient';
import { Instrument, MarketQuote } from '@globaltrade/shared';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { 
  Globe2, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const MarketsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [filterAsset, setFilterAsset] = useState<string>('ALL');
  const [search, setSearch] = useState<string>(initialSearch);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMarkets = async () => {
    try {
      const instList = await ApiClient.get<Instrument[]>('/markets/instruments');
      setInstruments(instList);

      const syms = instList.map(i => i.symbol).join(',');
      const quoteMap = await ApiClient.get<Record<string, MarketQuote>>(`/markets/quotes?symbols=${syms}`);
      setQuotes(quoteMap);
    } catch (err) {
      console.warn('Markets fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  const filtered = instruments.filter((inst) => {
    const matchesAsset = 
      filterAsset === 'ALL' ||
      (filterAsset === 'EQUITY_US' && inst.country === 'US' && inst.assetClass === 'EQUITY') ||
      (filterAsset === 'EQUITY_IN' && inst.country === 'IN') ||
      (filterAsset === 'INDEX' && inst.assetClass === 'INDEX') ||
      (filterAsset === 'CRYPTO' && inst.assetClass === 'CRYPTO');

    const matchesSearch = 
      search.trim() === '' ||
      inst.symbol.toLowerCase().includes(search.toLowerCase()) ||
      inst.name.toLowerCase().includes(search.toLowerCase());

    return matchesAsset && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-emerald-400" />
            <span>International Financial Markets</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real market prices powered by Yahoo Finance & CoinGecko APIs
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            fetchMarkets();
          }}
          className="self-start sm:self-auto p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 transition-colors border border-slate-700 flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Instruments' },
            { id: 'EQUITY_US', label: 'US Equities (NASDAQ/NYSE)' },
            { id: 'EQUITY_IN', label: 'India (NSE/BSE)' },
            { id: 'INDEX', label: 'Global Indices' },
            { id: 'CRYPTO', label: 'Cryptocurrencies' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterAsset(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterAsset === cat.id
                  ? 'bg-emerald-500 text-navy-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-navy-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticker or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-navy-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Instruments Table */}
      <div className="rounded-2xl bg-navy-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-850/50 text-slate-400">
                <th className="py-3.5 px-4 font-semibold">Instrument</th>
                <th className="py-3.5 px-4 font-semibold">Exchange</th>
                <th className="py-3.5 px-4 font-semibold text-right">Latest Price</th>
                <th className="py-3.5 px-4 font-semibold text-right">24h Change</th>
                <th className="py-3.5 px-4 font-semibold text-right">Session High / Low</th>
                <th className="py-3.5 px-4 font-semibold text-right">Provider</th>
                <th className="py-3.5 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((inst) => {
                const quote = quotes[inst.symbol];
                const price = quote?.price ?? 0;
                const changePct = quote?.changePercent ?? 0;
                const isUp = changePct >= 0;

                return (
                  <tr key={inst.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link to={`/instrument/${inst.symbol}`} className="font-bold text-white hover:text-emerald-400 transition-colors block text-sm">
                        {inst.symbol}
                      </Link>
                      <span className="text-[11px] text-slate-400 block">{inst.name}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-semibold">
                        {inst.exchange}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 text-sm">
                      {quote ? formatCurrency(price, quote.currency) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {quote ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {formatPercent(changePct)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-400">
                      {quote ? (
                        <span>{formatCurrency(quote.high, quote.currency)} / {formatCurrency(quote.low, quote.currency)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-medium">
                        {quote?.provider || 'YahooFinance'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        to={`/instrument/${inst.symbol}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-navy-950 font-bold hover:bg-emerald-400 transition-all text-xs inline-block shadow-md shadow-emerald-500/20"
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
