import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTradingTools } from '../context/TradingToolsContext';
import { getInstantInitialQuotes } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import { db } from '../lib/localDb';
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  Trash2, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  CheckCircle2, 
  Cloud, 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  X,
  Layers,
  Briefcase,
  Activity,
  Zap,
  Eye,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import AdsterraAdBanner from '../components/AdsterraAdBanner';

export default function TransactionsPage() {
  const { userProfile, revertOrder, clearOrderHistory, syncStatus, syncToCloud } = useAuth();
  const { openTradeModal } = useTradingTools();

  // Active View Tab: 'ALL_ORDERS' | 'CLOSED_EXITS' | 'ACTIVE_HOLDINGS'
  const [activeLedgerTab, setActiveLedgerTab] = useState('ALL_ORDERS');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | 'NSE' | 'US'
  const [actionFilter, setActionFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL' | 'REVERTED'
  const [pnlFilter, setPnlFilter] = useState('ALL'); // 'ALL' | 'PROFIT' | 'LOSS'
  const [sortBy, setSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'PNL_DESC'

  // Live Price Feed State for Real-Time Floating P&L
  const [livePrices, setLivePrices] = useState(() => getInstantInitialQuotes());

  // Dexie local journal entries (merged for 100% fidelity)
  const [journalEntries, setJournalEntries] = useState([]);

  // Modal states
  const [orderToRevert, setOrderToRevert] = useState(null);
  const [isReverting, setIsReverting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Subscribe to real-time market price updates
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      if (prices && Object.keys(prices).length > 0) {
        setLivePrices((prev) => ({ ...prev, ...prices }));
      }
    });

    // Also load local Dexie journal entries
    db.journal.toArray().then((items) => {
      if (items && items.length > 0) {
        setJournalEntries(items);
      }
    }).catch(() => {});

    return () => {
      unsubscribe();
    };
  }, []);

  // Normalize orders array from userProfile
  const rawOrders = useMemo(() => {
    if (!userProfile?.orders) return [];
    if (Array.isArray(userProfile.orders)) return userProfile.orders;
    return Object.values(userProfile.orders);
  }, [userProfile?.orders]);

  // Normalize holdings list from userProfile
  const holdingsList = useMemo(() => {
    return Object.values(userProfile?.holdings || {});
  }, [userProfile?.holdings]);

  // Compute live holding valuations
  const liveHoldingsDetailed = useMemo(() => {
    return holdingsList.map((h) => {
      const isNSE = h.market === 'NSE' || h.currency === 'INR' || h.symbol?.endsWith('.NS') || h.symbol?.endsWith('.BO');
      const liveData = livePrices[h.symbol];
      const livePrice = Number(liveData?.price || h.avgBuyPrice || 100);
      const cost = Number(h.totalCost || (h.quantity * h.avgBuyPrice));
      const currentVal = Number(h.quantity * livePrice);
      const unrealizedPnL = Number((currentVal - cost).toFixed(2));
      const returnPercent = cost > 0 ? Number(((unrealizedPnL / cost) * 100).toFixed(2)) : 0;
      const isProfit = unrealizedPnL >= 0;

      return {
        ...h,
        isNSE,
        currencySymbol: isNSE ? '₹' : '$',
        livePrice,
        cost,
        currentVal,
        unrealizedPnL,
        returnPercent,
        isProfit
      };
    });
  }, [holdingsList, livePrices]);

  // Filtered and Sorted Orders
  const filteredOrders = useMemo(() => {
    return rawOrders
      .filter((ord) => {
        // Tab-specific filter: If CLOSED_EXITS, only show SELL orders
        if (activeLedgerTab === 'CLOSED_EXITS') {
          if (ord.action !== 'SELL' || ord.status === 'REVERTED') return false;
        }

        // Search filter (symbol, name, or order ID)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchSym = ord.symbol?.toLowerCase().includes(q);
          const matchName = ord.name?.toLowerCase().includes(q);
          const matchId = ord.id?.toLowerCase().includes(q);
          if (!matchSym && !matchName && !matchId) return false;
        }

        // Market filter
        if (marketFilter !== 'ALL') {
          const isNSE = ord.market === 'NSE' || ord.currency === 'INR' || ord.symbol?.endsWith('.NS') || ord.symbol?.endsWith('.BO');
          if (marketFilter === 'NSE' && !isNSE) return false;
          if (marketFilter === 'US' && isNSE) return false;
        }

        // Action filter
        if (actionFilter === 'REVERTED') {
          if (ord.status !== 'REVERTED' && ord.action !== 'REVERTED') return false;
        } else if (actionFilter !== 'ALL') {
          if (ord.action !== actionFilter || ord.status === 'REVERTED') return false;
        }

        // PnL filter (applies primarily to SELL orders)
        if (pnlFilter === 'PROFIT') {
          if (ord.action !== 'SELL' || (ord.realizedPnL || 0) <= 0) return false;
        } else if (pnlFilter === 'LOSS') {
          if (ord.action !== 'SELL' || (ord.realizedPnL || 0) >= 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        if (sortBy === 'DATE_DESC') return timeB - timeA;
        if (sortBy === 'DATE_ASC') return timeA - timeB;
        if (sortBy === 'AMOUNT_DESC') return (b.totalAmount || 0) - (a.totalAmount || 0);
        if (sortBy === 'PNL_DESC') return (b.realizedPnL || 0) - (a.realizedPnL || 0);
        return timeB - timeA;
      });
  }, [rawOrders, searchTerm, marketFilter, actionFilter, pnlFilter, sortBy, activeLedgerTab]);

  // Filtered Holdings
  const filteredHoldings = useMemo(() => {
    return liveHoldingsDetailed.filter((h) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSym = h.symbol?.toLowerCase().includes(q);
        const matchName = h.name?.toLowerCase().includes(q);
        if (!matchSym && !matchName) return false;
      }
      if (marketFilter === 'NSE' && !h.isNSE) return false;
      if (marketFilter === 'US' && h.isNSE) return false;
      if (pnlFilter === 'PROFIT' && !h.isProfit) return false;
      if (pnlFilter === 'LOSS' && h.isProfit) return false;
      return true;
    });
  }, [liveHoldingsDetailed, searchTerm, marketFilter, pnlFilter]);

  // Comprehensive Metrics Computation
  const stats = useMemo(() => {
    let totalTrades = rawOrders.length;
    let filledBuys = 0;
    let filledSells = 0;
    let revertedCount = 0;

    let closedWinsInr = 0;
    let closedLossesInr = 0;
    let closedWinsUsd = 0;
    let closedLossesUsd = 0;

    let orderRealizedPnLInr = 0;
    let orderRealizedPnLUsd = 0;

    let totalVolumeInr = 0;
    let totalVolumeUsd = 0;

    // 1. Process Order Ledger
    rawOrders.forEach((ord) => {
      const isReverted = ord.status === 'REVERTED' || ord.action === 'REVERTED';
      if (isReverted) {
        revertedCount++;
        return;
      }

      const isNSE = ord.market === 'NSE' || ord.currency === 'INR' || ord.symbol?.endsWith('.NS') || ord.symbol?.endsWith('.BO');
      const amount = ord.totalAmount || 0;

      if (isNSE) totalVolumeInr += amount;
      else totalVolumeUsd += amount;

      if (ord.action === 'BUY') {
        filledBuys++;
      } else if (ord.action === 'SELL') {
        filledSells++;
        const pnl = ord.realizedPnL || 0;
        if (isNSE) {
          orderRealizedPnLInr += pnl;
          if (pnl > 0) closedWinsInr++;
          else if (pnl < 0) closedLossesInr++;
        } else {
          orderRealizedPnLUsd += pnl;
          if (pnl > 0) closedWinsUsd++;
          else if (pnl < 0) closedLossesUsd++;
        }
      }
    });

    // 2. Wallets Booked P&L (reconciles with wallet state)
    const walletRealizedInr = userProfile?.wallets?.inr?.realizedPnL || 0;
    const walletRealizedUsd = userProfile?.wallets?.usd?.realizedPnL || 0;

    const realizedPnLInr = orderRealizedPnLInr !== 0 ? orderRealizedPnLInr : walletRealizedInr;
    const realizedPnLUsd = orderRealizedPnLUsd !== 0 ? orderRealizedPnLUsd : walletRealizedUsd;

    // 3. Active Holdings & Floating Unrealized P&L
    let openWinsInr = 0;
    let openLossesInr = 0;
    let openWinsUsd = 0;
    let openLossesUsd = 0;
    let inrUnrealizedPnL = 0;
    let usdUnrealizedPnL = 0;
    let inrHoldingsVal = 0;
    let usdHoldingsVal = 0;

    liveHoldingsDetailed.forEach((h) => {
      if (h.isNSE) {
        inrUnrealizedPnL += h.unrealizedPnL;
        inrHoldingsVal += h.currentVal;
        if (h.unrealizedPnL >= 0) openWinsInr++;
        else openLossesInr++;
      } else {
        usdUnrealizedPnL += h.unrealizedPnL;
        usdHoldingsVal += h.currentVal;
        if (h.unrealizedPnL >= 0) openWinsUsd++;
        else openLossesUsd++;
      }
    });

    // 4. Net P&L = Realized (Settled) + Floating (Unrealized)
    const netPnLInr = realizedPnLInr + inrUnrealizedPnL;
    const netPnLUsd = realizedPnLUsd + usdUnrealizedPnL;

    // 5. Intelligent Win Rate Formulation
    const closedWinsTotal = closedWinsInr + closedWinsUsd;
    const closedLossesTotal = closedLossesInr + closedLossesUsd;
    const closedTradesTotal = closedWinsTotal + closedLossesTotal;

    const openWinsTotal = openWinsInr + openWinsUsd;
    const openLossesTotal = openLossesInr + openLossesUsd;
    const openHoldingsTotal = openWinsTotal + openLossesTotal;

    // Market-specific win rate helper
    const getMarketWinRate = (marketKey) => {
      if (marketKey === 'NSE') {
        const cTotal = closedWinsInr + closedLossesInr;
        if (cTotal > 0) return { rate: ((closedWinsInr / cTotal) * 100).toFixed(1), wins: closedWinsInr, losses: closedLossesInr, isFloating: false, count: cTotal };
        const oTotal = openWinsInr + openLossesInr;
        if (oTotal > 0) return { rate: ((openWinsInr / oTotal) * 100).toFixed(1), wins: openWinsInr, losses: openLossesInr, isFloating: true, count: oTotal };
        return { rate: '0.0', wins: 0, losses: 0, isFloating: false, count: 0 };
      }
      if (marketKey === 'US') {
        const cTotal = closedWinsUsd + closedLossesUsd;
        if (cTotal > 0) return { rate: ((closedWinsUsd / cTotal) * 100).toFixed(1), wins: closedWinsUsd, losses: closedLossesUsd, isFloating: false, count: cTotal };
        const oTotal = openWinsUsd + openLossesUsd;
        if (oTotal > 0) return { rate: ((openWinsUsd / oTotal) * 100).toFixed(1), wins: openWinsUsd, losses: openLossesUsd, isFloating: true, count: oTotal };
        return { rate: '0.0', wins: 0, losses: 0, isFloating: false, count: 0 };
      }
      // ALL MARKETS
      if (closedTradesTotal > 0) {
        return { rate: ((closedWinsTotal / closedTradesTotal) * 100).toFixed(1), wins: closedWinsTotal, losses: closedLossesTotal, isFloating: false, count: closedTradesTotal };
      }
      if (openHoldingsTotal > 0) {
        return { rate: ((openWinsTotal / openHoldingsTotal) * 100).toFixed(1), wins: openWinsTotal, losses: openLossesTotal, isFloating: true, count: openHoldingsTotal };
      }
      return { rate: '0.0', wins: 0, losses: 0, isFloating: false, count: 0 };
    };

    const activeWinRate = getMarketWinRate(marketFilter);

    return {
      totalTrades,
      filledBuys,
      filledSells,
      revertedCount,
      closedTradesTotal,
      closedWinsTotal,
      closedLossesTotal,
      openHoldingsTotal,
      openWinsTotal,
      openLossesTotal,
      activeWinRate,
      realizedPnLInr,
      realizedPnLUsd,
      inrUnrealizedPnL,
      usdUnrealizedPnL,
      netPnLInr,
      netPnLUsd,
      inrHoldingsVal,
      usdHoldingsVal,
      totalVolumeInr,
      totalVolumeUsd,
      closedWinsInr,
      closedLossesInr,
      closedWinsUsd,
      closedLossesUsd,
      openWinsInr,
      openLossesInr,
      openWinsUsd,
      openLossesUsd
    };
  }, [rawOrders, liveHoldingsDetailed, userProfile?.wallets, marketFilter]);

  // Confirm Revert Execution
  const handleConfirmRevert = async () => {
    if (!orderToRevert) return;
    setIsReverting(true);
    try {
      await revertOrder(orderToRevert.id);
      toast.success(`Trade ${orderToRevert.symbol} (${orderToRevert.action}) successfully reverted.`);
      setOrderToRevert(null);
    } catch (err) {
      toast.error(err.message || 'Failed to revert trade.');
    } finally {
      setIsReverting(false);
    }
  };

  // Confirm Clear All Trade History
  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await clearOrderHistory();
      toast.success('Paper trade ledger successfully cleared.');
      setShowClearConfirm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to clear order history.');
    } finally {
      setIsClearing(false);
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (rawOrders.length === 0 && liveHoldingsDetailed.length === 0) {
      toast.error('No orders available to export.');
      return;
    }

    const headers = [
      'Order ID',
      'Date & Time (UTC)',
      'Symbol',
      'Company Name',
      'Market',
      'Action',
      'Quantity',
      'Price',
      'Currency',
      'Total Amount',
      'Realized P&L',
      'Return %',
      'Status'
    ];

    const rows = rawOrders.map((ord) => [
      ord.id,
      new Date(ord.timestamp || Date.now()).toISOString(),
      `"${ord.symbol || ''}"`,
      `"${(ord.name || '').replace(/"/g, '""')}"`,
      ord.market || (ord.symbol?.endsWith('.NS') ? 'NSE' : 'US'),
      ord.action,
      ord.quantity,
      ord.price,
      ord.currency || (ord.symbol?.endsWith('.NS') ? 'INR' : 'USD'),
      ord.totalAmount,
      ord.realizedPnL ?? '',
      ord.returnPercent ?? '',
      ord.status || 'FILLED'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trade_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Trade ledger exported as CSV.');
  };

  // Export as JSON
  const handleExportJSON = () => {
    if (rawOrders.length === 0 && liveHoldingsDetailed.length === 0) {
      toast.error('No orders available to export.');
      return;
    }
    const exportData = {
      exportedAt: new Date().toISOString(),
      summary: {
        winRate: `${stats.activeWinRate.rate}%`,
        realizedPnLInr: stats.realizedPnLInr,
        realizedPnLUsd: stats.realizedPnLUsd,
        unrealizedPnLInr: stats.inrUnrealizedPnL,
        unrealizedPnLUsd: stats.usdUnrealizedPnL,
        netPnLInr: stats.netPnLInr,
        netPnLUsd: stats.netPnLUsd,
      },
      orders: rawOrders,
      activeHoldings: liveHoldingsDetailed
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `trade_ledger_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Trade ledger exported as JSON.');
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-[#111111] font-sans pb-16">
      {/* Broadsheet Masthead Header */}
      <div className="border-b-4 border-double border-[#111111] bg-[#FAF8F3] py-6 px-4 sm:px-6 print:py-2">
        <div className="max-w-7xl mx-auto space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest uppercase text-stone-600">
                <History className="w-4 h-4 text-[#111111]" />
                <span>OFFICIAL PERFORMANCE & AUDIT RECORD • DUAL-MARKET ENGINE</span>
              </div>
              <h1 className="font-headline text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#111111] mt-1">
                Paper Trading Transaction History
              </h1>
              <p className="font-news text-xs sm:text-sm text-stone-700 max-w-2xl mt-1">
                Permanent, auditable record of all virtual order executions with instant local settlement,
                reversible corrections, live floating valuations, and cross-device Firebase Cloud synchronization.
              </p>
            </div>

            {/* Quick Actions / Export Buttons */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-stone-100 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#111111]"
                title="Export transactions to RFC-compliant CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-stone-100 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#111111]"
                title="Export transactions as structured JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-stone-100 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#111111]"
                title="Print Broadsheet Ledger"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              {rawOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-800 text-rose-900 hover:bg-rose-100 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Clear paper trading order history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Market Spotlight Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-2 border-[#111111] p-2.5 sm:p-3 shadow-[2px_2px_0px_#111111]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-stone-500">
              Exchange Filter:
            </span>
            <div className="inline-flex border border-[#111111] bg-[#FAF8F3] p-0.5 font-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => setMarketFilter('ALL')}
                className={`px-3 py-1 transition-colors cursor-pointer ${
                  marketFilter === 'ALL'
                    ? 'bg-[#111111] text-[#F6F4EE]'
                    : 'text-stone-700 hover:bg-stone-200'
                }`}
              >
                All Markets
              </button>
              <button
                type="button"
                onClick={() => setMarketFilter('NSE')}
                className={`px-3 py-1 transition-colors cursor-pointer flex items-center gap-1 ${
                  marketFilter === 'NSE'
                    ? 'bg-emerald-800 text-white'
                    : 'text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>🇮🇳 NSE India (₹)</span>
              </button>
              <button
                type="button"
                onClick={() => setMarketFilter('US')}
                className={`px-3 py-1 transition-colors cursor-pointer flex items-center gap-1 ${
                  marketFilter === 'US'
                    ? 'bg-blue-800 text-white'
                    : 'text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>🇺🇸 US Markets ($)</span>
              </button>
            </div>
          </div>

          {/* Live Floor Ticker Pulse */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-stone-600">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>Live Floor Stream Connected</span>
            <span className="text-stone-300">•</span>
            <span>{stats.openHoldingsTotal} Open Holdings Tracked</span>
          </div>
        </div>

        {/* Dynamic Multi-Market Performance Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Card 1: Intelligent Win Rate */}
          <div className="p-3.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-stone-500">
                {stats.activeWinRate.isFloating ? 'Floating Win Rate' : 'Closed Win Rate'}
              </span>
              <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold border ${
                stats.activeWinRate.isFloating
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : Number(stats.activeWinRate.rate) >= 50
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-stone-100 text-stone-700 border-stone-300'
              }`}>
                {stats.activeWinRate.isFloating ? 'OPEN PORTFOLIO' : 'REALIZED'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${
                Number(stats.activeWinRate.rate) > 0 ? 'text-emerald-800' : 'text-stone-900'
              }`}>
                {stats.activeWinRate.rate}%
              </span>
              <span className="text-[11px] font-mono text-stone-600">
                {stats.activeWinRate.wins}W • {stats.activeWinRate.losses}L
              </span>
            </div>

            <p className="text-[10px] font-mono text-stone-500 truncate">
              {stats.activeWinRate.isFloating ? (
                <span>{stats.activeWinRate.wins} of {stats.activeWinRate.count} active positions currently in profit</span>
              ) : (
                <span>{stats.activeWinRate.count} closed trade exits settled</span>
              )}
            </p>
          </div>

          {/* Card 2: Realized & Net P&L (NSE India) */}
          <div className={`p-3.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] space-y-1 ${
            marketFilter === 'US' ? 'opacity-60' : ''
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-stone-500">
                Realized P&L (NSE)
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-stone-100 border border-stone-300 text-stone-700">
                🇮🇳 INR
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${
                stats.realizedPnLInr >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                {stats.realizedPnLInr >= 0 ? '+' : ''}₹{stats.realizedPnLInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-stone-500">
                Settled
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono pt-0.5 border-t border-dashed border-stone-200">
              <span className="text-stone-600">Floating Unrealized:</span>
              <strong className={stats.inrUnrealizedPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {stats.inrUnrealizedPnL >= 0 ? '+' : ''}₹{stats.inrUnrealizedPnL.toFixed(2)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-stone-900 font-bold">Total Net P&L:</span>
              <strong className={`font-bold ${stats.netPnLInr >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                {stats.netPnLInr >= 0 ? '+' : ''}₹{stats.netPnLInr.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Card 3: Realized & Net P&L (US Markets) */}
          <div className={`p-3.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] space-y-1 ${
            marketFilter === 'NSE' ? 'opacity-60' : ''
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-stone-500">
                Realized P&L (US)
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-stone-100 border border-stone-300 text-stone-700">
                🇺🇸 USD
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${
                stats.realizedPnLUsd >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                {stats.realizedPnLUsd >= 0 ? '+' : ''}${stats.realizedPnLUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-stone-500">
                Settled
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono pt-0.5 border-t border-dashed border-stone-200">
              <span className="text-stone-600">Floating Unrealized:</span>
              <strong className={stats.usdUnrealizedPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {stats.usdUnrealizedPnL >= 0 ? '+' : ''}${stats.usdUnrealizedPnL.toFixed(2)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-stone-900 font-bold">Total Net P&L:</span>
              <strong className={`font-bold ${stats.netPnLUsd >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                {stats.netPnLUsd >= 0 ? '+' : ''}${stats.netPnLUsd.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Card 4: Gross Volume & Executions */}
          <div className="p-3.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-stone-500">
                Gross Traded Turnover
              </span>
              <span className="text-[10px] font-mono text-stone-500 font-bold">
                {stats.totalTrades} Orders
              </span>
            </div>

            <div className="space-y-0.5 pt-1">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-stone-600 font-semibold">NSE India:</span>
                <span className="font-bold text-stone-900">
                  ₹{stats.totalVolumeInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-stone-600 font-semibold">US Markets:</span>
                <span className="font-bold text-stone-900">
                  ${stats.totalVolumeUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-dashed border-stone-200 text-[10px] font-mono text-stone-500 flex justify-between">
              <span>Reverted Orders: {stats.revertedCount}</span>
              <span>Open Holdings: {stats.openHoldingsTotal}</span>
            </div>
          </div>
        </div>

        {/* View Navigation Tabs: Executions vs Closed Exits vs Active Portfolio */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#111111] pb-1 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveLedgerTab('ALL_ORDERS')}
              className={`px-3 py-1.5 font-bold transition-all border-t-2 border-x-2 border-[#111111] cursor-pointer flex items-center gap-1.5 ${
                activeLedgerTab === 'ALL_ORDERS'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>All Executions Ledger ({rawOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLedgerTab('CLOSED_EXITS')}
              className={`px-3 py-1.5 font-bold transition-all border-t-2 border-x-2 border-[#111111] cursor-pointer flex items-center gap-1.5 ${
                activeLedgerTab === 'CLOSED_EXITS'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              <span>Closed Exits & Realized P&L ({stats.filledSells})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLedgerTab('ACTIVE_HOLDINGS')}
              className={`px-3 py-1.5 font-bold transition-all border-t-2 border-x-2 border-[#111111] cursor-pointer flex items-center gap-1.5 ${
                activeLedgerTab === 'ACTIVE_HOLDINGS'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-700" />
              <span>Active Portfolio & Floating P&L ({liveHoldingsDetailed.length})</span>
            </button>
          </div>

          <div className="text-[11px] text-stone-500 font-mono hidden md:block">
            {activeLedgerTab === 'ACTIVE_HOLDINGS' ? (
              <span>Sell any position to realize profit and record win rate</span>
            ) : (
              <span>Auditable paper-trade execution record</span>
            )}
          </div>
        </div>

        {/* Filter and Search Bar for Orders */}
        {activeLedgerTab !== 'ACTIVE_HOLDINGS' && (
          <div className="bg-[#FAF8F3] border-2 border-[#111111] p-3 sm:p-4 space-y-3 shadow-[3px_3px_0px_#111111] print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              {/* Search Input */}
              <div className="md:col-span-4 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  placeholder="Search symbol, company, or Order ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border-2 border-[#111111] font-mono text-xs text-[#111111] placeholder:text-stone-400 outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Market Filter */}
              <div className="md:col-span-2">
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border-2 border-[#111111] font-mono text-xs text-[#111111] outline-none cursor-pointer"
                >
                  <option value="ALL">All Markets</option>
                  <option value="NSE">NSE India (₹)</option>
                  <option value="US">US Markets ($)</option>
                </select>
              </div>

              {/* Action Filter */}
              <div className="md:col-span-2">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border-2 border-[#111111] font-mono text-xs text-[#111111] outline-none cursor-pointer"
                >
                  <option value="ALL">All Actions</option>
                  <option value="BUY">BUY Only</option>
                  <option value="SELL">SELL Only</option>
                  <option value="REVERTED">Reverted Only</option>
                </select>
              </div>

              {/* PnL Filter */}
              <div className="md:col-span-2">
                <select
                  value={pnlFilter}
                  onChange={(e) => setPnlFilter(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border-2 border-[#111111] font-mono text-xs text-[#111111] outline-none cursor-pointer"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="PROFIT">Profitable Exits</option>
                  <option value="LOSS">Loss Exits</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="md:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border-2 border-[#111111] font-mono text-xs text-[#111111] outline-none cursor-pointer"
                >
                  <option value="DATE_DESC">Newest First</option>
                  <option value="DATE_ASC">Oldest First</option>
                  <option value="AMOUNT_DESC">Highest Value</option>
                  <option value="PNL_DESC">Highest P&L</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-stone-600 pt-1">
              <span>
                Showing <strong>{filteredOrders.length}</strong> of <strong>{rawOrders.length}</strong> executed orders
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Auditable Paper Ledger</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-sky-700" />
                  <span>{syncStatus === 'synced' ? 'Synced to Cloud' : 'Local IndexedDB Active'}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT 1 & 2: Executions & Closed Exits Table */}
        {activeLedgerTab !== 'ACTIVE_HOLDINGS' && (
          <div className="border-2 border-[#111111] bg-white shadow-[4px_4px_0px_#111111] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F3] border-b-2 border-[#111111] text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-[#111111]">Timestamp & ID</th>
                    <th className="py-2.5 px-3 border-r border-[#111111]">Action</th>
                    <th className="py-2.5 px-3 border-r border-[#111111]">Instrument</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Shares & Fill Price</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Total Consideration</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Realized P&L</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-center">Status</th>
                    <th className="py-2.5 px-3 text-center print:hidden">Revert Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-500 font-mono space-y-3">
                        <p className="font-bold text-sm text-stone-800">
                          {activeLedgerTab === 'CLOSED_EXITS' 
                            ? 'No Closed Exits Yet (All Positions Currently Open)' 
                            : 'No Transactions Found in Ledger'}
                        </p>
                        <p className="text-xs text-stone-600 max-w-md mx-auto">
                          {activeLedgerTab === 'CLOSED_EXITS'
                            ? 'You have executed BUY orders but have not yet sold any holdings to book Realized P&L. Switch to the "Active Portfolio" tab above to exit a position or practice selling.'
                            : rawOrders.length === 0
                              ? 'You have not executed any virtual trades yet. Launch the Trade Terminal or explore the Market Screener to test strategies risk-free.'
                              : 'No orders match your active search or filter parameters. Try clearing the filter.'}
                        </p>
                        <div className="pt-2 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTradeModal('RELIANCE.NS', 'BUY')}
                            className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800 cursor-pointer"
                          >
                            Execute Practice Trade
                          </button>
                          {liveHoldingsDetailed.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveLedgerTab('ACTIVE_HOLDINGS')}
                              className="px-3 py-1.5 bg-blue-700 text-white font-bold text-xs hover:bg-blue-800 cursor-pointer"
                            >
                              View Active Holdings ({liveHoldingsDetailed.length})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => {
                      const isReverted = ord.status === 'REVERTED' || ord.action === 'REVERTED';
                      const isNSE = ord.market === 'NSE' || ord.currency === 'INR' || ord.symbol?.endsWith('.NS') || ord.symbol?.endsWith('.BO');
                      const sym = isNSE ? '₹' : '$';
                      const dt = new Date(ord.timestamp || Date.now());
                      const formattedDate = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const formattedTime = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      const hasPnL = ord.action === 'SELL' && ord.realizedPnL !== undefined;
                      const pnlVal = ord.realizedPnL || 0;
                      const isProfitable = pnlVal > 0;

                      return (
                        <tr 
                          key={ord.id} 
                          className={`hover:bg-[#FAF8F3] transition-colors ${isReverted ? 'bg-neutral-100/70 text-neutral-400' : ''}`}
                        >
                          {/* Timestamp & ID */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-[11px] whitespace-nowrap">
                            <span className="font-bold text-stone-900 block">{formattedDate}</span>
                            <span className="text-[10px] text-stone-500 block">{formattedTime}</span>
                            <span className="text-[9px] text-stone-400 block font-mono truncate max-w-[110px]" title={ord.id}>
                              {ord.id}
                            </span>
                          </td>

                          {/* Action Badge */}
                          <td className="py-2 px-3 border-r border-neutral-200 whitespace-nowrap">
                            {isReverted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-stone-200 text-stone-700 border border-stone-300">
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>REVERTED</span>
                              </span>
                            ) : ord.action === 'BUY' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
                                <span>BUY</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                <ArrowUpRight className="w-3 h-3 text-amber-700" />
                                <span>SELL</span>
                              </span>
                            )}
                          </td>

                          {/* Instrument */}
                          <td className="py-2 px-3 border-r border-neutral-200">
                            <div className="flex items-center gap-1.5">
                              <Link
                                to={`/stock/${ord.symbol}`}
                                className="font-bold text-stone-900 hover:underline flex items-center gap-1"
                              >
                                <span>{ord.symbol}</span>
                              </Link>
                              <span className="px-1 text-[9px] font-bold border border-stone-300 bg-stone-50 text-stone-600">
                                {isNSE ? 'NSE' : 'US'}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-500 block truncate max-w-[200px]" title={ord.name}>
                              {ord.name || ord.symbol}
                            </span>
                          </td>

                          {/* Shares & Fill Price */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right whitespace-nowrap">
                            <span className={`font-bold ${isReverted ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                              {ord.quantity} {ord.quantity === 1 ? 'sh' : 'shs'}
                            </span>
                            <span className="text-[10px] text-stone-500 block">
                              @ {sym}{Number(ord.price || 0).toFixed(2)}
                            </span>
                          </td>

                          {/* Total Consideration */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right whitespace-nowrap">
                            <strong className={`font-bold ${isReverted ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                              {sym}{Number(ord.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </td>

                          {/* Realized P&L */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right whitespace-nowrap">
                            {hasPnL && !isReverted ? (
                              <div>
                                <span className={`font-bold block ${isProfitable ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isProfitable ? '+' : ''}{sym}{pnlVal.toFixed(2)}
                                </span>
                                <span className={`text-[10px] font-semibold ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isProfitable ? '+' : ''}{ord.returnPercent || 0}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-center whitespace-nowrap">
                            {isReverted ? (
                              <span className="text-[10px] font-bold text-stone-500 uppercase">
                                REVERTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>FILLED</span>
                              </span>
                            )}
                          </td>

                          {/* Revert Flow Action */}
                          <td className="py-2 px-3 text-center whitespace-nowrap print:hidden">
                            {isReverted ? (
                              <span className="text-[10px] text-stone-400 italic">Settled</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setOrderToRevert(ord)}
                                className="px-2 py-1 bg-white hover:bg-rose-50 border border-stone-300 hover:border-rose-700 text-stone-700 hover:text-rose-900 text-[10px] font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                                title="Revert / Undo this paper trade and restore cash and holdings"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Revert</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT 3: Active Portfolio & Live Floating P&L Table */}
        {activeLedgerTab === 'ACTIVE_HOLDINGS' && (
          <div className="border-2 border-[#111111] bg-white shadow-[4px_4px_0px_#111111] overflow-hidden space-y-0">
            <div className="p-3 bg-[#FAF8F3] border-b-2 border-[#111111] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#111111]" />
                <span className="font-bold uppercase tracking-wider text-stone-800">
                  Active Equity Holdings & Live Valuation Desk
                </span>
              </div>
              <div className="text-[11px] text-stone-600">
                Click <strong>"Sell / Exit"</strong> on any position to realize profit/loss and update your permanent win rate.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F3] border-b-2 border-[#111111] text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 border-r border-[#111111]">Instrument</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Shares Owned</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Avg Buy Price</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Live Tick</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Invested Cost</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Current Market Value</th>
                    <th className="py-2.5 px-3 border-r border-[#111111] text-right">Floating P&L</th>
                    <th className="py-2.5 px-3 text-center print:hidden">Lock Profit / Exit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-500 font-mono space-y-3">
                        <p className="font-bold text-sm text-stone-800">No Open Positions</p>
                        <p className="text-xs text-stone-600 max-w-md mx-auto">
                          You do not currently own any shares in this market category. Execute a trade to begin holding equity positions.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => openTradeModal('RELIANCE.NS', 'BUY')}
                            className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800 cursor-pointer"
                          >
                            Open First Position
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHoldings.map((h) => {
                      const sym = h.currencySymbol;
                      return (
                        <tr key={h.symbol} className="hover:bg-[#FAF8F3] transition-colors">
                          {/* Instrument */}
                          <td className="py-2 px-3 border-r border-neutral-200">
                            <div className="flex items-center gap-1.5">
                              <Link
                                to={`/stock/${h.symbol}`}
                                className="font-bold text-stone-900 hover:underline flex items-center gap-1"
                              >
                                <span>{h.symbol}</span>
                              </Link>
                              <span className="px-1 text-[9px] font-bold border border-stone-300 bg-stone-50 text-stone-600">
                                {h.isNSE ? 'NSE' : 'US'}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-500 block truncate max-w-[200px]" title={h.name}>
                              {h.name || h.symbol}
                            </span>
                          </td>

                          {/* Shares Owned */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right font-bold text-stone-900">
                            {h.quantity} {h.quantity === 1 ? 'sh' : 'shs'}
                          </td>

                          {/* Avg Buy Price */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right font-mono">
                            {sym}{Number(h.avgBuyPrice || 0).toFixed(2)}
                          </td>

                          {/* Live Tick */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right font-mono font-bold text-stone-900">
                            {sym}{Number(h.livePrice || 0).toFixed(2)}
                          </td>

                          {/* Invested Cost */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right font-mono text-stone-700">
                            {sym}{Number(h.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Current Market Value */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right font-mono font-bold text-stone-900">
                            {sym}{Number(h.currentVal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Floating P&L */}
                          <td className="py-2 px-3 border-r border-neutral-200 text-right whitespace-nowrap">
                            <span className={`font-bold block ${h.isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {h.isProfit ? '+' : ''}{sym}{h.unrealizedPnL.toFixed(2)}
                            </span>
                            <span className={`text-[10px] font-semibold ${h.isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {h.isProfit ? '+' : ''}{h.returnPercent}%
                            </span>
                          </td>

                          {/* Lock Profit / Exit Button */}
                          <td className="py-2 px-3 text-center whitespace-nowrap print:hidden">
                            <button
                              type="button"
                              onClick={() => openTradeModal(h.symbol, 'SELL', h.quantity)}
                              className="px-2.5 py-1 bg-[#111111] hover:bg-neutral-800 text-white text-[10px] font-bold font-mono transition-all flex items-center gap-1 mx-auto cursor-pointer shadow-xs"
                              title={`Sell and close ${h.quantity} shares of ${h.symbol}`}
                            >
                              <ArrowUpRight className="w-3 h-3 text-amber-300" />
                              <span>Exit / Sell</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Disclaimer & Ledger Notes */}
        <div className="p-4 bg-[#FAF8F3] border-2 border-[#111111] text-xs font-mono text-stone-700 space-y-1.5 shadow-[2px_2px_0px_#111111]">
          <div className="flex items-center gap-2 font-bold uppercase text-stone-900 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Auditable Ledger Protocol & Performance Accounting</span>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">
            All trades listed above are simulated virtual executions with zero capital risk. 
            Realized P&L represents closed profits or losses locked in upon selling shares. 
            Floating P&L reflects live open positions that adjust in real-time as market prices move. 
            Selling a position immediately books Realized P&L into your wallet and records winning or losing outcomes in your permanent win rate.
          </p>
        </div>
      </div>

      {/* Revert Trade Confirmation Modal */}
      {orderToRevert && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border-4 border-[#111111] max-w-md w-full p-5 space-y-4 shadow-[6px_6px_0px_#111111] animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b-2 border-[#111111] pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-headline font-black text-lg uppercase text-[#111111]">
                  Revert Paper Trade?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOrderToRevert(null)}
                className="text-stone-500 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs text-stone-700">
              <p>
                You are about to undo order <strong className="text-stone-900">{orderToRevert.id}</strong>:
              </p>
              
              <div className="p-3 bg-[#FAF8F3] border border-[#111111] space-y-1">
                <div><strong>Instrument:</strong> {orderToRevert.symbol} ({orderToRevert.name || ''})</div>
                <div><strong>Action:</strong> {orderToRevert.action} {orderToRevert.quantity} shs @ {orderToRevert.currency === 'INR' ? '₹' : '$'}{orderToRevert.price}</div>
                <div><strong>Total Value:</strong> {orderToRevert.currency === 'INR' ? '₹' : '$'}{Number(orderToRevert.totalAmount || 0).toFixed(2)}</div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-950 text-[11px] space-y-1">
                <p className="font-bold">What happens next:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {orderToRevert.action === 'BUY' ? (
                    <>
                      <li>{orderToRevert.quantity} shares of {orderToRevert.symbol} will be removed from your holdings.</li>
                      <li>Virtual cash of {orderToRevert.currency === 'INR' ? '₹' : '$'}{orderToRevert.totalAmount} will be refunded to your wallet.</li>
                    </>
                  ) : (
                    <>
                      <li>{orderToRevert.quantity} shares of {orderToRevert.symbol} will be restored to your holdings.</li>
                      <li>Proceeds of {orderToRevert.currency === 'INR' ? '₹' : '$'}{orderToRevert.totalAmount} will be deducted from your cash wallet.</li>
                    </>
                  )}
                  <li>The order status will be permanently marked as <strong>REVERTED</strong> in the audit ledger.</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setOrderToRevert(null)}
                disabled={isReverting}
                className="px-4 py-2 bg-white border-2 border-[#111111] text-xs font-bold font-mono hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                disabled={isReverting}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white border-2 border-rose-900 text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isReverting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Reverting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Reversal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Orders Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border-4 border-rose-900 max-w-md w-full p-5 space-y-4 shadow-[6px_6px_0px_#111111]">
            <div className="flex items-center gap-2 border-b-2 border-rose-900 pb-2 text-rose-900">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-headline font-black text-lg uppercase">
                Clear All Trade History?
              </h3>
            </div>

            <div className="space-y-3 font-mono text-xs text-stone-700">
              <p className="font-bold text-stone-900">
                This will delete all past trade ledger entries permanently from your account record.
              </p>
              <p>
                Your current cash balances and active equity holdings will remain intact, but all past transaction rows will be reset.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                className="px-4 py-2 bg-white border-2 border-[#111111] text-xs font-bold font-mono hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="px-4 py-2 bg-rose-800 hover:bg-rose-900 text-white border-2 border-rose-950 text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear All Orders'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sponsored Financial Dispatch Banner */}
      <AdsterraAdBanner placementId="6161748" adKey="265129238f893cd98f180d1efd562793" className="mt-8 mb-4" />
    </div>
  );
}
