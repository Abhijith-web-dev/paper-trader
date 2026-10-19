import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { ShieldCheck, Database, Cloud, Activity } from 'lucide-react';

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
      <div className="pb-4 border-b border-[#1B222D]">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="w-9 h-9 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00]">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <span>System Architecture & Operational Telemetry</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time service health, market provider adapters, and resource metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Market Providers Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#CCFF00] uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Market Data Pipeline</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Equity & Indices:</span>
              <span className="font-bold text-white">Yahoo Finance</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Foreign Exchange:</span>
              <span className="font-bold text-white">Frankfurter (ECB)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Crypto Spot:</span>
              <span className="font-bold text-white">CoinGecko API</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Quote Cache TTL:</span>
              <span className="font-mono text-[#CCFF00] font-black">5 Seconds</span>
            </div>
          </div>
        </div>

        {/* Database & Identity Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-400 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Identity & Transaction Store</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Identity Provider:</span>
              <span className="font-bold text-white">Firebase Auth</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Primary Database:</span>
              <span className="font-bold text-white">Firebase Firestore</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Execution Model:</span>
              <span className="font-bold text-[#CCFF00] font-mono">Atomic runTransaction</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Mode:</span>
              <span className="font-mono text-white font-bold">{telemetry?.database?.mode || 'development'}</span>
            </div>
          </div>
        </div>

        {/* Supabase Storage Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#0B0F14] border border-[#1B222D] space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#CCFF00] uppercase tracking-wider">
            <Cloud className="w-4 h-4" />
            <span>Object Storage</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Provider:</span>
              <span className="font-bold text-white">Supabase Storage</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Avatars Bucket:</span>
              <span className="text-[#CCFF00] font-black">Enabled</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1B222D]">
              <span className="text-slate-400">Receipts Bucket:</span>
              <span className="text-[#CCFF00] font-black">Enabled</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Memory Footprint:</span>
              <span className="font-mono text-white font-bold">{telemetry?.memoryUsageMB || 45} MB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
