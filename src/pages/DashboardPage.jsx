import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTradingTools } from '../context/TradingToolsContext';
import { STOCK_DIRECTORY, getInstantInitialQuotes } from '../lib/yahooFinance';
import { 
  subscribeToMarketStream, 
  syncTradingViewScanner 
} from '../lib/omniFeed';
import { getNSEMarketStatus, getUSMarketStatus, isMarketOpenForSymbol } from '../lib/marketHours';
import { getQuoteFreshness } from '../lib/quoteFreshness';
import TradeModal from '../components/TradeModal';
import StockDetailsPanel from '../components/StockDetailsPanel';
import MarketStatusBadge from '../components/MarketStatusBadge';
import HoldingSparkline from '../components/HoldingSparkline';
import TradingPerformance from '../components/TradingPerformance';
import { computeFloatingPositionAccounting, calculatePortfolioStopLossRisk } from '../lib/journalAnalytics';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  RotateCcw, 
  Plus, 
  Minus, 
  Building2, 
  Clock, 
  Sparkles, 
  Layers, 
  RefreshCw,
  Search,
  LineChart,
  PieChart,
  Zap,
  Radio,
  ExternalLink,
  Cloud,
  Check,
  Download,
  Upload,
  Database,
  Info,
  Terminal,
  Filter,
  BarChart2,
  BookOpen,
  ShieldAlert,
  Lock,
  Bell,
  Calculator,
  Star,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { searchGlobalEquities, fetchLiveQuoteAnyStock } from '../lib/stockSearchEngine';

