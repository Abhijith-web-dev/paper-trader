import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../lib/apiClient';
import { uploadUserAvatar } from '../lib/supabaseClient';
import { Settings, User, Wallet, Globe, Shield, CheckCircle2, Upload } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, preferences, refreshAccount } = useAuth();
  const [baseCurrency, setBaseCurrency] = useState(preferences?.baseCurrency || 'USD');
  const [experienceLevel, setExperienceLevel] = useState(preferences?.experienceLevel || 'BEGINNER');
  const [timezone, setTimezone] = useState(preferences?.timezone || 'America/New_York');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.photoURL || null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const publicUrl = await uploadUserAvatar(user.id, file);
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      alert(`Avatar upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/auth/preferences', {
        baseCurrency,
        experienceLevel,
        timezone,
        theme: 'dark'
      });
      await refreshAccount();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          <span>Account & Trading Preferences</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Customize base valuation currency, Supabase storage avatars, and risk configuration
        </p>
      </div>

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Preferences updated successfully!</span>
        </div>
      )}

      {/* Avatar & Profile Card (Supabase Storage integration) */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 shadow-xl space-y-4">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400" />
          <span>Profile & Avatar (Stored via Supabase Storage)</span>
        </h2>

        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-center overflow-hidden relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-xl text-emerald-400">
                {user?.displayName.substring(0, 2).toUpperCase() || 'TR'}
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold border border-slate-700 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload Image to Supabase'}</span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
            <p className="text-[11px] text-slate-400">PNG, JPG or SVG up to 2MB stored in Supabase 'avatars' bucket.</p>
          </div>
        </div>
      </div>

      {/* Trading Preferences Form */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 shadow-xl space-y-4">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>Trading & Portfolio Currency</span>
        </h2>

        <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-400 font-medium">Reporting Base Currency</label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="USD">USD ($) - US Dollar</option>
              <option value="INR">INR (₹) - Indian Rupee</option>
              <option value="EUR">EUR (€) - Euro</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-medium">Trading Experience Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as any)}
              className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="BEGINNER">Beginner (Guided tooltips & simulated risk warnings)</option>
              <option value="INTERMEDIATE">Intermediate (Standard order book & indicators)</option>
              <option value="ADVANCED">Advanced (Quantitative backtesting & custom strategies)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 font-medium">Market Timezone Display</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="America/New_York">Eastern Time (NYSE / NASDAQ)</option>
              <option value="Asia/Kolkata">IST (NSE / BSE India)</option>
              <option value="Europe/London">GMT / London</option>
              <option value="UTC">UTC (Universal Coordinated Time)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Save Preferences
          </button>
        </form>
      </div>
    </div>
  );
};
