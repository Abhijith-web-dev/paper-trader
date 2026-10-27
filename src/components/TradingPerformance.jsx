import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Award, 
  BarChart2, 
  RefreshCw, 
  Cloud, 
  CheckCircle2, 
  Smartphone, 
  Laptop, 
  Info, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sliders, 
  X,
  ShieldCheck,
  Zap,
  Download,
  Printer,
  PieChart,
  Database,
  Search,
  Filter,
  Server,
  Check,
  Layers,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { getQuotaTelemetry } from '../lib/cloudQuotaManager';
import { computeFloatingPositionAccounting } from '../lib/journalAnalytics';

/**
 * TRADING PERFORMANCE & INSTITUTIONAL REPORT SUITE
 * 
 * Quantitative Metrics:
 * - Net Live P&L (Booked Realized + Floating Unrealized) with Floor Ticker
 * - Win Rate, Profit Factor, Expectancy per Trade, Payoff Ratio
 * - Sharpe Ratio (risk-free adjusted: 6.5% INR / 4.5% USD)
 * - Sortino Ratio (downside volatility penalized)
 * - Maximum Drawdown (MDD) across closed trades equity curve
 * - Full Audited Trade Ledger with CSV Export
 * - Cloudflare Worker & Firebase Firestore Quota Telemetry & Optimizer
 */
