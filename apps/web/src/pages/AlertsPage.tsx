import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { PriceAlert } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { Bell, Plus, CheckCircle2, Clock } from 'lucide-react';

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
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-emerald-400" />
          <span>Real-Time Price Alerts</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Set deterministic threshold triggers evaluated by the shared market data stream
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Alert Form (1 Col) */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 shadow-xl space-y-4 h-fit">
          <h2 className="font-bold text-sm text-white">Create Price Alert</h2>

          <form onSubmit={handleCreateAlert} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400">Instrument Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono uppercase font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="ABOVE">Price Rises Above (&gt;=)</option>
                <option value="BELOW">Price Drops Below (&lt;=)</option>
                <option value="PERCENT_CHANGE">24h Percentage Movement (&gt;=)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Target Value</label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Set Price Alert
            </button>
          </form>
        </div>

        {/* Existing Alerts (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-navy-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-850/50 border-b border-slate-800 font-bold text-sm text-white">
            Configured Alerts ({alerts.length})
          </div>

          <div className="divide-y divide-slate-800/60 font-mono text-xs">
            {alerts.length > 0 ? (
              alerts.map((alt) => (
                <div key={alt.id} className="p-4 flex items-center justify-between hover:bg-slate-850/30">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-sm font-sans">{alt.symbol}</span>
                    <p className="text-slate-400 font-sans text-xs">
                      Notify when price is <span className="text-emerald-400 font-bold font-mono">{alt.condition}</span> {formatCurrency(alt.targetPrice)}
                    </p>
                    <span className="text-[10px] text-slate-500">Created {formatDate(alt.createdAt)}</span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold font-sans ${
                    alt.status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {alt.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-slate-500 font-sans">
                No active price alerts. Use the form on the left to set a notification.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
