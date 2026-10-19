import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { LedgerEntry, Order } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { 
  ListOrdered, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { account, refreshAccount } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'ledger'>('orders');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordList, ledList] = await Promise.all([
        ApiClient.get<Order[]>('/orders'),
        ApiClient.get<LedgerEntry[]>('/portfolio/ledger')
      ]);
      setOrders(ordList);
      setLedger(ledList);
    } catch (err) {
      console.warn('Orders/Ledger fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Cancel this pending order?')) return;
    try {
      await ApiClient.post(`/orders/${orderId}/cancel`);
      await refreshAccount();
      await fetchData();
    } catch (err: any) {
      alert(`Failed to cancel order: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-emerald-400" />
            <span>Simulated Orders & Immutable Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete transactional audit trail of all virtual order placements, fills, holds, and releases
          </p>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 transition-colors border border-slate-700 flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-navy-900 border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'orders'
              ? 'bg-emerald-500 text-navy-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Orders ({orders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'ledger'
              ? 'bg-emerald-500 text-navy-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Ledger ({ledger.length})</span>
        </button>
      </div>

      {/* Tab Content: Orders */}
      {activeTab === 'orders' ? (
        <div className="rounded-2xl bg-navy-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850/50 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Order ID</th>
                  <th className="py-3 px-4 font-semibold">Instrument</th>
                  <th className="py-3 px-4 font-semibold">Side & Type</th>
                  <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                  <th className="py-3 px-4 font-semibold text-right">Fill / Limit Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Fees</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Placed At</th>
                  <th className="py-3 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {orders.length > 0 ? (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-850/30">
                      <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                        {o.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-white font-sans text-sm">
                        {o.symbol}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] mr-1.5 ${
                          o.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {o.side}
                        </span>
                        <span className="text-slate-400 text-[11px] font-medium">{o.type}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {o.quantity}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        {o.avgFillPrice ? formatCurrency(o.avgFillPrice) : (o.limitPrice ? formatCurrency(o.limitPrice) : 'MARKET')}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {formatCurrency(o.fees || 0)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          o.status === 'FILLED' ? 'bg-emerald-500/15 text-emerald-400' :
                          o.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                        {formatDate(o.placedAt)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {o.status === 'PENDING' ? (
                          <button
                            onClick={() => handleCancelOrder(o.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors text-[11px] font-semibold"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                      No orders placed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab Content: Double-Entry Ledger */
        <div className="rounded-2xl bg-navy-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-850/40 border-b border-slate-800 text-xs text-slate-300">
            <strong>Append-Only Transaction Ledger:</strong> Every cash adjustment, reservation, buy fill, sell fill, and fee deduction is recorded permanently with an idempotency key.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850/50 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Ledger ID</th>
                  <th className="py-3 px-4 font-semibold">Transaction Type</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold text-right">Cash Flow</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance After</th>
                  <th className="py-3 px-4 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledger.length > 0 ? (
                  ledger.map((entry) => {
                    const isPositive = entry.amount >= 0;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-850/30">
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {entry.id}
                        </td>
                        <td className="py-3 px-4 font-sans font-bold text-white text-[11px]">
                          {entry.type}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300 text-xs">
                          {entry.description}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(entry.amount, account?.baseCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-100 font-bold">
                          {formatCurrency(entry.balanceAfter, account?.baseCurrency)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                          {formatDate(entry.timestamp)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 font-sans">
                      No ledger records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