export default function TradingPerformance({
  userProfile,
  livePrices = {},
  activeTab = 'ALL',
  syncStatus = 'synced',
  lastSyncedAt,
  onRefreshCloud
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportTab, setReportTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'QUANT' | 'LEDGER' | 'ALLOCATION' | 'QUOTA'
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('ALL'); // 'ALL' | 'PROFIT' | 'LOSS'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Wallets
  const inrWallet = userProfile?.wallets?.inr || { cashBalance: 1000000, initialBalance: 1000000, realizedPnL: 0 };
  const usdWallet = userProfile?.wallets?.usd || { cashBalance: 100000, initialBalance: 100000, realizedPnL: 0 };

  // 2. Open Holdings & Live Floating Unrealized P&L
  const holdingsList = useMemo(() => {
    return Object.values(userProfile?.holdings || {});
  }, [userProfile?.holdings]);

  const {
    inrGrossUnrealizedPnL,
    inrUnrealizedPnL,
    inrAllocatedCharges,
    usdGrossUnrealizedPnL,
    usdUnrealizedPnL,
    usdAllocatedCharges,
    inrInvestedVal,
    usdInvestedVal,
    inrPositionsInProfit,
    usdPositionsInProfit,
    inrPositionsCount,
    usdPositionsCount,
    positionsDetailed
  } = useMemo(() => {
    let inrGross = 0;
    let inrNet = 0;
    let inrFees = 0;
    let usdGross = 0;
    let usdNet = 0;
    let usdFees = 0;
    let inrInv = 0;
    let usdInv = 0;
    let inrProfitCount = 0;
    let usdProfitCount = 0;
    let inrCount = 0;
    let usdCount = 0;

    const detailed = holdingsList.map((h) => {
      const livePrice = Number(livePrices[h.symbol]?.price || h.avgBuyPrice || 100);
      const isIndia = h.market === 'NSE' || h.currency === 'INR' || h.symbol?.endsWith('.NS') || h.symbol?.endsWith('.BO');
      const exchange = isIndia ? 'NSE' : 'US';
      const cost = Number(h.totalCost || (h.quantity * h.avgBuyPrice));

      const acct = computeFloatingPositionAccounting({
        avgBuyPrice: h.avgBuyPrice,
        quantity: h.quantity,
        market: exchange,
        totalCost: cost,
      }, livePrice);

      const currentVal = Number(h.quantity * livePrice);
      const uPnL = acct.floatingNetPnL;
      const grossPnL = acct.floatingGrossPnL;
      const returnPct = acct.netReturnPercent;
      const grossReturnPct = acct.grossReturnPercent;

      if (isIndia) {
        inrGross += grossPnL;
        inrNet += uPnL;
        inrFees += acct.allocatedEntryCharges;
        inrInv += cost;
        inrCount++;
        if (uPnL >= 0) inrProfitCount++;
      } else {
        usdGross += grossPnL;
        usdNet += uPnL;
        usdFees += acct.allocatedEntryCharges;
        usdInv += cost;
        usdCount++;
        if (uPnL >= 0) usdProfitCount++;
      }

      return {
        ...h,
        livePrice,
        currentVal,
        uPnL,
        grossPnL,
        returnPct,
        grossReturnPct,
        allocatedCharges: acct.allocatedEntryCharges,
        isIndia,
      };
    });

    return {
      inrGrossUnrealizedPnL: inrGross,
      inrUnrealizedPnL: inrNet,
      inrAllocatedCharges: inrFees,
      usdGrossUnrealizedPnL: usdGross,
      usdUnrealizedPnL: usdNet,
      usdAllocatedCharges: usdFees,
      inrInvestedVal: inrInv,
      usdInvestedVal: usdInv,
      inrPositionsInProfit: inrProfitCount,
      usdPositionsInProfit: usdProfitCount,
      inrPositionsCount: inrCount,
      usdPositionsCount: usdCount,
      positionsDetailed: detailed,
    };
  }, [holdingsList, livePrices]);

  // 3. Orders & Quantitative Analytics
  const ordersList = useMemo(() => {
    return Object.values(userProfile?.orders || {});
  }, [userProfile?.orders]);

  const {
    hasClosedTrades,
    activeSellOrders,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor,
    bestTrade,
    worstTrade,
    avgWin,
    avgLoss,
    payoffRatio,
    expectancy,
    breakevenWinRate,
    sharpeRatio,
    sortinoRatio,
    maxDrawdownPercent,
    maxDrawdownAmount,
    kellyPercent,
    totalVolumeTraded,
  } = useMemo(() => {
    const sellOrders = ordersList
      .filter((o) => o.action === 'SELL' && o.status === 'FILLED')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const filteredSells = sellOrders.filter((o) => {
      const isInd = o.market === 'NSE' || o.currency === 'INR' || o.symbol?.endsWith('.NS') || o.symbol?.endsWith('.BO');
      if (activeTab === 'NSE') return isInd;
      if (activeTab === 'US') return !isInd;
      return true;
    });

    const wins = filteredSells.filter((o) => (o.realizedPnL || 0) > 0);
    const losses = filteredSells.filter((o) => (o.realizedPnL || 0) < 0);

    const hasClosedTrades = filteredSells.length > 0;
    const wr = hasClosedTrades 
      ? Number(((wins.length / filteredSells.length) * 100).toFixed(1)) 
      : null;

    const grossProfit = wins.reduce((acc, o) => acc + (o.realizedPnL || 0), 0);
    const grossLoss = Math.abs(losses.reduce((acc, o) => acc + (o.realizedPnL || 0), 0));
    
    let pf = null;
    if (hasClosedTrades) {
      if (grossLoss > 0) {
        pf = (grossProfit / grossLoss).toFixed(2);
      } else if (grossProfit > 0) {
        pf = '∞';
      } else {
        pf = '0.00';
      }
    }

    const maxTrade = wins.length > 0 ? Math.max(...wins.map((o) => o.realizedPnL || 0)) : null;
    const minTrade = losses.length > 0 ? Math.min(...losses.map((o) => o.realizedPnL || 0)) : null;

    const calculatedAvgWin = wins.length > 0 ? grossProfit / wins.length : null;
    const calculatedAvgLoss = losses.length > 0 ? grossLoss / losses.length : null;
    const payoff = (calculatedAvgLoss > 0 && calculatedAvgWin !== null)
      ? (calculatedAvgWin / calculatedAvgLoss) 
      : (calculatedAvgWin > 0 ? 3.0 : (hasClosedTrades ? 1.0 : null));

    // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
    const winProb = wins.length / (filteredSells.length || 1);
    const lossProb = losses.length / (filteredSells.length || 1);
    const exp = hasClosedTrades 
      ? ((winProb * (calculatedAvgWin || 0)) - (lossProb * (calculatedAvgLoss || 0)))
      : null;

    // Break-even win rate = 1 / (1 + PayoffRatio)
    const beWr = (payoff !== null && payoff > 0) 
      ? Number(((1 / (1 + payoff)) * 100).toFixed(1)) 
      : null;

    // Kelly Criterion % = W - ((1 - W) / R)
    let kelly = null;
    if (hasClosedTrades && payoff > 0 && winProb > 0) {
      kelly = winProb - ((1 - winProb) / payoff);
      kelly = Math.max(0, Math.min(0.35, kelly)); // Cap at 35% safe allocation
    }

    // Equity Curve & Maximum Drawdown calculation
    let runningPnl = 0;
    let peakPnl = 0;
    let maxDdAmt = 0;
    let maxDdPct = 0;

    // Sort chronologically for equity curve
    const chronologicalSells = [...filteredSells].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const returnsArray = [];

    chronologicalSells.forEach((trade) => {
      const p = trade.realizedPnL || 0;
      runningPnl += p;
      if (runningPnl > peakPnl) {
        peakPnl = runningPnl;
      }
      const ddAmt = peakPnl - runningPnl;
      if (ddAmt > maxDdAmt) {
        maxDdAmt = ddAmt;
      }
      const retPct = trade.returnPercent || 0;
      returnsArray.push(retPct / 100);
    });

    const initCap = (activeTab === 'US' ? (usdWallet.initialBalance || 100000) : (inrWallet.initialBalance || 1000000));
    if (initCap > 0 && maxDdAmt > 0) {
      maxDdPct = Number(((maxDdAmt / initCap) * 100).toFixed(2));
    }

    // Sharpe Ratio & Sortino Ratio (only defined when minimum 3 closed trades are recorded)
    let sharpe = null;
    let sortino = null;

    if (returnsArray.length >= 3) {
      const n = returnsArray.length;
      const mean = returnsArray.reduce((a, b) => a + b, 0) / n;
      const variance = returnsArray.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      // Downside deviation for Sortino (only negative returns)
      const negativeReturns = returnsArray.filter((r) => r < 0);
      const downsideVariance = negativeReturns.length > 0
        ? negativeReturns.reduce((acc, r) => acc + Math.pow(r, 2), 0) / negativeReturns.length
        : 0.0001;
      const downsideStdDev = Math.sqrt(downsideVariance);

      const rfr = activeTab === 'US' ? 0.045 : 0.065; // Risk-free rate (US 4.5%, India 6.5%)
      const rfrPerTrade = rfr / 252; // Daily scale

      if (stdDev > 0) {
        const annualizedSharpe = ((mean - rfrPerTrade) / stdDev) * Math.sqrt(252);
        sharpe = annualizedSharpe.toFixed(2);
      }
      if (downsideStdDev > 0) {
        const annualizedSortino = ((mean - rfrPerTrade) / downsideStdDev) * Math.sqrt(252);
        sortino = annualizedSortino.toFixed(2);
      }
    }

    const totalVolume = ordersList.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

    return {
      hasClosedTrades,
      activeSellOrders: filteredSells,
      winningTrades: wins,
      losingTrades: losses,
      winRate: wr,
      profitFactor: pf,
      bestTrade: maxTrade,
      worstTrade: minTrade,
      avgWin: calculatedAvgWin,
      avgLoss: calculatedAvgLoss,
      payoffRatio: payoff !== null ? payoff.toFixed(2) : null,
      expectancy: exp !== null ? exp.toFixed(2) : null,
      breakevenWinRate: beWr,
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      maxDrawdownPercent: maxDdPct,
      maxDrawdownAmount: maxDdAmt,
      kellyPercent: kelly !== null ? (kelly * 100).toFixed(1) : null,
      totalVolumeTraded: totalVolume,
    };
  }, [ordersList, activeTab, inrWallet, usdWallet]);

  // Net & Gross Total P&L
  const inrRealized = inrWallet.realizedPnL || 0;
  const usdRealized = usdWallet.realizedPnL || 0;

  // Realized is booked (net of commissions); Unrealized is shown as Net (after statutory fees)
  const netInrPnL = inrRealized + inrUnrealizedPnL;
  const grossInrPnL = inrRealized + inrGrossUnrealizedPnL;
  const netUsdPnL = usdRealized + usdUnrealizedPnL;
  const grossUsdPnL = usdRealized + usdGrossUnrealizedPnL;

  const inrNetReturnPct = (inrWallet.initialBalance || 1000000) > 0
    ? (netInrPnL / (inrWallet.initialBalance || 1000000)) * 100
    : 0;
  const inrGrossReturnPct = (inrWallet.initialBalance || 1000000) > 0
    ? (grossInrPnL / (inrWallet.initialBalance || 1000000)) * 100
    : 0;

  const usdNetReturnPct = (usdWallet.initialBalance || 100000) > 0
    ? (netUsdPnL / (usdWallet.initialBalance || 100000)) * 100
    : 0;
  const usdGrossReturnPct = (usdWallet.initialBalance || 100000) > 0
    ? (grossUsdPnL / (usdWallet.initialBalance || 100000)) * 100
    : 0;

  const isNSEOnly = activeTab === 'NSE';
  const isUSOnly = activeTab === 'US';
  const isDual = activeTab === 'ALL';

  const formatCurrency = (val, isInd) => {
    const sym = isInd ? '₹' : '$';
    const num = Number(val || 0);
    const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${num >= 0 ? '+' : '-'}${sym}${formatted}`;
  };

  const handleManualSync = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefreshCloud) {
        const res = await onRefreshCloud();
        if (res?.success) {
          toast.success(res.message || 'Synced with Cloud Firebase!');
        } else {
          toast.info(res?.message || 'Local data matches cloud state.');
        }
      }
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sync relative time string
  const syncTimeStr = useMemo(() => {
    if (!lastSyncedAt) return 'Never';
    const diffSec = Math.floor((Date.now() - Number(lastSyncedAt)) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  }, [lastSyncedAt, syncStatus, isRefreshing]);

  // Quota Telemetry Stats
  const quota = useMemo(() => {
    return getQuotaTelemetry();
  }, [detailsOpen, isRefreshing]);

  // Filtered Ledger List
  const filteredLedger = useMemo(() => {
    return activeSellOrders.filter((trade) => {
      if (ledgerFilter === 'PROFIT' && (trade.realizedPnL || 0) < 0) return false;
      if (ledgerFilter === 'LOSS' && (trade.realizedPnL || 0) >= 0) return false;
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        return (trade.symbol || '').toLowerCase().includes(q) || (trade.name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeSellOrders, ledgerFilter, ledgerSearch]);

  // Export CSV Ledger
  const handleExportCSV = () => {
    if (activeSellOrders.length === 0) {
      toast.error('No liquidated trade exits to export.');
      return;
    }

    const headers = ['Order ID', 'Symbol', 'Name', 'Market', 'Currency', 'Quantity', 'Entry Avg Price', 'Exit Price', 'Realized P&L', 'Return %', 'Timestamp', 'Date UTC'];
    const rows = activeSellOrders.map((o) => [
      o.id,
      o.symbol,
      `"${(o.name || o.symbol).replace(/"/g, '""')}"`,
      o.market || 'NSE',
      o.currency || 'INR',
      o.quantity,
      o.avgBuyPrice || 0,
      o.price || 0,
      o.realizedPnL || 0,
      o.returnPercent || 0,
      o.timestamp,
      new Date(o.timestamp).toISOString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `institutional_performance_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${activeSellOrders.length} audited trades to CSV!`);
  };

  return (
    <div className="newspaper-photo-plate p-3.5 sm:p-5 flex flex-col justify-between bg-[#FAF8F3] border-2 border-[#111111] transition-all">
      <div>
        {/* Header Ribbon */}
        <div className="flex justify-between items-start border-b border-[#111111] pb-2 font-mono">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#111111]" />
            <span className="text-xs text-[#111111] font-bold uppercase tracking-wider">
              TRADING PERFORMANCE
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 border border-[#111111] font-bold uppercase bg-white">
              {isNSEOnly ? 'NSE (₹)' : isUSOnly ? 'US ($)' : 'ALL MARKETS'}
            </span>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isRefreshing}
              title="Sync / Refresh with Firebase Cloud"
              className="p-1 border border-[#111111] bg-white hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 text-[#111111] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Real-time Total Net P&L (Realized + Live Unrealized) */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#111111]/70 uppercase font-bold">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Net Live P&L (Realized + Net Floating)</span>
            </span>
            <span className="text-emerald-900 font-bold bg-emerald-50 px-1 border border-emerald-300">LIVE TICK</span>
          </div>

          <div className="mt-1 font-mono font-bold text-xl sm:text-2xl text-[#111111] tabular-nums tracking-tight">
            {isNSEOnly && (
              <div>
                <span className={netInrPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}>
                  {formatCurrency(netInrPnL, true)}{' '}
                  <span className="text-xs font-normal">
                    ({inrNetReturnPct >= 0 ? '+' : ''}{inrNetReturnPct.toFixed(2)}% Net)
                  </span>
                </span>
                <span className="block text-[10px] text-neutral-500 font-normal mt-0.5">
                  Gross: {formatCurrency(grossInrPnL, true)} ({inrGrossReturnPct >= 0 ? '+' : ''}{inrGrossReturnPct.toFixed(2)}% Gross) • Est. Fees: ₹{inrAllocatedCharges.toFixed(2)}
                </span>
              </div>
            )}

            {isUSOnly && (
              <div>
                <span className={netUsdPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}>
                  {formatCurrency(netUsdPnL, false)}{' '}
                  <span className="text-xs font-normal">
                    ({usdNetReturnPct >= 0 ? '+' : ''}{usdNetReturnPct.toFixed(2)}% Net)
                  </span>
                </span>
                <span className="block text-[10px] text-neutral-500 font-normal mt-0.5">
                  Gross: {formatCurrency(grossUsdPnL, false)} ({usdGrossReturnPct >= 0 ? '+' : ''}{usdGrossReturnPct.toFixed(2)}% Gross) • Est. Fees: ${usdAllocatedCharges.toFixed(2)}
                </span>
              </div>
            )}

            {isDual && (
              <div>
                <div className="flex items-baseline gap-2 flex-wrap text-lg sm:text-xl">
                  <span className={netInrPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}>
                    {formatCurrency(netInrPnL, true)} Net
                  </span>
                  <span className="text-neutral-400 font-normal">/</span>
                  <span className={netUsdPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}>
                    {formatCurrency(netUsdPnL, false)} Net
                  </span>
                </div>
                <span className="block text-[10px] text-neutral-500 font-normal mt-0.5">
                  Gross: {formatCurrency(grossInrPnL, true)} / {formatCurrency(grossUsdPnL, false)} • Est. Fees: ₹{inrAllocatedCharges.toFixed(2)} / ${usdAllocatedCharges.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Realized vs Unrealized Breakdown Bar */}
        <div className="mt-3 pt-2.5 border-t border-[#D8D2C4] font-mono text-[11px] grid grid-cols-2 gap-2">
          <div>
            <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">Realized Booked:</span>
            <span className={`font-bold tabular-nums ${(isUSOnly ? usdRealized : inrRealized) >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
              {isNSEOnly && formatCurrency(inrRealized, true)}
              {isUSOnly && formatCurrency(usdRealized, false)}
              {isDual && `₹${inrRealized.toFixed(2)} / $${usdRealized.toFixed(2)}`}
            </span>
          </div>

          <div>
            <span className="text-[#111111]/60 block text-[9px] uppercase font-bold">Live Floating (Net / Gross):</span>
            <span className={`font-bold tabular-nums ${(isUSOnly ? usdUnrealizedPnL : inrUnrealizedPnL) >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
              {isNSEOnly && `${formatCurrency(inrUnrealizedPnL, true)} Net`}
              {isUSOnly && `${formatCurrency(usdUnrealizedPnL, false)} Net`}
              {isDual && `₹${inrUnrealizedPnL.toFixed(2)} / $${usdUnrealizedPnL.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Execution Stats Badge Strip */}
        <div className="mt-3 pt-2 border-t border-dashed border-[#D8D2C4] flex items-center justify-between font-mono text-[11px]">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-bold text-[#111111]">
              Win Rate: {hasClosedTrades ? `${winRate}%` : 'N/A'}
            </span>
            <span className="text-[10px] text-neutral-500 font-normal">
              ({hasClosedTrades ? `${winningTrades.length}W - ${losingTrades.length}L` : '0 closed trades'})
            </span>
          </div>

          <div className="text-[10px] text-neutral-600 font-bold">
            PF: <span className="text-[#111111]">{hasClosedTrades ? `${profitFactor}x` : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Footer Plate: Multi-Device Sync & Details Trigger */}
      <div className="mt-4 pt-3 border-t border-[#111111] flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5" title={`Firebase Cloud state synced ${syncTimeStr}`}>
          <div className="flex items-center gap-0.5 text-[#111111]">
            <Smartphone className="w-3 h-3" />
            <span className="text-neutral-400">↔</span>
            <Laptop className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
            <span>Cloud Synced</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="text-[10px] font-bold uppercase underline hover:text-amber-800 cursor-pointer flex items-center gap-0.5 bg-neutral-100 px-2 py-0.5 border border-[#111111]"
        >
          <span>Institutional Report</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Full Institutional Performance & Cloud Quota Audit Modal */}
      {detailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="newspaper-photo-plate bg-[#F6F4EE] border-4 border-[#111111] shadow-[8px_8px_0px_#111111] w-full max-w-4xl max-h-[92vh] flex flex-col font-mono text-xs text-[#111111] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-[#111111] bg-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase tracking-wider">
                    BROADSHEET AUDIT
                  </span>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-300 px-1.5 py-0.5">
                    EDGE QUANT ENGINE
                  </span>
                </div>
                <h3 className="font-headline uppercase font-black text-xl sm:text-2xl text-[#111111] tracking-tight mt-1">
                  INSTITUTIONAL PERFORMANCE REPORT
                </h3>
                <p className="text-[10px] text-neutral-600 font-mono mt-0.5 uppercase">
                  RISK-ADJUSTED METRICS • EXECUTION LEDGER • ASSET ALLOCATION • QUOTA OPTIMIZER
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-2.5 py-1.5 border border-[#111111] bg-white hover:bg-neutral-100 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Export trade exits to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1.5 border border-[#111111] bg-white hover:bg-neutral-100 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Print broadsheet report"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="p-1.5 border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#111111] bg-[#FAF8F3] px-4 overflow-x-auto text-[11px] font-bold">
              {[
                { id: 'OVERVIEW', label: 'Overview & P&L', icon: Activity },
                { id: 'QUANT', label: 'Quant & Risk Ratios', icon: Award },
                { id: 'LEDGER', label: `Trade Ledger (${activeSellOrders.length})`, icon: BarChart2 },
                { id: 'ALLOCATION', label: 'Capital Allocation', icon: PieChart },
                { id: 'QUOTA', label: 'Cloud & Quota Telemetry', icon: Server },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = reportTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReportTab(tab.id)}
                    className={`px-3 py-2.5 flex items-center gap-1.5 border-b-2 font-mono whitespace-nowrap cursor-pointer transition-colors ${
                      isActive 
                        ? 'border-[#111111] text-[#111111] bg-white' 
                        : 'border-transparent text-neutral-500 hover:text-[#111111]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F6F4EE] space-y-4">
              {/* TAB 1: OVERVIEW */}
              {reportTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  {/* Top Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block">Win Rate</span>
                      <span className="text-xl font-bold text-[#111111] block mt-1">{hasClosedTrades ? `${winRate}%` : 'N/A'}</span>
                      <span className="text-[9px] text-neutral-400 block mt-0.5">
                        {hasClosedTrades ? `${winningTrades.length} Wins / ${losingTrades.length} Losses` : '0 closed trades yet'}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block">Profit Factor</span>
                      <span className="text-xl font-bold text-[#111111] block mt-1">{hasClosedTrades ? `${profitFactor}x` : 'N/A'}</span>
                      <span className="text-[9px] text-neutral-400 block mt-0.5">{hasClosedTrades ? 'Gross Win / Gross Loss' : 'No closed exits'}</span>
                    </div>

                    <div className="p-3 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block">Trade Expectancy</span>
                      <span className={`text-xl font-bold block mt-1 ${hasClosedTrades && Number(expectancy) >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                        {hasClosedTrades ? `${Number(expectancy) >= 0 ? '+' : ''}${expectancy}` : 'N/A'}
                      </span>
                      <span className="text-[9px] text-neutral-400 block mt-0.5">{hasClosedTrades ? 'Exp. value per trade' : 'Awaiting trade exits'}</span>
                    </div>

                    <div className="p-3 bg-white border border-[#111111]">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold block">Max Drawdown</span>
                      <span className="text-xl font-bold text-red-800 block mt-1">{hasClosedTrades ? `-${maxDrawdownPercent}%` : '0.00%'}</span>
                      <span className="text-[9px] text-neutral-400 block mt-0.5">{hasClosedTrades ? 'Peak-to-trough drop' : 'No closed drawdown'}</span>
                    </div>
                  </div>

                  {/* Net Performance Detail Grid */}
                  <div className="p-4 bg-white border-2 border-[#111111]">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                      <span className="font-bold text-xs uppercase">Comprehensive P&L Breakdown</span>
                      <span className="text-[10px] text-neutral-500">Dual Currency Virtual Balance</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      {/* Indian Equities (NSE) */}
                      <div className="p-3 border border-neutral-300 bg-neutral-50">
                        <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                          <span className="font-bold text-xs">NSE Indian Market (₹)</span>
                          <span className={`font-bold text-xs ${netInrPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                            {formatCurrency(netInrPnL, true)} ({inrNetReturnPct >= 0 ? '+' : ''}{inrNetReturnPct.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Liquid Cash Balance:</span>
                            <span className="font-bold">₹{inrWallet.cashBalance?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Invested Capital:</span>
                            <span className="font-bold">₹{inrInvestedVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Booked Realized P&L:</span>
                            <span className={`font-bold ${inrRealized >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                              {formatCurrency(inrRealized, true)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Live Floating Unrealized:</span>
                            <span className={`font-bold ${inrUnrealizedPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                              {formatCurrency(inrUnrealizedPnL, true)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-neutral-200 font-bold">
                            <span>Open Positions:</span>
                            <span>{inrPositionsCount} ({inrPositionsInProfit} in profit)</span>
                          </div>
                        </div>
                      </div>

                      {/* US Equities (NASDAQ / NYSE) */}
                      <div className="p-3 border border-neutral-300 bg-neutral-50">
                        <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                          <span className="font-bold text-xs">US Markets ($)</span>
                          <span className={`font-bold text-xs ${netUsdPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                            {formatCurrency(netUsdPnL, false)} ({usdNetReturnPct >= 0 ? '+' : ''}{usdNetReturnPct.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Liquid Cash Balance:</span>
                            <span className="font-bold">${usdWallet.cashBalance?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Invested Capital:</span>
                            <span className="font-bold">${usdInvestedVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Booked Realized P&L:</span>
                            <span className={`font-bold ${usdRealized >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                              {formatCurrency(usdRealized, false)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Live Floating Unrealized:</span>
                            <span className={`font-bold ${usdUnrealizedPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                              {formatCurrency(usdUnrealizedPnL, false)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-neutral-200 font-bold">
                            <span>Open Positions:</span>
                            <span>{usdPositionsCount} ({usdPositionsInProfit} in profit)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Execution Payoff Matrix */}
                  <div className="p-4 bg-white border border-[#111111]">
                    <span className="font-bold text-xs uppercase block pb-2 border-b border-neutral-200">
                      Discipline & Payoff Matrix
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px]">
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Average Win:</span>
                        <span className="font-bold text-emerald-800 block text-sm">
                          {hasClosedTrades && avgWin !== null ? `+${avgWin.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Average Loss:</span>
                        <span className="font-bold text-red-800 block text-sm">
                          {hasClosedTrades && avgLoss !== null ? `-${avgLoss.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Risk / Reward Ratio:</span>
                        <span className="font-bold text-[#111111] block text-sm">
                          {hasClosedTrades && payoffRatio !== null ? `${payoffRatio} : 1.0` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Break-Even Win Rate:</span>
                        <span className="font-bold text-[#111111] block text-sm">
                          {hasClosedTrades && breakevenWinRate !== null ? `${breakevenWinRate}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: QUANT & RISK RATIOS */}
              {reportTab === 'QUANT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-white border-2 border-[#111111]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold">Sharpe Ratio</span>
                        <span className="text-[9px] px-1 bg-emerald-100 text-emerald-800 font-bold">ANNUALIZED</span>
                      </div>
                      <span className="text-2xl font-bold text-[#111111] block mt-1">
                        {sharpeRatio !== null ? sharpeRatio : 'N/A'}
                      </span>
                      <p className="text-[10px] text-neutral-600 mt-1 leading-tight font-news">
                        {sharpeRatio !== null 
                          ? 'Measures excess return over the risk-free rate per unit of total volatility. > 1.5 indicates institutional strength.'
                          : 'Requires at least 3 completed closed trade cycles to compute meaningful statistical variance.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border-2 border-[#111111]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold">Sortino Ratio</span>
                        <span className="text-[9px] px-1 bg-blue-100 text-blue-800 font-bold">DOWNSIDE ADJUSTED</span>
                      </div>
                      <span className="text-2xl font-bold text-[#111111] block mt-1">
                        {sortinoRatio !== null ? sortinoRatio : 'N/A'}
                      </span>
                      <p className="text-[10px] text-neutral-600 mt-1 leading-tight font-news">
                        {sortinoRatio !== null
                          ? 'Penalizes exclusively downside harmful volatility. Traders with controlled stop-losses score higher here.'
                          : 'Requires at least 3 completed closed trades to isolate downside harmful volatility.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border-2 border-[#111111]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold">Kelly Sizing Limit</span>
                        <span className="text-[9px] px-1 bg-amber-100 text-amber-800 font-bold">POSITION LIMIT</span>
                      </div>
                      <span className="text-2xl font-bold text-[#111111] block mt-1">
                        {kellyPercent !== null ? `${kellyPercent}%` : 'N/A'}
                      </span>
                      <p className="text-[10px] text-neutral-600 mt-1 leading-tight font-news">
                        {kellyPercent !== null
                          ? 'Mathematically optimal maximum percentage of total portfolio equity to allocate on any single trade.'
                          : 'Awaiting closed trades sample to calibrate empirical win probability and payoff.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-[#111111]">
                    <span className="font-bold text-xs uppercase block pb-2 border-b border-neutral-200">
                      Peak Execution & Risk Auditing
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px]">
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Best Winner:</span>
                        <span className="font-bold text-emerald-800 block text-sm">
                          {hasClosedTrades && bestTrade !== null ? `+${bestTrade.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Worst Loser:</span>
                        <span className="font-bold text-red-800 block text-sm">
                          {hasClosedTrades && worstTrade !== null ? `${worstTrade.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Worst Drawdown Trade:</span>
                        <span className="font-bold text-red-800 block text-sm">
                          {hasClosedTrades && worstTrade !== null ? `${worstTrade.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Max Drawdown Value:</span>
                        <span className="font-bold text-red-800 block text-sm">
                          {hasClosedTrades && maxDrawdownAmount > 0 
                            ? `${isUSOnly ? '$' : '₹'}${maxDrawdownAmount.toFixed(2)}` 
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Discipline Grade:</span>
                        <span className="font-bold text-emerald-800 block text-sm">
                          {!hasClosedTrades ? 'AWAITING CLOSED EXITS' : (winRate >= 50 && Number(profitFactor) >= 1.5 ? 'A+ (INSTITUTIONAL)' : 'B (DEVELOPING)')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TRADE EXECUTION LEDGER */}
              {reportTab === 'LEDGER' && (
                <div className="space-y-3">
                  {/* Ledger Filters */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white border border-[#111111]">
                    <div className="flex items-center gap-1.5 flex-1">
                      <Search className="w-3.5 h-3.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search symbol in ledger..."
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        className="bg-transparent border-none text-xs focus:outline-none w-full font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      {['ALL', 'PROFIT', 'LOSS'].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setLedgerFilter(f)}
                          className={`px-2 py-0.5 border font-bold cursor-pointer ${
                            ledgerFilter === f 
                              ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]' 
                              : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="border border-[#111111] bg-white overflow-x-auto">
                    {filteredLedger.length === 0 ? (
                      <div className="p-8 text-center text-neutral-500 text-xs">
                        No closed trade exits match your filter. Liquidate open stock positions to populate the audited ledger.
                      </div>
                    ) : (
                      <table className="w-full text-left text-[11px] font-mono border-collapse">
                        <thead>
                          <tr className="bg-neutral-100 border-b border-[#111111] text-[10px] text-neutral-700">
                            <th className="p-2.5 font-bold uppercase">Symbol</th>
                            <th className="p-2.5 font-bold uppercase">Action</th>
                            <th className="p-2.5 font-bold uppercase text-right">Qty</th>
                            <th className="p-2.5 font-bold uppercase text-right">Entry</th>
                            <th className="p-2.5 font-bold uppercase text-right">Exit</th>
                            <th className="p-2.5 font-bold uppercase text-right">Realized P&L</th>
                            <th className="p-2.5 font-bold uppercase text-right">Return %</th>
                            <th className="p-2.5 font-bold uppercase text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {filteredLedger.map((order) => {
                            const isWin = (order.realizedPnL || 0) >= 0;
                            const isInd = order.market === 'NSE' || order.currency === 'INR';
                            const sym = isInd ? '₹' : '$';

                            return (
                              <tr key={order.id} className="hover:bg-neutral-50">
                                <td className="p-2.5 font-bold text-[#111111]">
                                  <div>{order.symbol}</div>
                                  <div className="text-[9px] text-neutral-400 font-normal">
                                    {order.timestamp ? new Date(order.timestamp).toLocaleString() : 'Recent'}
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  <span className="px-1 py-0.5 bg-neutral-200 text-neutral-800 text-[9px] font-bold">
                                    {order.action}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right tabular-nums">{order.quantity}</td>
                                <td className="p-2.5 text-right tabular-nums">{sym}{order.avgBuyPrice?.toFixed(2) || '—'}</td>
                                <td className="p-2.5 text-right tabular-nums">{sym}{order.price?.toFixed(2)}</td>
                                <td className={`p-2.5 text-right font-bold tabular-nums ${isWin ? 'text-emerald-800' : 'text-red-800'}`}>
                                  {isWin ? '+' : ''}{sym}{order.realizedPnL?.toFixed(2)}
                                </td>
                                <td className={`p-2.5 text-right font-bold tabular-nums ${isWin ? 'text-emerald-800' : 'text-red-800'}`}>
                                  {order.returnPercent >= 0 ? '+' : ''}{order.returnPercent?.toFixed(2)}%
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={`px-1.5 py-0.5 text-[9px] font-bold ${
                                    isWin ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {isWin ? 'WIN' : 'LOSS'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CAPITAL ALLOCATION */}
              {reportTab === 'ALLOCATION' && (
                <div className="space-y-4">
                  <div className="p-4 bg-white border-2 border-[#111111]">
                    <span className="font-bold text-xs uppercase block pb-2 border-b border-neutral-200">
                      Portfolio Asset Weights & Exposure
                    </span>

                    {/* Progress Bar for INR Portfolio */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-neutral-600">INR Portfolio Allocation:</span>
                        <span className="font-bold">
                          ₹{inrInvestedVal.toFixed(0)} Invested / ₹{inrWallet.cashBalance.toFixed(0)} Liquid Cash
                        </span>
                      </div>
                      <div className="w-full h-3 bg-neutral-200 border border-[#111111] overflow-hidden flex">
                        <div 
                          className="bg-emerald-700 h-full" 
                          style={{ width: `${Math.min(100, (inrInvestedVal / (inrInvestedVal + inrWallet.cashBalance || 1)) * 100)}%` }}
                          title="Invested Capital"
                        />
                        <div 
                          className="bg-neutral-300 h-full" 
                          style={{ width: `${Math.max(0, 100 - (inrInvestedVal / (inrInvestedVal + inrWallet.cashBalance || 1)) * 100)}%` }}
                          title="Liquid Cash"
                        />
                      </div>
                    </div>

                    {/* Progress Bar for USD Portfolio */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-neutral-600">USD Portfolio Allocation:</span>
                        <span className="font-bold">
                          ${usdInvestedVal.toFixed(0)} Invested / ${usdWallet.cashBalance.toFixed(0)} Liquid Cash
                        </span>
                      </div>
                      <div className="w-full h-3 bg-neutral-200 border border-[#111111] overflow-hidden flex">
                        <div 
                          className="bg-blue-700 h-full" 
                          style={{ width: `${Math.min(100, (usdInvestedVal / (usdInvestedVal + usdWallet.cashBalance || 1)) * 100)}%` }}
                          title="Invested Capital"
                        />
                        <div 
                          className="bg-neutral-300 h-full" 
                          style={{ width: `${Math.max(0, 100 - (usdInvestedVal / (usdInvestedVal + usdWallet.cashBalance || 1)) * 100)}%` }}
                          title="Liquid Cash"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Open Holdings Distribution Table */}
                  <div className="border border-[#111111] bg-white">
                    <div className="p-2.5 bg-neutral-100 border-b border-[#111111] font-bold text-xs flex justify-between">
                      <span>ACTIVE HOLDINGS WEIGHTS ({positionsDetailed.length})</span>
                      <span className="text-[10px] text-neutral-500 font-normal">Real-Time Valuation</span>
                    </div>

                    {positionsDetailed.length === 0 ? (
                      <div className="p-6 text-center text-neutral-500 text-xs">
                        No active holdings currently held in portfolio.
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-200">
                        {positionsDetailed.map((pos) => {
                          const sym = pos.isIndia ? '₹' : '$';
                          const totalBase = pos.isIndia ? (inrInvestedVal + inrWallet.cashBalance) : (usdInvestedVal + usdWallet.cashBalance);
                          const weight = totalBase > 0 ? ((pos.currentVal / totalBase) * 100).toFixed(1) : 0;

                          return (
                            <div key={pos.symbol} className="p-3 flex items-center justify-between hover:bg-neutral-50 text-[11px]">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#111111]">{pos.symbol}</span>
                                  <span className="text-[9px] px-1 bg-neutral-200 font-bold">{pos.market}</span>
                                </div>
                                <span className="text-[10px] text-neutral-500">
                                  {pos.quantity} shares • Cost: {sym}{pos.avgBuyPrice?.toFixed(2)}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="font-bold tabular-nums block">
                                  {sym}{pos.currentVal.toFixed(2)} ({weight}% weight)
                                </span>
                                <span className={`text-[10px] tabular-nums ${pos.uPnL >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                  {pos.uPnL >= 0 ? '+' : ''}{sym}{pos.uPnL.toFixed(2)} ({pos.returnPct >= 0 ? '+' : ''}{pos.returnPct.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: CLOUD & QUOTA TELEMETRY */}
              {reportTab === 'QUOTA' && (
                <div className="space-y-4">
                  {/* Quota Telemetry Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Cloudflare Edge Quota */}
                    <div className="p-4 bg-white border-2 border-[#111111]">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                        <span className="font-bold text-xs uppercase flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-amber-600" />
                          <span>Cloudflare Edge Proxy (Free 100k/day)</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 border border-emerald-300">
                          {quota.cloudflare.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Daily Free Limit:</span>
                          <span className="font-bold">100,000 requests</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Network Calls Made Today:</span>
                          <span className="font-bold">{quota.cloudflare.requestsMade}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Requests Saved (Cache/Coalescing):</span>
                          <span className="font-bold text-emerald-800">+{quota.cloudflare.requestsSaved}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Cache Efficiency Ratio:</span>
                          <span className="font-bold text-emerald-800">{quota.cloudflare.cacheEfficiencyPercent}%</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-neutral-200">
                          <span className="text-neutral-600">Quota Remaining:</span>
                          <span className="font-bold">{quota.cloudflare.remaining.toLocaleString()} reqs</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-dashed border-neutral-200">
                        <p className="text-[10px] text-neutral-500 font-news">
                          Optimization active: In-flight deduplication coalesces concurrent quote searches, and a 30-minute persistent query cache eliminates repetitive upstream hits.
                        </p>
                      </div>
                    </div>

                    {/* Firebase Firestore Quota */}
                    <div className="p-4 bg-white border-2 border-[#111111]">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                        <span className="font-bold text-xs uppercase flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-blue-600" />
                          <span>Firebase Firestore (Free 50k / 20k)</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 border border-emerald-300">
                          {quota.firestore.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Firestore Reads (Limit: 50,000):</span>
                          <span className="font-bold">{quota.firestore.readsMade} ({quota.firestore.readPercentUsed}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Firestore Writes (Limit: 20,000):</span>
                          <span className="font-bold">{quota.firestore.writesMade} ({quota.firestore.writePercentUsed}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Writes Saved (1.2s Debounce Engine):</span>
                          <span className="font-bold text-emerald-800">+{quota.firestore.writesSavedByDebounce}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Reads Saved (Snapshot Coalesce):</span>
                          <span className="font-bold text-emerald-800">+{quota.firestore.readsSavedBySnapshot}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-neutral-200">
                          <span className="text-neutral-600">Document Size Payload:</span>
                          <span className="font-bold text-emerald-800">&lt; 25 KB (Tiny)</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-dashed border-neutral-200">
                        <p className="text-[10px] text-neutral-500 font-news">
                          Optimization active: Eliminates redundant getDoc queries by listening directly to initial snapshot events, with 1.2s debounced write coalescing and zero-op diffing.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Device Sync Health Panel */}
                  <div className="p-4 bg-white border-2 border-[#111111]">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-emerald-700" />
                        <span className="font-bold text-xs uppercase">Mobile & Laptop Real-Time Sync State</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 border border-emerald-300">
                        {syncStatus === 'synced' ? 'Active & Synced' : syncStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-[11px]">
                      <div>
                        <span className="text-neutral-500 text-[10px] block">Devices Linked:</span>
                        <span className="font-bold text-[#111111] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Mobile & Laptop</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[10px] block">Last Cloud Sync:</span>
                        <span className="font-bold text-[#111111]">{syncTimeStr}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[10px] block">Cloud Account:</span>
                        <span className="font-bold text-[#111111] truncate block" title={userProfile?.profile?.email || 'Authenticated'}>
                          {userProfile?.profile?.email || 'Active Trader'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[10px] text-neutral-500 font-news">
                        Orders placed on mobile automatically sync to Cloud Firestore and update on your laptop upon refresh.
                      </span>
                      <button
                        type="button"
                        onClick={handleManualSync}
                        disabled={isRefreshing}
                        className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Force Cloud Sync Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t-2 border-[#111111] bg-white flex items-center justify-between">
              <span className="text-[10px] text-neutral-500 font-news hidden sm:inline">
                Institutional Paper Trading Floor • Zero Server Cost • Real-Time Quota Protected
              </span>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="px-4 py-1.5 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 font-mono text-xs font-bold border border-[#111111] cursor-pointer ml-auto"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
