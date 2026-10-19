import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { CurrencyRate } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { 
  ArrowLeftRight, 
  Repeat, 
  Clock, 
  ShieldCheck, 
  HelpCircle,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-emerald-400" />
            <span>Global Currency Converter</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            European Central Bank reference rates with simulated spread modeling
          </p>
        </div>

        <button
          onClick={fetchRates}
          className="self-start sm:self-auto p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 transition-colors border border-slate-700 flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Rates</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Converter Card (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-navy-900 border border-slate-800 shadow-xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            {/* From Input */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">You Convert</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2.5 text-white font-mono font-bold text-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none"
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
                className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-emerald-500 hover:text-navy-950 transition-all border border-slate-700 shadow-lg"
                title="Swap Currencies"
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* To Result */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Estimated Conversion</label>
              <div className="w-full bg-slate-850/60 border border-slate-750 rounded-xl px-3 py-2.5 text-emerald-400 font-mono font-bold text-lg truncate">
                {convertedResult.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </div>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none"
              >
                {POPULAR_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rate Summary Strip */}
          <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400">Indicative Market Exchange Rate</span>
              <p className="font-mono text-base font-bold text-white mt-0.5">
                1 {fromCurrency} = {rawRate.toFixed(4)} {toCurrency}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={includeSpread}
                  onChange={(e) => setIncludeSpread(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs">Simulate 0.2% Educational Spread</span>
              </label>
            </div>
          </div>

          {/* 30-Day Historical Rate Trend Table */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>30-Day Historical Trend ({fromCurrency} / {toCurrency})</span>
            </h3>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-850 text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold text-right">ECB Reference Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {historicalRates.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-850/40">
                      <td className="py-2 px-3 text-slate-300">{row.date}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-100">{row.rate.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Regulatory & Educational Sidebar (1 col) */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Forex Educational Notice</span>
          </div>

          <h3 className="font-bold text-sm text-white">Indicative Rates Only</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All foreign exchange conversion rates displayed on this platform are for educational and simulation purposes derived from the European Central Bank.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            These figures do not represent guaranteed bank transfer quotes, retail remittance offers, or executable order book bid-asks.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-750 text-[11px] text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Source:</span>
              <span className="font-semibold text-white">Frankfurter / ECB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cache TTL:</span>
              <span className="font-semibold text-emerald-400">60 Seconds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Precision:</span>
              <span className="font-semibold text-white">4 Decimal Places</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
