import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { ShieldCheck, Cpu, Database, Cloud, Activity, CheckCircle2 } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<any>('/admin/telemetry')
      .then(setTelemetry)
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <span>System Architecture & Operational Telemetry</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time service health, market provider adapters, and resource metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Market Providers Card */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Market Data Pipeline</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Equity & Indices:</span>
              <span className="font-semibold text-white">Yahoo Finance</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Foreign Exchange:</span>
              <span className="font-semibold text-white">Frankfurter (ECB)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Crypto Spot:</span>
              <span className="font-semibold text-white">CoinGecko API</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Quote Cache TTL:</span>
              <span className="font-mono text-emerald-400 font-bold">5 Seconds</span>
            </div>
          </div>
        </div>

        {/* Database & Identity Card */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Identity & Transaction Store</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Identity Provider:</span>
              <span className="font-semibold text-white">Firebase Auth</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Primary Database:</span>
              <span className="font-semibold text-white">Firebase Firestore</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Execution Model:</span>
              <span className="font-semibold text-emerald-400 font-mono">Atomic runTransaction</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Mode:</span>
              <span className="font-mono text-white">{telemetry?.database?.mode || 'development'}</span>
            </div>
          </div>
        </div>

        {/* Supabase Storage Card */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Cloud className="w-4 h-4" />
            <span>Object Storage</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Provider:</span>
              <span className="font-semibold text-white">Supabase Storage</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Avatars Bucket:</span>
              <span className="text-emerald-400 font-bold">Enabled</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Receipts Bucket:</span>
              <span className="text-emerald-400 font-bold">Enabled</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Memory Footprint:</span>
              <span className="font-mono text-white">{telemetry?.memoryUsageMB || 45} MB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
