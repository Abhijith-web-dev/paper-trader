import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { LedgerEntry, Order } from '@globaltrade/shared';
import { formatCurrency, formatDate } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { 
  ListOrdered, 
  FileText, 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B222D]">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
              <ListOrdered className="w-5 h-5" />
            </span>
            <span>Simulated Orders & Immutable Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete transactional audit trail of all virtual order placements, fills, holds, and releases
          </p>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto px-4 py-2 rounded-full bg-[#10151C] text-slate-300 hover:text-[#CCFF00] hover:border-[#CCFF00] transition-all border border-[#1B222D] flex items-center gap-2 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#CCFF00]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-[#0B0F14] border border-[#1B222D] w-fit">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-extrabold transition-all ${
            activeTab === 'orders'
              ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/10'
              : 'text-slate-400 hover:text-white hover:bg-[#10151C]'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Orders ({orders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-extrabold transition-all ${
            activeTab === 'ledger'
              ? 'bg-[#CCFF00] text-black shadow-md shadow-[#CCFF00]/10'
              : 'text-slate-400 hover:text-white hover:bg-[#10151C]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Ledger ({ledger.length})</span>
        </button>
      </div>

      {/* Tab Content: Orders */}
      {activeTab === 'orders' ? (
        <div className="rounded-3xl bg-[#0B0F14] border border-[#1B222D] overflow-hidden p-6 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1B222D] bg-[#10151C]/60 text-slate-400">
                  <th className="py-3.5 px-4 font-bold rounded-l-xl">Order ID</th>
                  <th className="py-3.5 px-4 font-bold">Instrument</th>
                  <th className="py-3.5 px-4 font-bold">Side & Type</th>
                  <th className="py-3.5 px-4 font-bold text-right">Quantity</th>
                  <th className="py-3.5 px-4 font-bold text-right">Fill / Limit Price</th>
                  <th className="py-3.5 px-4 font-bold text-right">Fees</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Placed At</th>
                  <th className="py-3.5 px-4 font-bold text-center rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B222D]/60 font-mono">
                {orders.length > 0 ? (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#10151C]/40 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                        {o.id}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-white font-sans text-sm">
                        {o.symbol}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] mr-1.5 ${
                          o.side === 'BUY' ? 'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {o.side}
                        </span>
                        <span className="text-slate-400 text-[11px] font-bold">{o.type}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-white">
                        {o.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-200">
                        {o.avgFillPrice ? formatCurrency(o.avgFillPrice) : (o.limitPrice ? formatCurrency(o.limitPrice) : 'MARKET')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400">
                        {formatCurrency(o.fees || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                          o.status === 'FILLED' ? 'bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/25' :
                          o.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                          'bg-[#10151C] text-slate-400 border border-[#1B222D]'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {formatDate(o.placedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans">
                        {o.status === 'PENDING' ? (
                          <button
                            onClick={() => handleCancelOrder(o.id)}
                            className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors text-[11px] font-bold border border-red-500/20"
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
                    <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
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
        <div className="rounded-3xl bg-[#0B0F14] border border-[#1B222D] overflow-hidden p-6 space-y-4">
          <div className="p-4 bg-[#10151C] border border-[#1B222D] rounded-2xl text-xs text-slate-300">
            <strong className="text-[#CCFF00]">Append-Only Transaction Ledger:</strong> Every cash adjustment, reservation, buy fill, sell fill, and fee deduction is recorded permanently with an idempotency key.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1B222D] bg-[#10151C]/60 text-slate-400">
                  <th className="py-3.5 px-4 font-bold rounded-l-xl">Ledger ID</th>
                  <th className="py-3.5 px-4 font-bold">Transaction Type</th>
                  <th className="py-3.5 px-4 font-bold">Description</th>
                  <th className="py-3.5 px-4 font-bold text-right">Cash Flow</th>
                  <th className="py-3.5 px-4 font-bold text-right">Balance After</th>
                  <th className="py-3.5 px-4 font-bold text-right rounded-r-xl">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B222D]/60 font-mono">
                {ledger.length > 0 ? (
                  ledger.map((entry) => {
                    const isPositive = entry.amount >= 0;
                    return (
                      <tr key={entry.id} className="hover:bg-[#10151C]/40 transition-colors">
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {entry.id}
                        </td>
                        <td className="py-3.5 px-4 font-sans font-extrabold text-white text-[11px]">
                          {entry.type}
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-300 text-xs">
                          {entry.description}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-black ${isPositive ? 'text-[#CCFF00]' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(entry.amount, account?.baseCurrency)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-white font-extrabold">
                          {formatCurrency(entry.balanceAfter, account?.baseCurrency)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                          {formatDate(entry.timestamp)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
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
