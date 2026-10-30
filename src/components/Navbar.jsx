import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTradingTools } from '../context/TradingToolsContext';
import { triggerSelectiveToolAd } from '../config/adsterra';
import MarketStatusBadge from './MarketStatusBadge';
import { 
  Compass, 
  Wallet, 
  Globe2, 
  LogOut, 
  LogIn, 
  UserPlus, 
  LayoutDashboard,
  Building2, 
  TrendingUp, 
  Clock,
  RefreshCw,
  Cloud,
  Check,
  AlertCircle,
  Menu,
  X,
  Terminal,
  Filter,
  BarChart2,
  BookOpen,
  Lock,
  Bell,
  Calculator,
  History
} from 'lucide-react';

export default function Navbar() {
  const { 
    currentUser, 
    userProfile, 
    geoData, 
    logout, 
    firebaseActive,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    syncToCloud 
  } = useAuth();
  const {
    openPalette,
    openScreener,
    openBacktester,
    openJournal,
    openRiskCalculator,
    openAlerts,
    openVault
  } = useTradingTools();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on page transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSyncClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback('');
    try {
      const res = await syncToCloud();
      if (res?.success) {
        setSyncFeedback('Synced to Firebase Cloud!');
      } else {
        setSyncFeedback(res?.message || 'Saved locally in browser.');
      }
    } catch (e) {
      setSyncFeedback('Stored locally in browser.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(''), 4000);
    }
  };

  const inrBalance = userProfile?.wallets?.inr?.cashBalance ?? 1000000;
  const usdBalance = userProfile?.wallets?.usd?.cashBalance ?? 100000;

  return (
    <header className="bg-[#F6F4EE] select-none sticky top-0 z-40 border-b-2 border-[#111111]">
      {/* Top Gazette Dateline Bar - Desktop/Tablet Only (Hidden on mobile to eliminate clutter) */}
      <div className="hidden sm:flex border-b border-[#111111] px-4 py-1.5 text-[11px] text-[#111111] justify-between items-center max-w-7xl mx-auto font-mono">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-widest uppercase">PAPER TRADING</span>
          <span className="text-stone-400">|</span>
          <span className="flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-[#111111]" />
            {currentDate}
          </span>
          <span className="text-stone-400 hidden md:inline">|</span>
          <div className="hidden md:flex items-center gap-2">
            <MarketStatusBadge market="NSE" size="sm" showTime={false} />
            <MarketStatusBadge market="US" size="sm" showTime={false} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Location & Auto-Currency Badge */}
          {geoData && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-[#EFECE3] border border-[#111111] text-[#111111]">
              <Globe2 className="w-3 h-3 text-emerald-800" />
              <span>
                {geoData.countryName} ({geoData.countryCode}) • <strong>{geoData.currency} ({geoData.symbol})</strong>
              </span>
            </div>
          )}

          {/* Local-First Storage & Cloud Sync Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 border border-[#111111] bg-white">
            <span className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-600' : pendingSyncCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-stone-500'}`} />
            <span className="text-[11px] text-[#111111] font-mono font-semibold">
              {syncStatus === 'synced' 
                ? 'Cloud Synced' 
                : pendingSyncCount > 0 
                  ? `Local (${pendingSyncCount} pending)` 
                  : 'Local Storage'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Masthead Header (Row 1: Brand & Key Account Actions) */}
      <div className="border-b-2 border-[#111111] bg-[#F6F4EE]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left / Brand Masthead */}
          <Link to={currentUser ? "/dashboard" : "/"} className="flex items-center gap-1.5 sm:gap-3 group shrink min-w-0">
            <img
              src="/logo.png"
              alt="Paper Trading Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0 border border-[#111111] bg-white p-0.5 shadow-xs group-hover:opacity-90 transition-opacity"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-serif font-black text-base sm:text-2xl tracking-tight text-[#111111] uppercase leading-none truncate block">
                  PAPER TRADING
                </span>
                <span className="hidden md:inline-block text-[9px] font-mono px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase tracking-wider shrink-0">
                  VIRTUAL
                </span>
              </div>
              <p className="hidden md:block text-[10px] text-[#111111]/70 font-mono tracking-wider mt-0.5 uppercase">
                NSE / BSE • NASDAQ / NYSE • ZERO RISK CAPITAL
              </p>
            </div>
          </Link>

          {/* Right Action Area */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* Terminal Command Button - Compact square on mobile, full on tablet/desktop */}
            <button
              type="button"
              onClick={openPalette}
              className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-[#111111] text-[#F6F4EE] border border-[#111111] hover:bg-neutral-800 text-xs font-mono font-bold transition-all shadow-xs cursor-pointer min-h-[34px] sm:min-h-[38px] min-w-[34px] sm:min-w-auto"
              title="Summon Natural Trading Command Terminal (Press / or Ctrl+K)"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Terminal</span>
              <kbd className="hidden md:inline-block px-1 py-0.2 bg-neutral-800 border border-neutral-600 text-[9px] text-neutral-300">
                /
              </kbd>
            </button>

            {currentUser ? (
              <>
                {/* Cash Balances */}
                <Link
                  to="/dashboard"
                  title="View your portfolio and cash ledger"
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#EFECE3] font-mono text-xs transition-colors min-h-[38px]"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#111111]" />
                  <span className="text-[#111111]/60">Cash:</span>
                  <span className="font-bold text-emerald-900">₹{inrBalance.toLocaleString('en-IN')}</span>
                  <span className="text-stone-300">/</span>
                  <span className="font-bold text-sky-900">${usdBalance.toLocaleString('en-US')}</span>
                </Link>

                {/* User Profile Chip */}
                <Link to="/dashboard" className="hidden sm:flex items-center gap-2 group min-h-[38px]" title="Account Profile">
                  <div className="w-8 h-8 bg-[#111111] text-[#F6F4EE] flex items-center justify-center text-xs font-serif font-bold group-hover:scale-105 transition-transform border border-[#111111]">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'T'}
                  </div>
                  <div className="text-left hidden lg:block">
                    <div className="text-xs font-bold text-[#111111] truncate max-w-[120px]">
                      {currentUser.displayName || currentUser.email.split('@')[0]}
                    </div>
                    <div className="text-[10px] text-stone-500 font-mono">
                      {userProfile?.profile?.tradingStyle || 'Paper Trader'}
                    </div>
                  </div>
                </Link>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out of Paper Trading"
                  className="hidden sm:flex p-2 border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] transition-all cursor-pointer items-center justify-center min-w-[38px] min-h-[38px]"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* Mobile-Only: Hamburger Toggle Button */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-1.5 border border-[#111111] bg-white text-[#111111] transition-colors cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4 text-[#111111]" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  to="/login"
                  className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-mono font-bold text-[#111111] hover:bg-[#EFECE3] border border-[#111111] transition-all min-h-[34px] sm:min-h-[36px] flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 hidden sm:inline" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/signup"
                  className="px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-mono font-bold bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] border border-[#111111] transition-all shadow-xs min-h-[34px] sm:min-h-[36px] flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5 hidden sm:inline" />
                  <span>Sign Up</span>
                </Link>
                {/* Mobile-Only: Hamburger Toggle Button for Logged-Out Visitors */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-1.5 border border-[#111111] bg-white text-[#111111] transition-colors cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center ml-0.5"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4 text-[#111111]" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desk Navigation Ribbon (Row 2: Dedicated Broadsheet Desk Sub-Navigation) */}
      {currentUser && (
        <div className="hidden sm:block border-b-2 border-[#111111] bg-[#FAF8F3] font-mono text-xs">
          <div className="max-w-7xl mx-auto px-2.5 sm:px-4 flex items-center justify-between overflow-x-auto no-scrollbar">
            <nav className="flex items-center gap-1 py-1.5 shrink-0">
              <Link
                to="/dashboard"
                className={`px-3 py-1.5 font-bold transition-all flex items-center gap-1.5 border min-h-[34px] ${
                  location.pathname === '/dashboard'
                    ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                    : 'text-[#111111] hover:bg-[#EFECE3] border-transparent'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Portfolio & Ledger</span>
              </Link>
              <Link
                to="/screener"
                className={`px-3 py-1.5 font-bold transition-all flex items-center gap-1.5 border min-h-[34px] ${
                  location.pathname === '/screener'
                    ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                    : 'text-[#111111] hover:bg-[#EFECE3] border-transparent'
                }`}
                title="Real-Time Stock Screener & Market Heatmap"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Screener</span>
              </Link>
              <button
                type="button"
                onClick={openBacktester}
                className="px-3 py-1.5 font-bold text-[#111111] hover:bg-[#EFECE3] transition-all flex items-center gap-1.5 cursor-pointer border border-transparent min-h-[34px]"
                title="Quantitative Strategy Backtester"
              >
                <BarChart2 className="w-3.5 h-3.5 text-stone-600" />
                <span>Backtest</span>
              </button>
              <Link
                to="/journal"
                className={`px-3 py-1.5 font-bold transition-all flex items-center gap-1.5 border min-h-[34px] ${
                  location.pathname === '/journal'
                    ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                    : 'text-[#111111] hover:bg-[#EFECE3] border-transparent'
                }`}
                title="Trade Journal & Performance Analytics"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Journal</span>
              </Link>
              <Link
                to="/transactions"
                onClick={() => triggerSelectiveToolAd('transactions')}
                className={`px-3 py-1.5 font-bold transition-all flex items-center gap-1.5 border min-h-[34px] ${
                  location.pathname === '/transactions'
                    ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                    : 'text-[#111111] hover:bg-[#EFECE3] border-transparent'
                }`}
                title="Auditable Paper-Trading Transaction Ledger"
              >
                <History className="w-3.5 h-3.5" />
                <span>Transactions</span>
              </Link>
              <button
                type="button"
                onClick={openRiskCalculator}
                className="px-3 py-1.5 font-bold text-[#111111] hover:bg-[#EFECE3] transition-all flex items-center gap-1.5 cursor-pointer border border-transparent min-h-[34px]"
                title="Position Size & Risk Calculator"
              >
                <Calculator className="w-3.5 h-3.5 text-stone-600" />
                <span>Risk Calc</span>
              </button>
              <button
                type="button"
                onClick={openVault}
                className="px-3 py-1.5 font-bold text-[#111111] hover:bg-[#EFECE3] transition-all flex items-center gap-1.5 cursor-pointer border border-transparent min-h-[34px]"
                title="Encrypted Local Data Vault (AES-GCM)"
              >
                <Lock className="w-3.5 h-3.5 text-stone-600" />
                <span>Vault</span>
              </button>
            </nav>

            {/* Right side of ribbon: Cloud Sync Action */}
            <div className="flex items-center gap-2 py-1.5 pl-4 shrink-0">
              <button
                type="button"
                onClick={handleSyncClick}
                disabled={isSyncing}
                title="Synchronize local trades and balances to Cloud"
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold border border-[#111111] transition-all cursor-pointer min-h-[32px] ${
                  pendingSyncCount > 0
                    ? 'bg-amber-300 hover:bg-amber-400 text-[#111111] animate-pulse'
                    : syncStatus === 'synced'
                      ? 'bg-white text-emerald-800 hover:bg-emerald-50'
                      : 'bg-white text-[#111111] hover:bg-stone-100'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing 
                    ? 'Syncing...' 
                    : pendingSyncCount > 0 
                      ? `Sync (${pendingSyncCount})` 
                      : syncStatus === 'synced' 
                        ? 'Synced' 
                        : 'Sync Now'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer - Streamlined & Zero Bloat for 320px */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b-2 border-[#111111] bg-[#F6F4EE] px-3 py-3 space-y-2.5 font-mono text-xs shadow-md animate-in fade-in duration-100">
          {currentUser ? (
            <>
              {/* Quick Cash Balances Badge */}
              <div className="p-2.5 bg-white border border-[#111111] flex items-center justify-between">
                <span className="text-[#111111]/70 flex items-center gap-1 text-[11px] font-bold">
                  <Wallet className="w-3.5 h-3.5 text-[#111111]" />
                  Balances:
                </span>
                <div className="font-bold flex items-center gap-1.5 text-xs tabular-nums">
                  <span className="text-emerald-900">₹{inrBalance.toLocaleString('en-IN')}</span>
                  <span className="text-stone-300">/</span>
                  <span className="text-sky-900">${usdBalance.toLocaleString('en-US')}</span>
                </div>
              </div>

              {/* Navigation Links */}
              <div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 text-center font-bold border-2 transition-colors min-h-[42px] flex items-center justify-center gap-1.5 bg-[#111111] text-[#F6F4EE] border-[#111111]"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Portfolio & Ledger</span>
                </Link>
              </div>

              {/* Quick Tools Grid on Mobile */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openPalette(); }}
                  className="p-2 bg-neutral-900 text-white font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Terminal</span>
                </button>
                <Link
                  to="/screener"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-white text-black font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black hover:bg-neutral-100"
                >
                  <Filter className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Screener</span>
                </Link>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openBacktester(); }}
                  className="p-2 bg-white text-black font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Backtest</span>
                </button>
                <Link
                  to="/journal"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-white text-black font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black hover:bg-neutral-100"
                >
                  <BookOpen className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Journal</span>
                </Link>
                <Link
                  to="/transactions"
                  onClick={() => { setMobileMenuOpen(false); triggerSelectiveToolAd('transactions'); }}
                  className="p-2 bg-white text-black font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black hover:bg-neutral-100"
                >
                  <History className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Ledger</span>
                </Link>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openRiskCalculator(); }}
                  className="p-2 bg-white text-black font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Risk Calc</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openVault(); }}
                  className="p-2 bg-white text-black font-bold flex flex-col items-center justify-center text-[10px] gap-1 border border-black cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Vault</span>
                </button>
              </div>

              {/* Sync Button inside drawer for mobile */}
              <button
                type="button"
                onClick={handleSyncClick}
                disabled={isSyncing}
                className={`w-full py-2.5 px-3 text-xs font-mono font-bold border-2 border-[#111111] transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[42px] ${
                  pendingSyncCount > 0
                    ? 'bg-amber-300 text-[#111111]'
                    : syncStatus === 'synced'
                      ? 'bg-white text-emerald-900'
                      : 'bg-white text-[#111111]'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing 
                    ? 'Syncing with Cloud...' 
                    : pendingSyncCount > 0 
                      ? `Sync to Cloud (${pendingSyncCount} pending)` 
                      : syncStatus === 'synced' 
                        ? '✓ Synced with Cloud' 
                        : 'Sync Now'}
                </span>
              </button>

              {/* User Profile & Sign Out on Mobile */}
              <div className="pt-2 border-t border-[#111111] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className="w-7 h-7 bg-[#111111] text-[#F6F4EE] flex items-center justify-center font-bold text-xs border border-[#111111] shrink-0">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'T'}
                  </div>
                  <div className="text-[11px] truncate">
                    <div className="font-bold text-[#111111] truncate">{currentUser.displayName || currentUser.email}</div>
                    <div className="text-stone-500 text-[10px] truncate">{userProfile?.profile?.tradingStyle || 'Paper Trader'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 border border-red-800 font-bold flex items-center gap-1 cursor-pointer min-h-[38px] shrink-0 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Visitor Quick Action Drawer */}
              <div className="p-3 bg-white border border-[#111111] text-center space-y-1">
                <span className="font-bold text-xs uppercase block text-[#111111]">
                  100% SIMULATED PAPER TRADING
                </span>
                <p className="text-[10px] text-stone-600 font-news">
                  Practice global equities with ₹10,00,000 INR & $100,000 USD zero-risk capital.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 bg-white text-[#111111] border border-[#111111] text-center font-bold text-xs flex items-center justify-center gap-1.5 min-h-[42px]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 bg-[#111111] text-[#F6F4EE] border border-[#111111] text-center font-bold text-xs flex items-center justify-center gap-1.5 min-h-[42px]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up Free</span>
                </Link>
              </div>

              <div className="pt-2 border-t border-neutral-300 space-y-1.5">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); openPalette(); }}
                  className="w-full p-2 bg-neutral-900 text-white flex items-center justify-between text-xs font-bold border border-black cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open Command Terminal</span>
                  </span>
                  <span className="text-[10px] bg-neutral-800 px-1 py-0.5 border border-neutral-700">/</span>
                </button>
                <Link
                  to="/screener"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-white text-[#111111] border border-[#111111] flex items-center justify-between text-xs font-bold"
                >
                  <span>Stock Screener (52-Wk, RSI, P/E)</span>
                  <span>→</span>
                </Link>
                <Link
                  to="/guide"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-white text-[#111111] border border-[#111111] flex items-center justify-between text-xs font-bold"
                >
                  <span>Trader's Academy & Guide</span>
                  <span>→</span>
                </Link>
                <Link
                  to="/disclaimer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-white text-amber-900 border border-amber-900/40 flex items-center justify-between text-xs font-bold"
                >
                  <span>Simulated Risk Disclaimer</span>
                  <span>→</span>
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Sync Notification Bar if feedback active */}
      {syncFeedback && (
        <div className="bg-stone-900 text-[#FAF7F0] text-xs font-mono py-1 px-4 text-center transition-all flex items-center justify-center gap-2">
          <Cloud className="w-3.5 h-3.5 text-amber-400" />
          <span>{syncFeedback}</span>
        </div>
      )}
    </header>
  );
}
