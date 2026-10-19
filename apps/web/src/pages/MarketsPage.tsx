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
  RefreshCw,
  ArrowUpRight
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
      (filterAsset === 'EQUITY_GLOBAL' && ['UK', 'EU', 'JP', 'AU'].includes(inst.country)) ||
      (filterAsset === 'INDEX' && inst.assetClass === 'INDEX') ||
      (filterAsset === 'CRYPTO' && inst.assetClass === 'CRYPTO');

    const matchesSearch = 
      search.trim() === '' ||
      inst.symbol.toLowerCase().includes(search.toLowerCase()) ||
      inst.name.toLowerCase().includes(search.toLowerCase());

    return matchesAsset && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B222D]">
        <div>
          <div className="flex items-center gap-2 text-[#CCFF00] font-bold text-xs tracking-wider uppercase mb-1">
            <Globe2 className="w-4 h-4" /> Global Discovery
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            International Financial Markets
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real market prices powered by Yahoo Finance, European Central Bank, and CoinGecko
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            fetchMarkets();
          }}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#10151C] text-slate-300 hover:text-white hover:bg-[#1B222D] transition-colors border border-[#1B222D] flex items-center gap-2 text-xs font-semibold"
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
            { id: 'ALL', label: 'All Venues' },
            { id: 'EQUITY_US', label: 'US Equities' },
            { id: 'EQUITY_IN', label: 'India (NSE)' },
            { id: 'EQUITY_GLOBAL', label: 'UK / EU / JP / AU' },
            { id: 'INDEX', label: 'Indices' },
            { id: 'CRYPTO', label: 'Crypto' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterAsset(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                filterAsset === cat.id
                  ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/15'
                  : 'bg-[#0B0F14] border border-[#1B222D] text-slate-300 hover:bg-[#10151C]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticker, company, exchange..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0F14] border border-[#1B222D] rounded-full pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#CCFF00]/60 focus:ring-1 focus:ring-[#CCFF00]/60 transition-all"
          />
        </div>
      </div>

      {/* Instruments Table */}
      <div className="rounded-3xl bg-[#0B0F14] border border-[#1B222D] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1B222D] bg-[#10151C]/60 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Instrument</th>
                <th className="py-3.5 px-4">Exchange / Region</th>
                <th className="py-3.5 px-4 text-right">Latest Price</th>
                <th className="py-3.5 px-4 text-right">24h Net Change</th>
                <th className="py-3.5 px-4 text-right">Session High / Low</th>
                <th className="py-3.5 px-4 text-right">Feed Source</th>
                <th className="py-3.5 px-4 text-center">Simulated Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B222D]/60">
              {filtered.map((inst) => {
                const quote = quotes[inst.symbol];
                const price = quote?.price ?? 0;
                const changePct = quote?.changePercent ?? 0;
                const isUp = changePct >= 0;

                return (
                  <tr key={inst.id} className="hover:bg-[#10151C]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link to={`/instrument/${inst.symbol}`} className="font-bold text-white hover:text-[#CCFF00] transition-colors block text-sm">
                        {inst.symbol}
                      </Link>
                      <span className="text-[11px] text-slate-400 block truncate max-w-xs">{inst.name}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#10151C] border border-[#1B222D] text-slate-200 font-mono text-[10px] font-bold">
                          {inst.exchange}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">{inst.country}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white text-sm">
                      {quote ? formatCurrency(price, quote.currency) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {quote ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs ${
                          isUp ? 'bg-[#CCFF00]/10 text-[#CCFF00]' : 'bg-red-500/10 text-red-400'
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
                      <span className="text-[10px] text-slate-400 uppercase font-medium bg-[#10151C] px-2 py-0.5 rounded border border-[#1B222D]">
                        {quote?.provider || 'YahooFinance'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Link
                        to={`/instrument/${inst.symbol}`}
                        className="px-4 py-1.5 rounded-full bg-[#10151C] hover:bg-[#CCFF00] text-slate-300 hover:text-black font-bold text-xs border border-[#1B222D] hover:border-[#CCFF00] transition-all inline-block shadow-sm"
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
