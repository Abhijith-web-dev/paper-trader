import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/formatters';
import { 
  TrendingUp, 
  Search, 
  Bell, 
  Wallet, 
  User, 
  LogOut, 
  ShieldAlert,
  ChevronDown
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, account, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/markets?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-md border-b border-slate-800 h-16 flex items-center justify-between px-4 lg:px-6">
      {/* Brand & Market Status */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-fintech-green to-emerald-400 flex items-center justify-center text-navy-950 font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-5 h-5 text-navy-950 stroke-[2.5]" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              GlobalTrade
            </span>
            <span className="text-[10px] uppercase tracking-wider block font-semibold text-emerald-400">
              SIMULATOR
            </span>
          </div>
        </Link>

        {/* Global Market Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-850/80 border border-slate-750 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>US & Global Feeds Live</span>
          <span className="text-slate-500 text-[10px]">• 0-Sec Delay</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search stocks (AAPL, RELIANCE.NS), forex, crypto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-navy-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
          />
        </div>
      </form>

      {/* Virtual Account Balance & User Profile */}
      <div className="flex items-center gap-3">
        {account && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-750">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-medium leading-none">Virtual Cash</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {formatCurrency(account.availableCash, account.baseCurrency)}
              </span>
            </div>
          </div>
        )}

        <Link
          to="/alerts"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors relative"
          title="Price Alerts"
        >
          <Bell className="w-5 h-5" />
          <span className="w-2 h-2 bg-fintech-blue rounded-full absolute top-1.5 right-1.5"></span>
        </Link>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
                {user.displayName.substring(0, 2).toUpperCase()}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-navy-900 border border-slate-800 shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    to="/portfolio"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" /> Portfolio & Holdings
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <User className="w-4 h-4 text-blue-400" /> Account Settings
                  </Link>
                  <Link
                    to="/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-400" /> System Telemetry
                  </Link>
                </div>
                <div className="pt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl bg-emerald-500 text-navy-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
};
