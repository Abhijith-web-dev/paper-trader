import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { PriceAlert } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { Bell } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [symbol, setSymbol] = useState('AAPL');
  const [targetPrice, setTargetPrice] = useState<number>(200);
  const [condition, setCondition] = useState<PriceAlert['condition']>('ABOVE');
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const list = await ApiClient.get<PriceAlert[]>('/alerts');
      setAlerts(list);
    } catch (err) {
      console.warn('Alerts fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/alerts', {
        symbol: symbol.toUpperCase(),
        targetPrice: Number(targetPrice),
        condition
      });
      fetchAlerts();
    } catch (err: any) {
      alert(`Failed to create alert: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1B222D]">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
            <Bell className="w-5 h-5" />
          </span>
          <span>Real-Time Price Alerts</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Set deterministic threshold triggers evaluated by the shared market data stream
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Alert Form (1 Col) */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-5 h-fit">
          <h2 className="font-extrabold text-base text-white">Create Price Alert</h2>

          <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">Instrument Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono uppercase font-bold focus:outline-none focus:border-[#CCFF00]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-medium focus:outline-none focus:border-[#CCFF00]"
              >
                <option value="ABOVE">Price Rises Above (&gt;=)</option>
                <option value="BELOW">Price Drops Below (&lt;=)</option>
                <option value="PERCENT_CHANGE">24h Percentage Movement (&gt;=)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">Target Value</label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl px-4 py-3 text-white font-mono font-bold focus:outline-none focus:border-[#CCFF00]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-[#CCFF00] hover:bg-[#D4FF33] text-black font-extrabold text-xs transition-all shadow-lg shadow-[#CCFF00]/15"
            >
              Set Price Alert
            </button>
          </form>
        </div>

        {/* Existing Alerts (2 Cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-[#0B0F14] border border-[#1B222D] overflow-hidden p-6 space-y-4">
          <div className="font-extrabold text-base text-white pb-3 border-b border-[#1B222D]">
            Configured Alerts ({alerts.length})
          </div>

          <div className="divide-y divide-[#1B222D]/60 font-mono text-xs">
            {alerts.length > 0 ? (
              alerts.map((alt) => (
                <div key={alt.id} className="py-4 flex items-center justify-between hover:bg-[#10151C]/40 transition-colors px-2 rounded-xl">
                  <div className="space-y-1">
                    <span className="font-extrabold text-white text-base font-sans">{alt.symbol}</span>
                    <p className="text-slate-400 font-sans text-xs">
                      Notify when price is <span className="text-[#CCFF00] font-bold font-mono">{alt.condition}</span> {formatCurrency(alt.targetPrice)}
                    </p>
                    <span className="text-[10px] text-slate-500">Created {formatDate(alt.createdAt)}</span>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold font-sans ${
                    alt.status === 'ACTIVE'
                      ? 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/25'
                      : 'bg-[#10151C] text-slate-400 border border-[#1B222D]'
                  }`}>
                    {alt.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 font-sans">
                No active price alerts. Use the form on the left to set a notification.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
