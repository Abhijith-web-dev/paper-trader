import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { CurrencyRate } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { 
  ArrowLeftRight, 
  Repeat, 
  ShieldCheck, 
  TrendingUp,
  RefreshCw
} from 'lucide-react';

const POPULAR_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }
];

export const ForexPage: React.FC = () => {
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('INR');
  const [amount, setAmount] = useState<number>(1000);
  const [includeSpread, setIncludeSpread] = useState<boolean>(true);

  const [rateData, setRateData] = useState<CurrencyRate | null>(null);
  const [historicalRates, setHistoricalRates] = useState<{ date: string; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const [rate, history] = await Promise.all([
        ApiClient.get<CurrencyRate>(`/forex/rate?base=${fromCurrency}&quote=${toCurrency}`),
        ApiClient.get<{ date: string; rate: number }[]>(`/forex/history?base=${fromCurrency}&quote=${toCurrency}&days=30`)
      ]);
      setRateData(rate);
      setHistoricalRates(history);
    } catch (err) {
      console.warn('Forex fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [fromCurrency, toCurrency]);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const rawRate = rateData?.rate ?? 1.0;
  const effectiveRate = includeSpread ? rawRate * 0.998 : rawRate;
  const convertedResult = amount * effectiveRate;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B222D]">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
              <ArrowLeftRight className="w-5 h-5" />
            </span>
            <span>Global Currency Converter</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            European Central Bank reference rates with simulated spread modeling
          </p>
        </div>

        <button
          onClick={fetchRates}
          className="self-start sm:self-auto px-4 py-2.5 rounded-full bg-[#10151C] text-slate-300 hover:text-[#CCFF00] hover:border-[#CCFF00] transition-all border border-[#1B222D] flex items-center gap-2 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#CCFF00]' : ''}`} />
          <span>Refresh Rates</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Converter Card (2 cols) */}
        <div className="lg:col-span-2 p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            {/* From Input */}
            <div className="sm:col-span-2 space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">You Convert</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-black text-xl focus:outline-none focus:border-[#CCFF00]"
                />
              </div>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#CCFF00]"
              >
                {POPULAR_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="sm:col-span-1 flex justify-center py-2 sm:py-0">
              <button
                onClick={handleSwap}
                className="p-3.5 rounded-full bg-[#10151C] text-slate-300 hover:text-black hover:bg-[#CCFF00] transition-all border border-[#1B222D] shadow-lg"
                title="Swap Currencies"
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* To Result */}
            <div className="sm:col-span-2 space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Estimated Conversion</label>
              <div className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-[#CCFF00] font-mono font-black text-xl truncate">
                {convertedResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </div>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#CCFF00]"
              >
                {POPULAR_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rate Summary Strip */}
          <div className="p-5 rounded-2xl bg-[#10151C] border border-[#1B222D] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Indicative Market Rate</span>
              <p className="font-mono text-lg font-black text-white mt-0.5">
                1 {fromCurrency} = {rawRate.toFixed(4)} {toCurrency}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={includeSpread}
                  onChange={(e) => setIncludeSpread(e.target.checked)}
                  className="rounded bg-[#0B0F14] border-[#1B222D] text-[#CCFF00] focus:ring-[#CCFF00]"
                />
                <span className="text-xs font-semibold">Simulate 0.2% Educational Spread</span>
              </label>
            </div>
          </div>

          {/* 30-Day Historical Rate Trend Table */}
          <div className="space-y-3 pt-2">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#CCFF00]" />
              <span>30-Day Historical Trend ({fromCurrency} / {toCurrency})</span>
            </h3>

            <div className="max-h-56 overflow-y-auto rounded-2xl border border-[#1B222D]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1B222D] bg-[#10151C]/60 text-slate-400 font-bold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">ECB Reference Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B222D]/60 font-mono">
                  {historicalRates.map((row) => (
                    <tr key={row.date} className="hover:bg-[#10151C]/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-300">{row.date}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-white">{row.rate.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Regulatory & Educational Sidebar (1 col) */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-4 h-fit">
          <div className="flex items-center gap-2 text-[#CCFF00] font-extrabold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Forex Educational Notice</span>
          </div>

          <h3 className="font-extrabold text-base text-white">Indicative Rates Only</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All foreign exchange conversion rates displayed on this platform are for educational and simulation purposes derived from the European Central Bank.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            These figures do not represent guaranteed bank transfer quotes, retail remittance offers, or executable order book bid-asks.
          </p>

          <div className="p-4 rounded-2xl bg-[#10151C] border border-[#1B222D] text-[11px] text-slate-300 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Source:</span>
              <span className="font-bold text-white">Frankfurter / ECB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cache TTL:</span>
              <span className="font-bold text-[#CCFF00]">60 Seconds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Precision:</span>
              <span className="font-bold text-white font-mono">4 Decimal Places</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