export default function DashboardPage() {
  const { 
    currentUser, 
    userProfile, 
    resetPortfolio,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    syncError,
    syncToCloud,
    refreshFromCloud,
    exportLocalBackup,
    importLocalBackup,
    getWatchlist,
    isStockInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist
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
  
  // Tab state: 'ALL' | 'NSE' | 'US'
  const [activeTab, setActiveTab] = useState('ALL');
  
  // Holdings P&L Filter Mode: 'ALL' | 'PROFIT' | 'LOSS'
  const [holdingsPnlMode, setHoldingsPnlMode] = useState('ALL');

  // Exposure Panel View Mode: 'ALLOCATION' | 'STOP_RISK'
  const [exposureViewMode, setExposureViewMode] = useState('ALLOCATION');
  
  // Inspected Stock for Detailed Interactive Candlestick Chart & Order Book
  const [inspectedSymbol, setInspectedSymbol] = useState(null);

  // 0ms Instant Load: Pre-seeded from high-speed memory/cache
  const [livePrices, setLivePrices] = useState(() => getInstantInitialQuotes());
  const [feedEngine, setFeedEngine] = useState('OmniFeed Nexus');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const fileInputRef = useRef(null);
  
  // Trade Modal State
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeModalSymbol, setTradeModalSymbol] = useState('RELIANCE.NS');
  const [tradeModalAction, setTradeModalAction] = useState('BUY');

  // Search filter for top assets
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time market sessions & live exchange clocks
  const [nseStatus, setNseStatus] = useState(() => getNSEMarketStatus());
  const [usStatus, setUsStatus] = useState(() => getUSMarketStatus());

  useEffect(() => {
    const updateSessions = () => {
      setNseStatus(getNSEMarketStatus());
      setUsStatus(getUSMarketStatus());
    };
    const timer = setInterval(updateSessions, 1000);
    return () => clearInterval(timer);
  }, []);

  // Extract holdings & wallets
  const holdingsMap = userProfile?.holdings || {};
  const holdingsList = Object.values(holdingsMap);
  const inrWallet = userProfile?.wallets?.inr || { cashBalance: 1000000, investedValue: 0, realizedPnL: 0 };
  const usdWallet = userProfile?.wallets?.usd || { cashBalance: 100000, investedValue: 0, realizedPnL: 0 };

  // 1. Subscribe to OmniFeed Nexus Event-Driven Market Stream
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices, engine }) => {
      setLivePrices(prices);
      if (engine) setFeedEngine(engine);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await syncTradingViewScanner();
    setIsRefreshing(false);
    toast.success('OmniFeed Synced via TradingView Global Edge');
  };

  // Filter holdings based on active market tab and P&L mode
  const marketFilteredHoldings = holdingsList.filter((h) => {
    if (activeTab === 'NSE') return h.market === 'NSE' || h.currency === 'INR';
    if (activeTab === 'US') return h.market === 'US' || h.currency === 'USD';
    return true;
  });

  const profitHoldingsCount = marketFilteredHoldings.filter((h) => {
    const livePrice = livePrices[h.symbol]?.price || h.avgBuyPrice;
    return livePrice >= h.avgBuyPrice;
  }).length;
  const lossHoldingsCount = marketFilteredHoldings.length - profitHoldingsCount;

  const filteredHoldings = marketFilteredHoldings.filter((h) => {
    if (holdingsPnlMode === 'ALL') return true;
    const livePrice = livePrices[h.symbol]?.price || h.avgBuyPrice;
    const isProfit = livePrice >= h.avgBuyPrice;
    if (holdingsPnlMode === 'PROFIT') return isProfit;
    if (holdingsPnlMode === 'LOSS') return !isProfit;
    return true;
  });

  // Calculate dynamic portfolio valuation with live prices
  let totalInrCurrentValue = 0;
  let totalUsdCurrentValue = 0;
  let totalInrCost = 0;
  let totalUsdCost = 0;
  let totalInrNetPnL = 0;
  let totalInrGrossPnL = 0;
  let totalInrCharges = 0;
  let totalUsdNetPnL = 0;
  let totalUsdGrossPnL = 0;
  let totalUsdCharges = 0;

  // Sector allocation & combined risk exposure dictionary
  const sectorAllocations = {};
  const SECTOR_COLORS = [
    'bg-blue-600 text-white',
    'bg-emerald-600 text-white',
    'bg-purple-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-cyan-600 text-white',
    'bg-indigo-600 text-white',
    'bg-stone-600 text-white'
  ];

  let totalEquityINR = 0;
  let topHolding = null;
  let topHoldingValINR = 0;

  holdingsList.forEach((h) => {
    const livePrice = Number(livePrices[h.symbol]?.price || h.avgBuyPrice || 100);
    const currentVal = h.quantity * livePrice;
    const cost = h.totalCost || (h.quantity * h.avgBuyPrice);
    const isIndia = h.market === 'NSE' || h.currency === 'INR' || h.symbol?.endsWith('.NS') || h.symbol?.endsWith('.BO');
    const exchange = isIndia ? 'NSE' : 'US';

    const acct = computeFloatingPositionAccounting({
      avgBuyPrice: h.avgBuyPrice,
      livePrice,
      quantity: h.quantity,
      market: exchange,
      totalCost: cost,
      stopLossPrice: h.stopLossPrice,
    });

    const dirInfo = STOCK_DIRECTORY[h.symbol] || {};
    const sector = dirInfo.sector || h.sector || 'Equities';
    const convertedValINR = isIndia ? currentVal : currentVal * 86.5; // proxy conversion for unified risk exposure
    
    sectorAllocations[sector] = (sectorAllocations[sector] || 0) + convertedValINR;
    totalEquityINR += convertedValINR;

    if (convertedValINR > topHoldingValINR) {
      topHoldingValINR = convertedValINR;
      topHolding = { ...h, convertedValINR };
    }

    if (isIndia) {
      totalInrCurrentValue += currentVal;
      totalInrCost += cost;
      totalInrGrossPnL += acct.floatingGrossPnL;
      totalInrNetPnL += acct.floatingNetPnL;
      totalInrCharges += acct.allocatedEntryCharges;
    } else {
      totalUsdCurrentValue += currentVal;
      totalUsdCost += cost;
      totalUsdGrossPnL += acct.floatingGrossPnL;
      totalUsdNetPnL += acct.floatingNetPnL;
      totalUsdCharges += acct.allocatedEntryCharges;
    }
  });

  const inrNetUnrealizedPnL = totalInrNetPnL;
  const inrGrossUnrealizedPnL = totalInrGrossPnL;
  const inrNetUnrealizedPercent = totalInrCost > 0 ? (inrNetUnrealizedPnL / totalInrCost) * 100 : 0;
  const inrGrossUnrealizedPercent = totalInrCost > 0 ? (inrGrossUnrealizedPnL / totalInrCost) * 100 : 0;

  const usdNetUnrealizedPnL = totalUsdNetPnL;
  const usdGrossUnrealizedPnL = totalUsdGrossPnL;
  const usdNetUnrealizedPercent = totalUsdCost > 0 ? (usdNetUnrealizedPnL / totalUsdCost) * 100 : 0;
  const usdGrossUnrealizedPercent = totalUsdCost > 0 ? (usdGrossUnrealizedPnL / totalUsdCost) * 100 : 0;

  // Calculate Stop-Loss Portfolio Risk across all active positions
  const stopLossRiskData = calculatePortfolioStopLossRisk(holdingsList, livePrices, 86.5);

  // Sector breakdown list for visual exposure bar
  const sectorList = Object.entries(sectorAllocations).map(([name, val], index) => ({
    name,
    val,
    percent: totalEquityINR > 0 ? (val / totalEquityINR) * 100 : 0,
    color: SECTOR_COLORS[index % SECTOR_COLORS.length]
  })).sort((a, b) => b.val - a.val);

  const topHoldingPct = totalEquityINR > 0 && topHolding ? (topHoldingValINR / totalEquityINR) * 100 : 0;
  const totalInrEquityConverted = totalInrCurrentValue;
  const totalUsdEquityConverted = totalUsdCurrentValue * 86.5;
  const inrEquityPct = totalEquityINR > 0 ? (totalInrEquityConverted / totalEquityINR) * 100 : 0;
  const usdEquityPct = totalEquityINR > 0 ? (totalUsdEquityConverted / totalEquityINR) * 100 : 0;
  
  const totalPortfolioWealthINR = totalEquityINR + (inrWallet.cashBalance || 0) + ((usdWallet.cashBalance || 0) * 86.5);
  const cashReservePct = totalPortfolioWealthINR > 0 
    ? (((inrWallet.cashBalance || 0) + ((usdWallet.cashBalance || 0) * 86.5)) / totalPortfolioWealthINR) * 100 
    : 100;

  const openTrade = (symbol, action = 'BUY') => {
    setTradeModalSymbol(symbol);
    setTradeModalAction(action);
    setTradeModalOpen(true);
  };

  const inspectStock = (symbol) => {
    setInspectedSymbol(symbol);
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset your virtual trading ledger? All holdings will be closed and cash restored to ₹10,00,000 and $100,000.')) {
      await resetPortfolio();
      toast.success('Paper Portfolio Reset Successfully');
    }
  };

  const handleSyncNow = async () => {
    setIsCloudSyncing(true);
    const res = await syncToCloud();
    setIsCloudSyncing(false);
    if (res?.success) {
      toast.success('Cloud Sync Complete', { description: res.message });
    } else {
      toast.info('Local Storage Active', { description: res.message || 'Saved locally in your browser.' });
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const success = importLocalBackup(event.target?.result);
        if (success) {
          toast.success('Portfolio Restored from Backup File');
        } else {
          toast.error('Invalid backup file format');
        }
      } catch (err) {
        toast.error('Failed to parse backup JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Search state for Global Equities (Indian NSE/BSE & US NASDAQ/NYSE)
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Top 6 Curated Benchmark Leaders per market (Clean Broadsheet display instead of dumping all 30+ stocks)
  const BENCHMARK_LEADERS = {
    NSE: [
      STOCK_DIRECTORY['RELIANCE.NS'],
      STOCK_DIRECTORY['TCS.NS'],
      STOCK_DIRECTORY['HDFCBANK.NS'],
      STOCK_DIRECTORY['INFY.NS'],
      STOCK_DIRECTORY['TATAMOTORS.NS'],
      STOCK_DIRECTORY['ICICIBANK.NS'],
    ].filter(Boolean),
    US: [
      STOCK_DIRECTORY['AAPL'],
      STOCK_DIRECTORY['NVDA'],
      STOCK_DIRECTORY['MSFT'],
      STOCK_DIRECTORY['AMZN'],
      STOCK_DIRECTORY['GOOGL'],
      STOCK_DIRECTORY['TSLA'],
    ].filter(Boolean),
  };

  // Active Featured Benchmark Leaders
  const featuredLeaders = activeTab === 'NSE'
    ? BENCHMARK_LEADERS.NSE
    : activeTab === 'US'
      ? BENCHMARK_LEADERS.US
      : [...BENCHMARK_LEADERS.NSE.slice(0, 3), ...BENCHMARK_LEADERS.US.slice(0, 3)];

  // User's Watchlisted symbols (Local-First + Dexie synced)
  const nseWatchlist = userProfile?.watchlist?.NSE || ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'TATAMOTORS.NS'];
  const usWatchlist = userProfile?.watchlist?.US || ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN'];

  const displayedWatchlistSymbols = activeTab === 'NSE'
    ? nseWatchlist
    : activeTab === 'US'
      ? usWatchlist
      : Array.from(new Set([...nseWatchlist, ...usWatchlist]));

  // Resolve metadata for any symbol
  const resolveStockMeta = (sym) => {
    if (STOCK_DIRECTORY[sym]) return STOCK_DIRECTORY[sym];
    const isIndian = sym.endsWith('.NS') || sym.endsWith('.BO');
    return {
      symbol: sym,
      ticker: sym.replace('.NS', '').replace('.BO', ''),
      name: sym,
      market: isIndian ? 'NSE' : 'US',
      currency: isIndian ? 'INR' : 'USD',
      sector: 'Equities',
      basePrice: 100,
    };
  };

  // Debounced search for global market equities
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchGlobalEquities(query, activeTab);
        if (active) {
          setSearchResults(results);
          setIsSearching(false);
          // Pre-fetch live quotes for found items
          results.slice(0, 8).forEach(async (r) => {
            if (!livePrices[r.symbol]) {
              const q = await fetchLiveQuoteAnyStock(r.symbol);
              if (q && active) {
                setLivePrices((prev) => ({ ...prev, [r.symbol]: q }));
              }
            }
          });
        }
      } catch (err) {
        if (active) setIsSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  // Fetch missing quotes for any displayed watchlist stocks
  useEffect(() => {
    displayedWatchlistSymbols.forEach(async (sym) => {
      if (!livePrices[sym]) {
        const q = await fetchLiveQuoteAnyStock(sym);
        if (q) {
          setLivePrices((prev) => ({ ...prev, [sym]: q }));
        }
      }
    });
  }, [displayedWatchlistSymbols]);

  // Handle Watchlist Star Toggle with Toast
  const handleWatchlistToggle = async (e, symbol, market, category) => {
    e.stopPropagation();
    try {
      const added = await toggleWatchlist(symbol, market, category);
      if (added) {
        toast.success(`Added ${symbol} to your ${market} Watchlist ⭐`);
        if (!livePrices[symbol]) {
          const q = await fetchLiveQuoteAnyStock(symbol);
          if (q) setLivePrices((prev) => ({ ...prev, [symbol]: q }));
        }
      } else {
        toast.info(`Removed ${symbol} from Watchlist`);
      }
    } catch (err) {
      toast.error('Failed to update watchlist');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2.5 py-4 sm:px-6 lg:px-8 text-[#111111]">
      {/* Top Broadsheet Masthead Header */}
      <div className="border-b-4 border-double border-[#111111] pb-3 sm:pb-4 mb-5 sm:mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-headline uppercase font-black text-2xl sm:text-4xl lg:text-5xl text-[#111111] tracking-tight leading-none">
              TRADER'S DESK & LEDGER
            </h1>
            <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold flex items-center gap-1 border border-[#111111]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{feedEngine}</span>
            </span>
            <span className="hidden sm:flex text-xs font-mono px-2 py-0.5 bg-white text-[#111111] font-bold border border-[#111111] items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
              <span>Live Floor Stream</span>
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-[#111111]/70 font-mono mt-1 uppercase tracking-wider">
            OMNIFEED NEXUS™ • TRADINGVIEW EDGE + FLOOR ENGINE • 0MS LATENCY
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-none px-3 py-2 bg-white border-2 border-[#111111] hover:bg-[#EFECE3] text-[#111111] text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Edge'}</span>
          </button>

          <button
            onClick={() => openTrade('RELIANCE.NS', 'BUY')}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] text-xs font-mono font-bold border-2 border-[#111111] flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invest Cash</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset Virtual Portfolio Funds"
            className="p-2.5 bg-white border-2 border-[#111111] hover:bg-red-50 hover:border-red-800 text-stone-700 hover:text-red-900 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Local-First Storage & Cloud Sync Control Deck - Inverted Black Broadsheet Block */}
      <div className="newspaper-black-box p-4 sm:p-5 mb-6 font-mono text-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/10 border border-white/20 text-white mt-0.5">
              <Database className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white tracking-wide uppercase text-sm">
                  LOCAL-FIRST LEDGER ENGINE
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-500'
                    : pendingSyncCount > 0
                      ? 'bg-amber-400 text-black border-amber-300 font-black animate-pulse'
                      : 'bg-white/10 text-white/90 border-white/30'
                }`}>
                  {syncStatus === 'synced'
                    ? '✓ Synced with Firebase Cloud'
                    : pendingSyncCount > 0
                      ? `● ${pendingSyncCount} Action(s) Saved Locally in Browser`
                      : '✓ Browser Local Storage Active'}
                </span>
              </div>
              <p className="text-[11px] text-white/75 mt-1 font-news text-sm leading-relaxed">
                All buy and sell orders execute with zero network lag or failure. Click <strong className="text-white font-mono font-bold">Sync Now</strong> to push records to Firebase Cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-end md:self-center">
            {/* Sync Now Button */}
            <button
              onClick={handleSyncNow}
              disabled={isCloudSyncing}
              className={`flex-1 sm:flex-none px-4 py-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-2 min-h-[44px] ${
                pendingSyncCount > 0
                  ? 'bg-amber-400 hover:bg-amber-300 text-[#111111] border-amber-400'
                  : 'bg-white hover:bg-stone-200 text-[#111111] border-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span>{isCloudSyncing ? 'Syncing...' : '⚡ Sync Now'}</span>
            </button>

            {/* Export JSON Backup */}
            <button
              onClick={exportLocalBackup}
              title="Download your full portfolio, ledger, and cash state as JSON"
              className="px-3 py-2 bg-transparent hover:bg-white/10 text-white border border-white/40 transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>

            {/* Import Backup */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Restore portfolio from JSON file"
              className="px-3 py-2 bg-transparent hover:bg-white/10 text-white border border-white/40 transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
          </div>
        </div>

        {/* Sync Note if available */}
        {syncError && (
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-amber-300">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}
      </div>

      {/* Self-Hosted Client-Side Trading Suite Ribbon */}
      <div className="bg-white border-2 border-[#111111] p-3 sm:p-4 mb-6 font-mono text-xs shadow-[4px_4px_0px_#111111]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="font-serif font-bold text-sm uppercase text-[#111111]">
              Self-Hosted Quantitative Trading Tools
            </span>
            <span className="text-[10px] px-1.5 py-0.2 bg-neutral-100 border border-neutral-300 font-bold uppercase text-neutral-600">
              100% Client-Side
            </span>
          </div>
          <button
            onClick={openPalette}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Command Terminal</span>
            <kbd className="px-1 bg-neutral-800 border border-neutral-600 text-[9px] text-neutral-300">/</kbd>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            onClick={() => navigate('/screener')}
            className="p-2.5 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors cursor-pointer text-center"
          >
            <Filter className="w-4 h-4 text-emerald-700" />
            <span>Screener & Heatmap</span>
          </button>

          <button
            onClick={() => openBacktester()}
            className="p-2.5 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors cursor-pointer text-center"
          >
            <BarChart2 className="w-4 h-4 text-blue-700" />
            <span>Strategy Backtest</span>
          </button>

          <button
            onClick={() => openJournal()}
            className="p-2.5 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors cursor-pointer text-center"
          >
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span>Trade Journal</span>
          </button>

          <button
            onClick={() => openRiskCalculator()}
            className="p-2.5 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors cursor-pointer text-center"
          >
            <Calculator className="w-4 h-4 text-purple-700" />
            <span>Risk & Sizing Calc</span>
          </button>

          <button
            onClick={() => openAlerts()}
            className="p-2.5 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors cursor-pointer text-center"
          >
            <Bell className="w-4 h-4 text-rose-700" />
            <span>Local Alerts</span>
          </button>

          <button
            onClick={() => openVault()}
            className="p-2.5 border border-[#111111] bg-neutral-50 hover:bg-neutral-200 flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition-colors cursor-pointer text-center"
          >
            <Lock className="w-4 h-4 text-neutral-800" />
            <span>Encrypted Vault</span>
          </button>
        </div>
      </div>

      {/* Market Selector Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-[#111111] mb-6 font-mono text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-2.5 px-4 font-bold border-b-4 transition-all min-h-[44px] flex items-center whitespace-nowrap cursor-pointer ${
            activeTab === 'ALL'
              ? 'border-[#111111] text-[#111111] bg-white'
              : 'border-transparent text-[#111111]/60 hover:text-[#111111]'
          }`}
        >
          🌐 Unified Overview (Dual Market)
        </button>
        <button
          onClick={() => setActiveTab('NSE')}
          className={`pb-2.5 px-4 font-bold border-b-4 transition-all flex items-center gap-2 min-h-[44px] whitespace-nowrap cursor-pointer ${
            activeTab === 'NSE'
              ? 'border-[#111111] text-[#111111] bg-white'
              : 'border-transparent text-[#111111]/60 hover:text-[#111111]'
          }`}
        >
          <span>🇮🇳 Indian Equity (₹ INR)</span>
          <MarketStatusBadge market="NSE" size="sm" showTime={false} interactive={false} />
        </button>
        <button
          onClick={() => setActiveTab('US')}
          className={`pb-2.5 px-4 font-bold border-b-4 transition-all flex items-center gap-2 min-h-[44px] whitespace-nowrap cursor-pointer ${
            activeTab === 'US'
              ? 'border-[#111111] text-[#111111] bg-white'
              : 'border-transparent text-[#111111]/60 hover:text-[#111111]'
          }`}
        >
          <span>🇺🇸 Foreign US Equity ($ USD)</span>
          <MarketStatusBadge market="US" size="sm" showTime={false} interactive={false} />
        </button>
      </div>

      {/* Official Government / Exchange Holiday Notification Banner */}
      {((activeTab === 'ALL' || activeTab === 'NSE') && nseStatus.isHoliday) && (
        <div className="mb-6 p-3 sm:p-4 bg-amber-50 border-2 border-amber-900 text-amber-950 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 border border-amber-800 text-amber-950 shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-amber-900" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-amber-950">
                  🏛️ GOVERNMENT TRADING HOLIDAY TODAY: {nseStatus.holidayName.toUpperCase()}
                </span>
                <span className="px-1.5 py-0.5 bg-amber-900 text-amber-100 font-bold text-[10px] uppercase">
                  NSE & BSE CLOSED
                </span>
              </div>
              <p className="text-[11px] text-amber-900/90 font-news mt-0.5 leading-relaxed">
                National Stock Exchange of India (NSE) is observing <strong>{nseStatus.holidayName}</strong>. Official trading hours are 09:15 AM – 03:30 PM IST on regular days. Next live trading session opens tomorrow at 09:15 AM IST.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-950 px-2.5 py-1 bg-amber-200 border border-amber-800 shrink-0">
            {nseStatus.exchangeTime}
          </span>
        </div>
      )}

      {((activeTab === 'ALL' || activeTab === 'US') && usStatus.isHoliday) && (
        <div className="mb-6 p-3 sm:p-4 bg-amber-50 border-2 border-amber-900 text-amber-950 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 border border-amber-800 text-amber-950 shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-amber-900" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-amber-950">
                  🏛️ US FEDERAL TRADING HOLIDAY TODAY: {usStatus.holidayName.toUpperCase()}
                </span>
                <span className="px-1.5 py-0.5 bg-amber-900 text-amber-100 font-bold text-[10px] uppercase">
                  NYSE & NASDAQ CLOSED
                </span>
              </div>
              <p className="text-[11px] text-amber-900/90 font-news mt-0.5 leading-relaxed">
                US Exchanges are observing <strong>{usStatus.holidayName}</strong> federal holiday. Official trading hours are 09:30 AM – 04:00 PM ET.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-950 px-2.5 py-1 bg-amber-200 border border-amber-800 shrink-0">
            {usStatus.exchangeTime}
          </span>
        </div>
      )}

      {/* Portfolio Value Summary Cards - Broadsheet Ledger Plates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5 mb-6 sm:mb-8">
        {/* Card 1: Indian Market Net Worth */}
        {(activeTab === 'ALL' || activeTab === 'NSE') && (
          <div className="newspaper-photo-plate p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-[#111111] pb-2 font-mono">
                <span className="text-xs text-[#111111] font-bold uppercase tracking-wider">
                  🇮🇳 INDIAN EQUITY PORTFOLIO
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase">
                  INR (₹)
                </span>
              </div>
              <div className="mt-3 font-mono font-bold text-2xl sm:text-4xl text-[#111111] tracking-tight tabular-nums break-all sm:break-normal">
                ₹{(inrWallet.cashBalance + totalInrCurrentValue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#D8D2C4] font-mono text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#111111]/60 block text-[10px] uppercase">Cash Balance:</span>
                  <span className="font-bold text-[#111111]">₹{inrWallet.cashBalance.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[#111111]/60 block text-[10px] uppercase">Invested Value:</span>
                  <span className="font-bold text-[#111111]">₹{totalInrCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-dashed border-[#D8D2C4] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#111111]/70">Unrealized P&L (Net):</span>
                  <span className={`font-bold flex items-center gap-0.5 ${inrNetUnrealizedPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {inrNetUnrealizedPnL >= 0 ? '+' : ''}₹{inrNetUnrealizedPnL.toFixed(2)} ({inrNetUnrealizedPercent >= 0 ? '+' : ''}{inrNetUnrealizedPercent.toFixed(2)}% Net)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                  <span>Gross: {inrGrossUnrealizedPnL >= 0 ? '+' : ''}₹{inrGrossUnrealizedPnL.toFixed(2)} ({inrGrossUnrealizedPercent >= 0 ? '+' : ''}{inrGrossUnrealizedPercent.toFixed(2)}%)</span>
                  <span>Est. Fees: ₹{totalInrCharges.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card 2: US Market Net Worth */}
        {(activeTab === 'ALL' || activeTab === 'US') && (
          <div className="newspaper-photo-plate p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-[#111111] pb-2 font-mono">
                <span className="text-xs text-[#111111] font-bold uppercase tracking-wider">
                  🇺🇸 FOREIGN US PORTFOLIO
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase">
                  USD ($)
                </span>
              </div>
              <div className="mt-3 font-mono font-bold text-2xl sm:text-4xl text-[#111111] tracking-tight tabular-nums break-all sm:break-normal">
                ${(usdWallet.cashBalance + totalUsdCurrentValue).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#D8D2C4] font-mono text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#111111]/60 block text-[10px] uppercase">Cash Balance:</span>
                  <span className="font-bold text-[#111111]">${usdWallet.cashBalance.toLocaleString('en-US')}</span>
                </div>
                <div>
                  <span className="text-[#111111]/60 block text-[10px] uppercase">Invested Value:</span>
                  <span className="font-bold text-[#111111]">${totalUsdCurrentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-dashed border-[#D8D2C4] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#111111]/70">Unrealized P&L (Net):</span>
                  <span className={`font-bold flex items-center gap-0.5 ${usdNetUnrealizedPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {usdNetUnrealizedPnL >= 0 ? '+' : ''}${usdNetUnrealizedPnL.toFixed(2)} ({usdNetUnrealizedPercent >= 0 ? '+' : ''}{usdNetUnrealizedPercent.toFixed(2)}% Net)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                  <span>Gross: {usdGrossUnrealizedPnL >= 0 ? '+' : ''}${usdGrossUnrealizedPnL.toFixed(2)} ({usdGrossUnrealizedPercent >= 0 ? '+' : ''}{usdGrossUnrealizedPercent.toFixed(2)}%)</span>
                  <span>Est. Fees: ${totalUsdCharges.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card 3: TRADING PERFORMANCE with Real-time P&L and Multi-Device Cloud Sync */}
        <TradingPerformance
          userProfile={userProfile}
          livePrices={livePrices}
          activeTab={activeTab}
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onRefreshCloud={refreshFromCloud}
        />
      </div>

      {/* Interactive Stock Inspector Panel (TradingView Candlestick Chart, Stats & Quick Order) */}
      {inspectedSymbol && (
        <StockDetailsPanel
          symbol={inspectedSymbol}
          onClose={() => setInspectedSymbol(null)}
        />
      )}

      {/* Portfolio Sector Allocation & Unified Risk Exposure View */}
      {holdingsList.length > 0 && (
        <div className="newspaper-photo-plate p-4 sm:p-5 bg-white border-2 border-[#111111] mb-6 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-[#111111] gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#111111]" />
                  <span>
                    {exposureViewMode === 'ALLOCATION' 
                      ? 'Portfolio Sector Allocation & Combined Risk Exposure' 
                      : 'Portfolio Risk at Stop Levels (Value at Risk Analysis)'}
                  </span>
                </h3>
              </div>
              <p className="text-[10px] text-neutral-500 font-sans mt-0.5">
                {exposureViewMode === 'ALLOCATION'
                  ? 'Multi-market capital distribution across industries, currency weighting (₹ INR / $ USD), and single-stock concentration risk'
                  : 'Total capital exposed to loss if configured stop-loss levels trigger, grouped by sector vulnerability and currency exposure'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Dual-Mode Toggle: Allocation vs Stop-Loss Risk */}
              <div className="flex items-center border border-[#111111] bg-neutral-100 p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setExposureViewMode('ALLOCATION')}
                  className={`px-2.5 py-1 transition-colors cursor-pointer ${
                    exposureViewMode === 'ALLOCATION'
                      ? 'bg-[#111111] text-white shadow-xs'
                      : 'text-[#111111] hover:bg-neutral-200'
                  }`}
                >
                  Capital Allocation
                </button>
                <button
                  type="button"
                  onClick={() => setExposureViewMode('STOP_RISK')}
                  className={`px-2.5 py-1 transition-colors flex items-center gap-1 cursor-pointer ${
                    exposureViewMode === 'STOP_RISK'
                      ? 'bg-[#111111] text-white shadow-xs'
                      : 'text-[#111111] hover:bg-neutral-200'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  <span>Stop-Loss Risk</span>
                </button>
              </div>

              <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-[10px] font-bold hidden md:inline">
                {holdingsList.length} Holdings
              </span>
            </div>
          </div>

          {exposureViewMode === 'ALLOCATION' ? (
            <>
              {/* Visual Segmented Sector Distribution Bar */}
              <div className="mt-3">
                <div className="h-4 w-full bg-neutral-200 border border-[#111111] flex overflow-hidden">
                  {sectorList.map((item) => (
                    <div
                      key={item.name}
                      style={{ width: `${Math.max(2, item.percent)}%` }}
                      className={`${item.color} h-full border-r border-[#111111] last:border-r-0 transition-all`}
                      title={`${item.name}: ${item.percent.toFixed(1)}% of total equity holdings`}
                    />
                  ))}
                </div>

                {/* Sector Tags Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-3 text-[10px]">
                  {sectorList.map((item) => (
                    <div key={item.name} className="p-2 border border-neutral-200 bg-neutral-50 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                        <span className="font-bold text-[#111111] truncate" title={item.name}>{item.name}</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between text-[11px] font-bold">
                        <span>{item.percent.toFixed(1)}%</span>
                        <span className="text-[9px] text-neutral-500 font-normal">
                          {item.percent > 40 ? 'Overweight' : item.percent > 20 ? 'Core' : 'Diversified'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Macro Exposure & Concentration Risk Ribbon */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-dashed border-neutral-300 text-[11px]">
                <div className="p-2 bg-neutral-50 border border-neutral-200">
                  <span className="text-neutral-500 uppercase block text-[9px] font-bold">Market & Currency Exposure:</span>
                  <span className="font-bold text-[#111111]">
                    🇮🇳 INR Equities: {inrEquityPct.toFixed(1)}% • 🇺🇸 USD Equities: {usdEquityPct.toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">Dual-currency multi-asset paper ledger</span>
                </div>

                <div className="p-2 bg-neutral-50 border border-neutral-200">
                  <span className="text-neutral-500 uppercase block text-[9px] font-bold">Top Asset Concentration:</span>
                  <span className={`font-bold ${topHoldingPct > 35 ? 'text-rose-700' : 'text-emerald-800'}`}>
                    {topHolding ? `${topHolding.symbol} (${topHoldingPct.toFixed(1)}%)` : 'None'}
                  </span>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">
                    {topHoldingPct > 35 ? '⚠️ Elevated single-position risk (>35%)' : '✓ Balanced single-asset risk (<35%)'}
                  </span>
                </div>

                <div className="p-2 bg-neutral-50 border border-neutral-200">
                  <span className="text-neutral-500 uppercase block text-[9px] font-bold">Cash vs Equity Allocation:</span>
                  <span className="font-bold text-[#111111]">
                    {cashReservePct.toFixed(1)}% Cash Reserves • {(100 - cashReservePct).toFixed(1)}% Invested
                  </span>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">Ample liquidity for opportunistic trades</span>
                </div>
              </div>
            </>
          ) : (
            /* Stop-Loss Risk View */
            <div className="space-y-3 mt-3">
              {/* Segmented Risk Contribution Bar */}
              <div className="h-4 w-full bg-neutral-200 border border-[#111111] flex overflow-hidden">
                {stopLossRiskData.sectorStopRisks.map((item, idx) => (
                  <div
                    key={item.name}
                    style={{ width: `${Math.max(2, item.percentOfRisk)}%` }}
                    className={`${SECTOR_COLORS[idx % SECTOR_COLORS.length]} h-full border-r border-[#111111] last:border-r-0 transition-all`}
                    title={`${item.name}: ₹${item.riskINR.toLocaleString()} (${item.percentOfRisk}% of stop-loss risk)`}
                  />
                ))}
              </div>

              {/* Stop Risk Sector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[10px]">
                {stopLossRiskData.sectorStopRisks.map((item, idx) => (
                  <div key={item.name} className="p-2 border border-neutral-200 bg-neutral-50 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 rounded-full ${SECTOR_COLORS[idx % SECTOR_COLORS.length]} shrink-0`} />
                      <span className="font-bold text-[#111111] truncate" title={item.name}>{item.name}</span>
                    </div>
                    <div className="mt-1">
                      <div className="text-[11px] font-bold text-rose-800">
                        ₹{item.riskINR.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-neutral-500 font-normal flex justify-between">
                        <span>{item.percentOfRisk}% of risk</span>
                        <span>({item.percentOfEquity}% eq)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stop-Loss Macro Risk Summary Ribbon */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-dashed border-neutral-300 text-[11px]">
                <div className="p-2.5 bg-rose-50 border border-rose-300">
                  <span className="text-rose-900 uppercase block text-[9px] font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-700" /> Total Capital at Stop Risk:
                  </span>
                  <div className="font-bold text-base text-rose-950 mt-0.5">
                    ₹{stopLossRiskData.totalStopRiskINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-rose-800 font-bold block mt-0.5">
                    {stopLossRiskData.portfolioRiskPercent}% of Total Equity Exposed
                  </span>
                </div>

                <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                  <span className="text-neutral-500 uppercase block text-[9px] font-bold">Stop Risk by Currency:</span>
                  <div className="font-bold text-xs text-[#111111] mt-0.5 space-y-0.5">
                    <div>🇮🇳 INR Risk: <strong>₹{stopLossRiskData.totalInrStopRisk.toLocaleString()}</strong></div>
                    <div>🇺🇸 USD Risk: <strong>${stopLossRiskData.totalUsdStopRisk.toLocaleString()}</strong> (₹{(stopLossRiskData.totalUsdStopRisk * 86.5).toFixed(0)})</div>
                  </div>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">Max potential loss under current protective stops</span>
                </div>

                <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                  <span className="text-neutral-500 uppercase block text-[9px] font-bold">Stop-Loss Safety Coverage:</span>
                  <span className="font-bold text-emerald-800 block text-xs mt-0.5">
                    ✓ 100% of Positions Protected
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5 leading-relaxed">
                    Positions without custom stops utilize standard 5% protective safety buffer
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Section: Active Holdings Table */}
      <div className="newspaper-photo-plate overflow-hidden mb-10">
        <div className="p-4 sm:p-5 border-b-2 border-[#111111] bg-[#FAF8F3] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline uppercase font-black text-2xl sm:text-3xl text-[#111111] tracking-tight">
                ACTIVE PORTFOLIO HOLDINGS ({filteredHoldings.length})
              </h2>
            </div>
            <p className="text-xs font-mono text-[#111111]/70 mt-0.5 uppercase tracking-wider">
              REAL-TIME POSITION LEDGER • VERIFIED ENTRY PRICES • LIVE P&L MODES & MINI SPARKLINE TRENDS
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* P&L Mode Filter Toggle Buttons */}
            <div className="inline-flex border border-[#111111] bg-white p-0.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setHoldingsPnlMode('ALL')}
                className={`px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                  holdingsPnlMode === 'ALL'
                    ? 'bg-[#111111] text-[#F6F4EE]'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title="Show all positions"
              >
                All ({marketFilteredHoldings.length})
              </button>
              <button
                type="button"
                onClick={() => setHoldingsPnlMode('PROFIT')}
                className={`px-2.5 py-1 font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  holdingsPnlMode === 'PROFIT'
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-800 hover:bg-emerald-50'
                }`}
                title="Filter positions in Profit"
              >
                <TrendingUp className="w-3 h-3" />
                <span>Profit ({profitHoldingsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setHoldingsPnlMode('LOSS')}
                className={`px-2.5 py-1 font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  holdingsPnlMode === 'LOSS'
                    ? 'bg-rose-700 text-white'
                    : 'text-rose-800 hover:bg-rose-50'
                }`}
                title="Filter positions in Drawdown / Loss"
              >
                <TrendingDown className="w-3 h-3" />
                <span>Loss ({lossHoldingsCount})</span>
              </button>
            </div>

            <button
              onClick={() => openTrade('RELIANCE.NS', 'BUY')}
              className="px-3.5 py-1.5 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] text-xs font-mono font-bold border-2 border-[#111111] flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Invest In Stock</span>
            </button>
          </div>
        </div>

        {filteredHoldings.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-white">
            <div className="w-12 h-12 mx-auto bg-[#F6F4EE] border border-[#111111] flex items-center justify-center text-[#111111] mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-headline uppercase font-bold text-xl text-[#111111]">
              {holdingsPnlMode === 'ALL'
                ? 'NO ACTIVE STOCK HOLDINGS YET'
                : holdingsPnlMode === 'PROFIT'
                ? 'NO POSITIONS CURRENTLY IN PROFIT'
                : 'NO POSITIONS CURRENTLY IN LOSS'}
            </h3>
            <p className="mt-2 text-sm text-[#111111]/75 max-w-md mx-auto font-news leading-relaxed">
              {holdingsPnlMode === 'ALL'
                ? 'Your virtual portfolio is primed and waiting. Select an Indian or US equity below to review real-time TradingView candlesticks and execute your opening trade.'
                : `You currently have ${marketFilteredHoldings.length} total active holdings. Click "All" above to inspect all positions.`}
            </p>
            {holdingsPnlMode !== 'ALL' && (
              <div className="mt-4">
                <button
                  onClick={() => setHoldingsPnlMode('ALL')}
                  className="px-4 py-2 bg-white border-2 border-[#111111] text-[#111111] font-mono text-xs font-bold hover:bg-[#111111] hover:text-[#F6F4EE] transition-all cursor-pointer"
                >
                  Show All Positions ({marketFilteredHoldings.length})
                </button>
              </div>
            )}
            {holdingsPnlMode === 'ALL' && (
              <div className="mt-5 flex flex-wrap justify-center gap-3 font-mono">
                <button
                  onClick={() => inspectStock('RELIANCE.NS')}
                  className="px-4 py-2.5 bg-white border-2 border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-xs font-bold transition-all cursor-pointer min-h-[44px]"
                >
                  + Inspect Reliance Industries (₹)
                </button>
                <button
                  onClick={() => inspectStock('AAPL')}
                  className="px-4 py-2.5 bg-white border-2 border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-xs font-bold transition-all cursor-pointer min-h-[44px]"
                >
                  + Inspect Apple Inc. ($)
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View (Screens < 640px) */}
            <div className="sm:hidden divide-y divide-[#111111] bg-white">
              {filteredHoldings.map((h) => {
                const isInd = h.market === 'NSE' || h.currency === 'INR' || h.symbol?.endsWith('.NS') || h.symbol?.endsWith('.BO');
                const sym = isInd ? '₹' : '$';
                const quote = livePrices[h.symbol];
                const currentPrice = Number(quote?.price || h.avgBuyPrice);
                const currentVal = Number((h.quantity * currentPrice).toFixed(2));
                const totalCost = Number(h.totalCost || (h.quantity * h.avgBuyPrice));

                const marketStatus = isMarketOpenForSymbol(h.symbol);
                const freshness = getQuoteFreshness(quote);

                const acct = computeFloatingPositionAccounting({
                  avgBuyPrice: h.avgBuyPrice,
                  livePrice: currentPrice,
                  quantity: h.quantity,
                  market: isInd ? 'NSE' : 'US',
                  totalCost,
                  stopLossPrice: h.stopLossPrice,
                  quoteTimestamp: quote?.timestamp,
                  isFresh: !freshness.isStale && marketStatus.isOpen,
                });

                const netPnL = acct.floatingNetPnL;
                const netPercent = acct.netReturnPercent;
                const grossPnL = acct.floatingGrossPnL;
                const grossPercent = acct.grossReturnPercent;
                const estFees = acct.allocatedEntryCharges;
                const perShareGrossPnL = acct.perShareGrossPnL;

                const isNetProfit = acct.isProfitable;
                const isGrossProfit = acct.isGrossProfitable;
                const isAbove = acct.isAboveEntry;
                const isBelow = acct.isBelowEntry;

                // Telemetry status
                const isLiveActive = marketStatus.isOpen && !freshness.isStale;
                const isMarketClosed = !marketStatus.isOpen;

                return (
                  <div key={h.symbol} className="p-4 font-mono text-xs space-y-3">
                    {/* Header Row: Symbol, Market & Profit/Loss Mode Pill */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-base text-[#111111] flex items-center gap-1.5">
                          <span>{h.symbol}</span>
                          <span className="px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] text-[9px] font-bold uppercase">
                            {h.market || (isInd ? 'NSE' : 'US')}
                          </span>
                          {isNetProfit ? (
                            <span className="px-1.5 py-0.5 border border-emerald-700 bg-emerald-50 text-emerald-800 text-[9px] font-bold uppercase inline-flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" />
                              <span>PROFIT</span>
                            </span>
                          ) : isGrossProfit ? (
                            <span 
                              className="px-1.5 py-0.5 border border-amber-600 bg-amber-50 text-amber-900 text-[9px] font-bold uppercase inline-flex items-center gap-0.5"
                              title="Gross price is above entry, but broker fees offset net profit"
                            >
                              <TrendingUp className="w-2.5 h-2.5" />
                              <span>NET LOSS (FEES)</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 border border-rose-700 bg-rose-50 text-rose-800 text-[9px] font-bold uppercase inline-flex items-center gap-0.5">
                              <TrendingDown className="w-2.5 h-2.5" />
                              <span>LOSS</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#111111]/70 font-news truncate max-w-[200px] mt-0.5">
                          {h.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#111111] text-base tabular-nums">
                          {sym}{currentVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-[11px] font-bold ${isNetProfit ? 'text-emerald-800' : 'text-red-800'}`}>
                          {isNetProfit ? '+' : ''}{sym}{netPnL.toFixed(2)} ({isNetProfit ? '+' : ''}{netPercent.toFixed(2)}% Net)
                        </div>
                        <div className="text-[9px] text-neutral-500 font-mono">
                          Gross: {grossPnL >= 0 ? '+' : ''}{sym}{grossPnL.toFixed(2)} ({grossPercent >= 0 ? '+' : ''}{grossPercent.toFixed(2)}%) • Fees: {sym}{estFees.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Integrated Mini Line Graph with Entry Line */}
                    <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300 flex items-center justify-between gap-2">
                      <div className="text-[10px]">
                        <span className="text-neutral-500 uppercase block font-bold">Trend (Entry vs Live):</span>
                        {isAbove ? (
                          <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Above Entry (+)</span>
                          </span>
                        ) : isBelow ? (
                          <span className="font-bold text-rose-700 inline-flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            <span>Below Entry (-)</span>
                          </span>
                        ) : (
                          <span className="font-bold text-neutral-600 inline-flex items-center gap-1">
                            <span>At Entry (0.00)</span>
                          </span>
                        )}
                        <div className="text-[9px] text-neutral-500 mt-0.5 font-mono">
                          Spread: {perShareGrossPnL >= 0 ? '+' : ''}{sym}{perShareGrossPnL.toFixed(2)}/sh
                        </div>
                      </div>
                      <HoldingSparkline
                        symbol={h.symbol}
                        entryPrice={h.avgBuyPrice}
                        currentPrice={currentPrice}
                        width={125}
                        height={34}
                      />
                    </div>

                    {/* Prominent Entry Price, Live Price & Stop Risk Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#D8D2C4] text-[11px]">
                      <div className="p-2 bg-neutral-50 border border-neutral-200">
                        <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">ENTRY PRICE (AVG):</span>
                        <strong className="text-[#111111] text-sm font-bold block">{sym}{h.avgBuyPrice.toFixed(2)}</strong>
                        <span className="text-[9px] text-neutral-500">Invested: {sym}{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="p-2 bg-neutral-50 border border-neutral-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">LIVE PRICE (CMP):</span>
                          {isLiveActive ? (
                            <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100 px-1 py-0.2 border border-emerald-300">LIVE</span>
                          ) : isMarketClosed ? (
                            <span className="text-[8px] font-bold text-stone-600 bg-stone-100 px-1 py-0.2 border border-stone-300">CLOSED</span>
                          ) : (
                            <span className="text-[8px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 border border-amber-300">STALE</span>
                          )}
                        </div>
                        <strong className="text-[#111111] text-sm font-bold block flex items-center gap-1 mt-0.5">
                          {isLiveActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ) : isMarketClosed ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          )}
                          <span>{sym}{currentPrice.toFixed(2)}</span>
                        </strong>
                        <span className="text-[9px] text-neutral-500 block">
                          {isLiveActive ? `As-of: ${freshness.asOf}` : isMarketClosed ? `Last Mark: ${freshness.asOf}` : `Delayed: ${freshness.asOf}`} • {h.quantity} shares
                        </span>
                      </div>

                      {/* Stop-Loss Risk Metric Strip */}
                      <div className="col-span-2 p-2 bg-rose-50/60 border border-rose-200 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                          <div>
                            <span className="font-bold text-rose-950 uppercase">Stop Level:</span>{' '}
                            <span className="font-bold text-[#111111]">{sym}{acct.effectiveStopLoss.toFixed(2)}</span>{' '}
                            <span className="text-neutral-500">(-{acct.distanceToStopPct}%)</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-rose-900 font-bold uppercase text-[9px] block">Stop Risk:</span>
                          <span className="font-bold text-rose-800 text-xs tabular-nums">
                            {sym}{acct.totalRiskAtStop.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons on Mobile */}
                    <div className="pt-2 flex items-center gap-2">
                      <Link
                        to={`/stock/${encodeURIComponent(h.symbol)}`}
                        className="flex-1 py-2 bg-white border border-[#111111] text-[#111111] font-bold text-center flex items-center justify-center gap-1 min-h-[44px]"
                      >
                        <ExternalLink className="w-3 h-3 text-[#111111]" />
                        <span>Chart</span>
                      </Link>
                      <button
                        onClick={() => openTrade(h.symbol, 'BUY')}
                        className="flex-1 py-2 bg-[#111111] text-[#F6F4EE] font-bold text-center flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Buy</span>
                      </button>
                      <button
                        onClick={() => openTrade(h.symbol, 'SELL')}
                        className="flex-1 py-2 bg-white border border-[#111111] text-red-900 font-bold text-center flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                      >
                        <Minus className="w-3 h-3" />
                        <span>Sell</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop & Tablet Table View (Screens >= 640px) */}
            <div className="hidden sm:block overflow-x-auto bg-white">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#111111] text-[#F6F4EE] uppercase tracking-wider text-[11px] border-b-2 border-[#111111]">
                  <tr>
                    <th className="py-3 px-3">Asset</th>
                    <th className="py-3 px-2 text-center">Market</th>
                    <th className="py-3 px-2 text-right">Shares</th>
                    <th className="py-3 px-3 text-right">Entry Price</th>
                    <th className="py-3 px-3 text-right">Live Price (CMP)</th>
                    <th className="py-3 px-3 text-center">Trend & Entry Ref</th>
                    <th className="py-3 px-3 text-right">Stop-Loss Risk</th>
                    <th className="py-3 px-3 text-right">Current Value</th>
                    <th className="py-3 px-3 text-right">Unrealized P&L (Net / Gross)</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8D2C4]">
                  {filteredHoldings.map((h) => {
                    const isInd = h.market === 'NSE' || h.currency === 'INR' || h.symbol?.endsWith('.NS') || h.symbol?.endsWith('.BO');
                    const sym = isInd ? '₹' : '$';
                    const quote = livePrices[h.symbol];
                    const currentPrice = Number(quote?.price || h.avgBuyPrice);
                    const currentVal = Number((h.quantity * currentPrice).toFixed(2));
                    const totalCost = Number(h.totalCost || (h.quantity * h.avgBuyPrice));

                    const marketStatus = isMarketOpenForSymbol(h.symbol);
                    const freshness = getQuoteFreshness(quote);

                    const acct = computeFloatingPositionAccounting({
                      avgBuyPrice: h.avgBuyPrice,
                      livePrice: currentPrice,
                      quantity: h.quantity,
                      market: isInd ? 'NSE' : 'US',
                      totalCost,
                      stopLossPrice: h.stopLossPrice,
                      quoteTimestamp: quote?.timestamp,
                      isFresh: !freshness.isStale && marketStatus.isOpen,
                    });

                    const netPnL = acct.floatingNetPnL;
                    const netPercent = acct.netReturnPercent;
                    const grossPnL = acct.floatingGrossPnL;
                    const grossPercent = acct.grossReturnPercent;
                    const estFees = acct.allocatedEntryCharges;
                    const perShareGrossPnL = acct.perShareGrossPnL;

                    const isNetProfit = acct.isProfitable;
                    const isGrossProfit = acct.isGrossProfitable;
                    const isAbove = acct.isAboveEntry;
                    const isBelow = acct.isBelowEntry;

                    const isLiveActive = marketStatus.isOpen && !freshness.isStale;
                    const isMarketClosed = !marketStatus.isOpen;

                    return (
                      <tr
                        key={h.symbol}
                        onClick={() => inspectStock(h.symbol)}
                        className={`hover:bg-[#F6F4EE] transition-colors cursor-pointer ${
                          inspectedSymbol === h.symbol ? 'bg-amber-100/60 font-medium' : ''
                        }`}
                      >
                        {/* 1. Asset & Name */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#111111] flex items-center gap-1.5">
                            <span>{h.symbol}</span>
                            <LineChart className="w-3.5 h-3.5 text-stone-400" />
                          </div>
                          <div className="text-[11px] text-[#111111]/70 font-news truncate max-w-[140px]">
                            {h.name}
                          </div>
                        </td>

                        {/* 2. Market Badge */}
                        <td className="py-3 px-2 text-center">
                          <span className="px-1.5 py-0.5 bg-[#EFECE3] border border-[#111111] text-[10px] font-bold">
                            {h.market || (isInd ? 'NSE' : 'US')}
                          </span>
                        </td>

                        {/* 3. Shares Qty */}
                        <td className="py-3 px-2 text-right font-bold text-[#111111] tabular-nums">
                          {h.quantity}
                        </td>

                        {/* 4. Entry Price (Avg Cost per share + Total Invested Cost Basis) */}
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="font-bold text-[#111111] text-sm">
                            {sym}{h.avgBuyPrice.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            Cost: {sym}{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* 5. Live Price (CMP + Market Telemetry + Spread) */}
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="font-bold text-[#111111] text-sm flex items-center justify-end gap-1">
                            {isLiveActive ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live Floor Stream" />
                            ) : isMarketClosed ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" title="Exchange Closed" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Delayed / Stale Mark" />
                            )}
                            <span>{sym}{currentPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[9px] mt-0.5">
                            {isLiveActive ? (
                              <span className="text-emerald-700 font-bold uppercase">LIVE • {freshness.asOf}</span>
                            ) : isMarketClosed ? (
                              <span className="text-stone-500 font-bold uppercase">CLOSED • {freshness.asOf}</span>
                            ) : (
                              <span className="text-amber-700 font-bold uppercase">STALE • {freshness.asOf}</span>
                            )}
                          </div>
                          <div className={`text-[10px] font-bold mt-0.5 ${isAbove ? 'text-emerald-700' : isBelow ? 'text-rose-700' : 'text-neutral-500'}`}>
                            {isAbove ? '+' : ''}{sym}{perShareGrossPnL.toFixed(2)} / sh
                          </div>
                        </td>

                        {/* 6. Mini Line Graph (Up/Down Trend with Dashed Entry Price Reference) */}
                        <td className="py-3 px-3 text-center">
                          <HoldingSparkline
                            symbol={h.symbol}
                            entryPrice={h.avgBuyPrice}
                            currentPrice={currentPrice}
                            width={105}
                            height={30}
                          />
                          <div className="text-[9px] font-bold uppercase mt-0.5">
                            {isAbove ? (
                              <span className="text-emerald-700 inline-flex items-center gap-0.5">
                                <TrendingUp className="w-2.5 h-2.5" /> Above Entry
                              </span>
                            ) : isBelow ? (
                              <span className="text-rose-700 inline-flex items-center gap-0.5">
                                <TrendingDown className="w-2.5 h-2.5" /> Below Entry
                              </span>
                            ) : (
                              <span className="text-neutral-500 inline-flex items-center gap-0.5">
                                At Entry (0.00)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 7. Stop-Loss Risk (Dedicated Column) */}
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="font-bold text-[#111111] text-xs">
                            {sym}{acct.effectiveStopLoss.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-neutral-500">
                            Buffer: -{acct.distanceToStopPct}%
                          </div>
                          <div className="text-[10px] font-bold text-rose-800 mt-0.5">
                            Max Loss: {sym}{acct.totalRiskAtStop.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* 8. Current Market Value */}
                        <td className="py-3 px-3 text-right font-bold text-[#111111] tabular-nums text-sm">
                          {sym}{currentVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* 9. Profit & Loss Mode */}
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-1 mb-0.5">
                            {isNetProfit ? (
                              <span className="px-1.5 py-0.2 border bg-emerald-50 border-emerald-700 text-emerald-800 text-[9px] font-bold uppercase inline-flex items-center gap-0.5">
                                <TrendingUp className="w-2.5 h-2.5" />
                                <span>PROFIT</span>
                              </span>
                            ) : isGrossProfit ? (
                              <span 
                                className="px-1.5 py-0.2 border bg-amber-50 border-amber-600 text-amber-900 text-[9px] font-bold uppercase inline-flex items-center gap-0.5"
                                title="Gross trade profitable; broker fees offset net profit"
                              >
                                <TrendingUp className="w-2.5 h-2.5" />
                                <span>NET LOSS (FEES)</span>
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 border bg-rose-50 border-rose-700 text-rose-800 text-[9px] font-bold uppercase inline-flex items-center gap-0.5">
                                <TrendingDown className="w-2.5 h-2.5" />
                                <span>LOSS</span>
                              </span>
                            )}
                          </div>
                          <div className={`font-bold text-sm ${isNetProfit ? 'text-emerald-800' : 'text-red-800'}`}>
                            {isNetProfit ? '+' : ''}{sym}{netPnL.toFixed(2)}
                          </div>
                          <div className={`text-[10px] font-bold ${isNetProfit ? 'text-emerald-700' : 'text-red-700'}`}>
                            ({isNetProfit ? '+' : ''}{netPercent.toFixed(2)}% Net)
                          </div>
                          <div className="text-[9px] text-neutral-500 font-mono mt-0.5">
                            Gross: {grossPnL >= 0 ? '+' : ''}{sym}{grossPnL.toFixed(2)} ({grossPercent >= 0 ? '+' : ''}{grossPercent.toFixed(2)}%) • Fees: {sym}{estFees.toFixed(2)}
                          </div>
                        </td>

                        {/* 10. Action Buttons */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              to={`/stock/${encodeURIComponent(h.symbol)}`}
                              title="Open Full Stock Trading Page & URL"
                              className="px-2 py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] text-[11px] flex items-center gap-1 font-bold transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Chart</span>
                            </Link>
                            <button
                              onClick={() => openTrade(h.symbol, 'BUY')}
                              title="Buy More Shares"
                              className="px-2 py-1 bg-[#111111] text-[#F6F4EE] hover:bg-stone-800 text-[11px] flex items-center gap-0.5 font-bold cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Buy</span>
                            </button>
                            <button
                              onClick={() => openTrade(h.symbol, 'SELL')}
                              title="Sell Shares"
                              className="px-2 py-1 bg-white border border-[#111111] text-red-900 hover:bg-red-100 text-[11px] flex items-center gap-0.5 font-bold cursor-pointer transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                              <span>Sell</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Search & Fetch Any Global Equities (Indian & US Markets) */}
      <div className="newspaper-photo-plate p-5 mb-8 bg-[#FAF8F3]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b-2 border-[#111111]">
          <div>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-[#111111]" />
              <h3 className="font-headline uppercase font-black text-xl sm:text-2xl text-[#111111] tracking-tight">
                GLOBAL MARKET SEARCH & INSTANT FETCHER
              </h3>
            </div>
            <p className="text-xs font-mono text-[#111111]/70 uppercase tracking-wider mt-0.5">
              SEARCH & FETCH ANY EQUITY ON NSE, BSE, NASDAQ, NYSE, AMEX • LIVE PRICES • 1-CLICK WATCHLIST
            </p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#111111]/50" />
            <input
              type="text"
              placeholder="Search any ticker (e.g. TATAPOWER, PLTR, SBIN, AAPL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white border-2 border-[#111111] focus:bg-[#FAF8F3] text-xs font-mono outline-none min-h-[44px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 p-1 text-[#111111]/60 hover:text-[#111111] cursor-pointer"
                title="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Search Results */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-4 pt-2">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#111111]">
                  RESULTS FOR "{searchQuery}" ({searchResults.length})
                </span>
                {isSearching && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-300 text-stone-900 border border-amber-500 animate-pulse">
                    Scanning Exchanges...
                  </span>
                )}
              </div>
            </div>

            {searchResults.length === 0 && !isSearching ? (
              <div className="p-8 text-center bg-white border-2 border-[#111111] font-mono text-xs">
                <p className="font-bold text-[#111111] text-sm">NO DIRECT SYMBOL MATCH FOUND</p>
                <p className="text-[#111111]/70 mt-1 font-news text-sm">
                  Try typing the exact ticker with exchange suffix (e.g. <span className="font-mono font-bold">TATAPOWER.NS</span> for Indian NSE, or <span className="font-mono font-bold">PLTR</span> for US).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((stock) => {
                  const quote = livePrices[stock.symbol];
                  const price = quote?.price || stock.basePrice || 100;
                  const changePercent = quote?.changePercent ?? 0;
                  const isInd = stock.market === 'NSE' || stock.currency === 'INR';
                  const sym = isInd ? '₹' : '$';
                  const inWatchlist = isStockInWatchlist(stock.symbol, stock.market);

                  return (
                    <div
                      key={stock.symbol}
                      onClick={() => inspectStock(stock.symbol)}
                      className={`p-3.5 bg-white border-2 border-[#111111] hover:bg-[#FAF8F3] transition-all flex flex-col justify-between cursor-pointer ${
                        inspectedSymbol === stock.symbol ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#111111] text-base">{stock.ticker}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase">
                              {stock.market}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleWatchlistToggle(e, stock.symbol, stock.market, stock.sector)}
                            title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                            className={`p-1.5 border border-[#111111] transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center ${
                              inWatchlist
                                ? 'bg-amber-400 text-[#111111]'
                                : 'bg-white hover:bg-amber-100 text-[#111111]'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-[#111111]' : ''}`} />
                          </button>
                        </div>
                        <div className="text-xs text-[#111111]/70 font-news truncate mt-1" title={stock.name}>
                          {stock.name}
                        </div>
                        <div className="text-[10px] text-[#111111]/50 font-mono mt-0.5">
                          {stock.exchange || stock.sector || 'Equities'}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#D8D2C4] flex items-center justify-between font-mono">
                        <div>
                          <div className="font-bold text-[#111111] text-sm tabular-nums">
                            {sym}{typeof price === 'number' ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price}
                          </div>
                          <div className={`text-[10px] font-bold ${changePercent >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                            {changePercent >= 0 ? '+' : ''}{changePercent}%
                          </div>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/stock/${encodeURIComponent(stock.symbol)}`}
                            className="px-2 py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] text-[11px] font-mono font-bold flex items-center gap-1 transition-colors min-h-[34px]"
                            title="Detailed Candlestick Graph"
                          >
                            <span>Chart</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => openTrade(stock.symbol, 'BUY')}
                            className="px-2.5 py-1 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] text-[11px] font-mono font-bold transition-colors cursor-pointer min-h-[34px]"
                          >
                            Trade
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Your Personalized Watchlist Section */}
      <div className="newspaper-photo-plate p-5 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b-2 border-[#111111]">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              <h3 className="font-headline uppercase font-black text-xl sm:text-2xl text-[#111111] tracking-tight">
                PERSONALIZED WATCHLIST ({displayedWatchlistSymbols.length})
              </h3>
            </div>
            <p className="text-xs font-mono text-[#111111]/70 uppercase tracking-wider mt-0.5">
              LOCAL-FIRST PERSISTENCE • LIVE SWR CACHE • 1-CLICK INSTANT BUY & SELL
            </p>
          </div>
        </div>

        {displayedWatchlistSymbols.length === 0 ? (
          <div className="p-8 text-center bg-white border-2 border-dashed border-[#111111]/40 mt-4">
            <Star className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-50" />
            <h4 className="font-headline uppercase font-bold text-lg text-[#111111]">YOUR WATCHLIST IS EMPTY</h4>
            <p className="font-news text-sm text-[#111111]/75 max-w-md mx-auto mt-1">
              Add your favorite stocks to track them live here. Search any ticker above or click the star on benchmark leaders below.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => addToWatchlist('RELIANCE.NS', 'NSE', 'Energy & Retail')}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] font-bold"
              >
                ⭐ + Star Reliance (₹)
              </button>
              <button
                type="button"
                onClick={() => addToWatchlist('AAPL', 'US', 'Consumer Tech')}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] font-bold"
              >
                ⭐ + Star Apple ($)
              </button>
              <button
                type="button"
                onClick={() => addToWatchlist('NVDA', 'US', 'Semiconductors')}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] font-bold"
              >
                ⭐ + Star Nvidia ($)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {displayedWatchlistSymbols.map((sym) => {
              const stock = resolveStockMeta(sym);
              const quote = livePrices[sym];
              const price = quote?.price || stock.basePrice || 100;
              const changePercent = quote?.changePercent ?? 0;
              const isInd = stock.market === 'NSE' || sym.endsWith('.NS') || sym.endsWith('.BO');
              const currencySymbol = isInd ? '₹' : '$';

              return (
                <div
                  key={sym}
                  onClick={() => inspectStock(sym)}
                  className={`p-3.5 bg-white border-2 border-[#111111] hover:bg-[#FAF8F3] transition-all flex flex-col justify-between cursor-pointer ${
                    inspectedSymbol === sym ? 'bg-amber-50 shadow-xs' : ''
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#111111] text-base">{stock.ticker}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase">
                          {stock.market}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleWatchlistToggle(e, sym, stock.market, stock.sector)}
                        title="Remove from Watchlist"
                        className="p-1.5 bg-amber-400 hover:bg-amber-300 text-[#111111] border border-[#111111] transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                      >
                        <Star className="w-3.5 h-3.5 fill-[#111111]" />
                      </button>
                    </div>
                    <div className="text-xs text-[#111111]/70 font-news truncate mt-1" title={stock.name}>
                      {stock.name}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#D8D2C4] flex items-center justify-between font-mono">
                    <div>
                      <div className="font-bold text-[#111111] text-base tabular-nums">
                        {currencySymbol}{typeof price === 'number' ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price}
                      </div>
                      <div className={`text-[11px] font-bold ${changePercent >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                        {changePercent >= 0 ? '+' : ''}{changePercent}%
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/stock/${encodeURIComponent(sym)}`}
                        className="px-2.5 py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] text-xs font-mono font-bold flex items-center gap-1 transition-colors min-h-[34px]"
                        title="View Detailed Trading Graphs & URL"
                      >
                        <span>Chart</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openTrade(sym, 'BUY')}
                        className="px-3 py-1 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] text-xs font-mono font-bold transition-colors cursor-pointer min-h-[34px]"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Featured Benchmark Leaders (Curated Top 6 per market instead of massive raw dump) */}
      <div className="newspaper-photo-plate p-5 mb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b-2 border-[#111111]">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-headline uppercase font-black text-xl sm:text-2xl text-[#111111] tracking-tight">
                FEATURED BENCHMARK LEADERS
              </h3>
            </div>
            <p className="text-xs font-mono text-[#111111]/70 uppercase tracking-wider mt-0.5">
              TOP LIQUIDITY PILLARS • 6 BENCHMARK ASSETS PER MARKET • CLICK TO INSPECT
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {featuredLeaders.map((stock) => {
            const quote = livePrices[stock.symbol];
            const price = quote?.price || stock.basePrice;
            const changePercent = quote?.changePercent ?? 0;
            const isInd = stock.market === 'NSE';
            const sym = isInd ? '₹' : '$';
            const inWatchlist = isStockInWatchlist(stock.symbol, stock.market);

            return (
              <div
                key={stock.symbol}
                onClick={() => inspectStock(stock.symbol)}
                className={`p-4 bg-white border-2 transition-all flex flex-col justify-between cursor-pointer ${
                  inspectedSymbol === stock.symbol ? 'border-[#111111] bg-amber-50 shadow-xs' : 'border-[#111111] hover:bg-[#FAF8F3]'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#111111] text-base">{stock.ticker}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase">
                        {stock.market}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleWatchlistToggle(e, stock.symbol, stock.market, stock.sector)}
                      title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      className={`p-1.5 border border-[#111111] transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center ${
                        inWatchlist
                          ? 'bg-amber-400 text-[#111111]'
                          : 'bg-white hover:bg-amber-100 text-[#111111]'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-[#111111]' : ''}`} />
                    </button>
                  </div>
                  <div className="text-xs text-[#111111]/70 font-news truncate mt-1" title={stock.name}>
                    {stock.name}
                  </div>
                  <div className="text-[10px] text-[#111111]/50 font-mono mt-0.5">
                    {stock.sector}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#D8D2C4] flex items-center justify-between font-mono">
                  <div>
                    <div className="font-bold text-[#111111] text-base tabular-nums">
                      {sym}{typeof price === 'number' ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price}
                    </div>
                    <div className={`text-[11px] font-bold ${
                      changePercent >= 0 ? 'text-emerald-800' : 'text-red-800'
                    }`}>
                      {changePercent >= 0 ? '+' : ''}{changePercent}%
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/stock/${encodeURIComponent(stock.symbol)}`}
                      className="px-2.5 py-1.5 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] text-xs font-mono font-bold flex items-center gap-1 transition-colors min-h-[36px]"
                      title="View Detailed Trading Graphs & URL"
                    >
                      <span>Chart</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openTrade(stock.symbol, 'BUY')}
                      className="px-3 py-1.5 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] text-xs font-mono font-bold transition-colors cursor-pointer min-h-[36px]"
                    >
                      Trade
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trade Execution Modal */}
      <TradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        initialSymbol={tradeModalSymbol}
        initialAction={tradeModalAction}
      />
    </div>
  );
}
