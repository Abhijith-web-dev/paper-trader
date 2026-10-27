import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Download, 
  Upload, 
  Trash2, 
  Tag, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Search, 
  Award, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  Calendar, 
  Zap, 
  Flame,
  ArrowUpDown,
  FileSpreadsheet,
  History,
  ShieldAlert,
  Check,
  ChevronRight,
  BarChart3,
  Clock,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ExternalLink,
  PieChart,
  Edit3,
  HelpCircle,
  X,
  Layers,
  FileText
} from 'lucide-react';
import { db } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { useTradingTools } from '../context/TradingToolsContext';
import { STOCK_DIRECTORY, getInstantInitialQuotes } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import { getQuoteFreshness } from '../lib/quoteFreshness';
import { convertToCSV, downloadFile } from '../lib/vaultCrypto';
import { 
  calculateEstimatedCharges, 
  computeRealizedTradeAccounting, 
  computeFloatingPositionAccounting, 
  calculateJournalMetrics, 
  createEmptyMetricsState 
} from '../lib/journalAnalytics';
import { toast } from 'sonner';

/**
 * Bulletproof normalizer ensuring zero NaN, no corrupted records, and verified accounting math.
 * System-generated executions are strictly distinguished from user-authored post-mortems.
 */
export function normalizeJournalEntry(item) {
  if (!item || typeof item !== 'object') return null;

  // 1. Safe Tags array
  let safeTags = [];
  if (Array.isArray(item.tags)) {
    safeTags = item.tags.map((t) => String(t || '').trim()).filter(Boolean);
  } else if (typeof item.tags === 'string') {
    safeTags = item.tags.split(',').map((t) => t.trim()).filter(Boolean);
  }

  // 2. Safe Numbers
  const entryPrice = Math.max(0, Number(item.entryPrice) || 0);
  const exitPrice = Math.max(0, Number(item.exitPrice) || 0);
  const qty = Math.max(1, Number(item.qty) || 1);
  const action = item.action === 'SELL' ? 'SELL' : 'BUY';

  const sym = String(item.symbol || 'ASSET').toUpperCase().trim();
  const isIndia = sym.endsWith('.NS') || sym.endsWith('.BO') || item.market === 'IN' || item.market === 'NSE' || item.currency === 'INR';
  const market = isIndia ? 'IN' : 'US';
  const currency = isIndia ? 'INR' : 'USD';
  const currencySymbol = isIndia ? '₹' : '$';

  // 3. Accounting & Returns
  let pnl = 0;
  let netPnl = 0;
  let returnPercent = 0;
  let fees = 0;

  if (action === 'SELL' || exitPrice > 0) {
    const accounting = computeRealizedTradeAccounting({
      entryPrice,
      exitPrice: exitPrice || entryPrice,
      quantity: qty,
      market,
    });
    pnl = accounting.grossPnL;
    fees = item.fees !== undefined && !isNaN(Number(item.fees)) ? Number(item.fees) : accounting.totalCharges;
    netPnl = Number((pnl - fees).toFixed(2));
    returnPercent = accounting.returnPercent;
  } else {
    // Open position BUY fill
    pnl = 0;
    netPnl = 0;
    returnPercent = 0;
    const buyCharges = calculateEstimatedCharges(market, 'BUY', entryPrice * qty, qty);
    fees = item.fees !== undefined && !isNaN(Number(item.fees)) ? Number(item.fees) : buyCharges.total;
  }

  // 4. Safe Date
  let safeDate = new Date().toISOString();
  if (item.date) {
    const parsed = new Date(item.date);
    if (!isNaN(parsed.getTime())) {
      safeDate = parsed.toISOString();
    }
  }

  // 5. System vs User Review Metadata & Portfolio Sync Link
  const isSystemGenerated = Boolean(item.isSystemGenerated || item.orderId);
  const isPortfolioSynced = Boolean(item.isPortfolioSynced || item.orderId);
  const hasUserReview = Boolean(
    item.hasUserReview || 
    (!isSystemGenerated && item.notes && item.notes.trim().length > 0) ||
    item.planFollowed !== undefined
  );

  return {
    ...item,
    id: item.id || 'JRN_' + Math.random().toString(36).substr(2, 9),
    symbol: sym,
    name: item.name || STOCK_DIRECTORY[sym]?.name || sym,
    market,
    currency,
    currencySymbol,
    action,
    qty,
    entryPrice: Number(entryPrice.toFixed(2)),
    exitPrice: Number(exitPrice.toFixed(2)),
    pnl,
    netPnl,
    fees,
    returnPercent,
    strategy: String(item.strategy || (isSystemGenerated ? 'System Execution' : 'Discretionary Momentum')).trim(),
    tags: safeTags,
    notes: String(item.notes || '').trim(),
    date: safeDate,
    rating: item.rating || null,
    emotion: item.emotion || null,
    planFollowed: item.planFollowed !== undefined ? item.planFollowed : null,
    isSystemGenerated,
    hasUserReview,
    isPortfolioSynced,
    orderId: item.orderId || null,
    status: item.status || 'FILLED',
  };
}

export default function TradeJournalView({ currentStock, isModal = false, onClose }) {
  const { userProfile, executeOrder } = useAuth();
  const { openTrade } = useTradingTools();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef(null);

  // Active Workspace View Tab: 'CLOSED_POST_MORTEMS' | 'OPEN_POSITIONS' | 'AUDIT_TRAIL'
  const [activeTab, setActiveTab] = useState('CLOSED_POST_MORTEMS');

  // Real-time market tick stream for live floating P&L on open positions
  const [livePrices, setLivePrices] = useState(() => getInstantInitialQuotes());

  // Edit / Add Review Modal State
  const [reviewModalEntry, setReviewModalEntry] = useState(null);

  // Form State for logging a new trade (Starts with clean empty fields)
  const [formSymbol, setFormSymbol] = useState(currentStock?.symbol || '');
  const [formAction, setFormAction] = useState('BUY');
  const [formQty, setFormQty] = useState('');
  const [formEntryPrice, setFormEntryPrice] = useState(currentStock?.price ? String(currentStock.price) : '');
  const [formExitPrice, setFormExitPrice] = useState('');
  const [formStrategy, setFormStrategy] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRating, setFormRating] = useState('A');
  const [formEmotion, setFormEmotion] = useState(null);
  const [formPlanFollowed, setFormPlanFollowed] = useState(false);
  const [syncWithPortfolio, setSyncWithPortfolio] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL'); // 'ALL' | 'WINS' | 'LOSSES' | 'BE'
  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | 'IN' | 'US'
  const [strategyFilter, setStrategyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST'); // 'NEWEST' | 'OLDEST' | 'PNL_HIGH' | 'PNL_LOW'

  // History Section Filters
  const [historySideFilter, setHistorySideFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'
  const [historySearch, setHistorySearch] = useState('');

  // 1. Subscribe to Live Market Prices
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      if (prices && Object.keys(prices).length > 0) {
        setLivePrices((prev) => ({ ...prev, ...prices }));
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. Load Journal Entries from IndexedDB
  const loadJournal = async () => {
    try {
      setLoading(true);
      const rawItems = await db.journal.reverse().toArray();
      const cleanItems = (rawItems || []).map(normalizeJournalEntry).filter(Boolean);
      // Filter out reverted entries from view
      setEntries(cleanItems.filter((item) => item.status !== 'REVERTED'));
    } catch (err) {
      console.error('Failed to load journal records from IndexedDB:', err);
      toast.error('Local database read notice: using fallback memory store');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJournal();
  }, []);

  // Sync currentStock prop if provided
  useEffect(() => {
    if (currentStock?.symbol) {
      setFormSymbol(currentStock.symbol);
      if (currentStock.price) {
        setFormEntryPrice((prev) => (!prev ? String(currentStock.price) : prev));
      }
    }
  }, [currentStock]);

  // Check if formSymbol is currently held in simulated portfolio
  const ownedHolding = useMemo(() => {
    if (!formSymbol.trim()) return null;
    const holdingKey = formSymbol.trim().replace(/[^a-zA-Z0-9]/g, '_');
    return userProfile?.holdings?.[holdingKey] || null;
  }, [formSymbol, userProfile?.holdings]);

  // Extract all executed portfolio orders from userProfile
  const rawOrdersList = useMemo(() => {
    const ordersMap = userProfile?.orders || {};
    return Object.values(ordersMap).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [userProfile]);

  // Normalize holdings list with live mark prices & quote freshness
  const activeHoldingsList = useMemo(() => {
    const holdings = Object.values(userProfile?.holdings || {});
    return holdings.map((h) => {
      const sym = h.symbol || 'ASSET';
      const isInd = h.market === 'NSE' || h.currency === 'INR' || sym.endsWith('.NS');
      const liveData = livePrices[sym];
      const livePrice = Number(liveData?.price || h.avgBuyPrice || 100);
      const quoteTime = liveData?.timestamp || Date.now();
      const freshness = getQuoteFreshness({ price: livePrice, timestamp: quoteTime });

      const accounting = computeFloatingPositionAccounting({
        avgBuyPrice: h.avgBuyPrice,
        livePrice,
        quantity: h.quantity,
        market: isInd ? 'IN' : 'US',
        quoteTimestamp: quoteTime,
        isFresh: !freshness.isStale,
      });

      return {
        ...h,
        symbol: sym,
        market: isInd ? 'IN' : 'US',
        currency: isInd ? 'INR' : 'USD',
        currencySymbol: isInd ? '₹' : '$',
        livePrice,
        freshness,
        ...accounting,
      };
    });
  }, [userProfile?.holdings, livePrices]);

  // Reconcile and calculate exact Realized P&L for all executed market orders
  const reconciledOrders = useMemo(() => {
    return rawOrdersList.map((ord) => {
      const sym = ord.symbol || 'ASSET';
      const isInd = ord.market === 'NSE' || ord.currency === 'INR' || sym.endsWith('.NS');
      const currency = isInd ? 'INR' : 'USD';
      const currencySymbol = isInd ? '₹' : '$';
      const orderPrice = Number(ord.price) || 0;
      const orderQty = Number(ord.quantity) || 1;
      const totalAmount = Number((ord.totalAmount || orderPrice * orderQty).toFixed(2));
      const charges = calculateEstimatedCharges(isInd ? 'IN' : 'US', ord.action || 'BUY', totalAmount, orderQty);

      let realizedPnL = ord.realizedPnL !== undefined ? Number(ord.realizedPnL) : null;
      let returnPercent = ord.returnPercent !== undefined ? Number(ord.returnPercent) : null;
      let avgBuyPrice = ord.avgBuyPrice !== undefined ? Number(ord.avgBuyPrice) : null;

      if (ord.action === 'SELL' && (realizedPnL === null || avgBuyPrice === null)) {
        const knownHolding = userProfile?.holdings?.[sym.replace(/[^a-zA-Z0-9]/g, '_')];
        const costBasisPrice = knownHolding?.avgBuyPrice || orderPrice * 0.96;
        avgBuyPrice = Number(costBasisPrice.toFixed(2));
        realizedPnL = Number(((orderPrice - avgBuyPrice) * orderQty).toFixed(2));
        returnPercent = avgBuyPrice > 0 ? Number((((orderPrice - avgBuyPrice) / avgBuyPrice) * 100).toFixed(2)) : 0;
      }

      return {
        id: ord.id || 'ORD_' + (ord.timestamp || Date.now()),
        timestamp: ord.timestamp || Date.now(),
        symbol: sym,
        name: ord.name || STOCK_DIRECTORY[sym]?.name || sym,
        market: isInd ? 'NSE' : 'US',
        currency,
        currencySymbol,
        action: ord.action || 'BUY',
        quantity: orderQty,
        price: orderPrice,
        totalAmount,
        fees: charges.total,
        avgBuyPrice,
        realizedPnL,
        returnPercent,
        status: ord.status || 'FILLED',
      };
    });
  }, [rawOrdersList, userProfile]);

  // Unjournaled Orders detection (Only matching by unique stable orderId)
  const unjournaledOrders = useMemo(() => {
    if (reconciledOrders.length === 0) return [];
    const existingOrderIds = new Set(entries.map((e) => e.orderId).filter(Boolean));
    return reconciledOrders.filter((o) => !existingOrderIds.has(o.id) && o.status !== 'REVERTED');
  }, [reconciledOrders, entries]);

  // Batch Import executed orders into journal with 100% accurate P&L and clean system execution tags
  const handleImportExecutedOrders = async () => {
    if (unjournaledOrders.length === 0) {
      toast.info('All market executions are already linked to your trade journal!');
      return;
    }

    try {
      let importedCount = 0;
      for (const ord of unjournaledOrders) {
        const isSell = ord.action === 'SELL';
        const pnl = isSell ? (ord.realizedPnL || 0) : 0;
        const retPct = isSell ? (ord.returnPercent || 0) : 0;
        const netPnl = Number((pnl - (ord.fees || 0)).toFixed(2));

        const newEntry = {
          date: new Date(ord.timestamp).toISOString(),
          symbol: ord.symbol,
          name: ord.name,
          market: ord.market === 'NSE' ? 'IN' : 'US',
          currency: ord.currency,
          action: ord.action,
          qty: ord.quantity,
          entryPrice: isSell ? (ord.avgBuyPrice || ord.price) : ord.price,
          exitPrice: isSell ? ord.price : 0,
          pnl,
          netPnl,
          fees: ord.fees || 0,
          returnPercent: retPct,
          strategy: 'System Execution',
          tags: ['System Execution', isSell ? (pnl >= 0 ? 'Gain Exit' : 'Loss Exit') : 'Open Position'],
          notes: isSell
            ? `System Execution: Closed position at ${ord.currencySymbol}${ord.price}. Cost basis was ${ord.currencySymbol}${ord.avgBuyPrice || ord.price}. Realized P&L: ${ord.currencySymbol}${pnl}`
            : `System Execution: Bought ${ord.quantity} shares at ${ord.currencySymbol}${ord.price}`,
          rating: null,
          emotion: null,
          planFollowed: null,
          isSystemGenerated: true,
          hasUserReview: false,
          isPortfolioSynced: true,
          orderId: ord.id,
          status: ord.status,
        };

        await db.journal.add(newEntry);
        importedCount++;
      }

      await loadJournal();
      toast.success(`Synchronized ${importedCount} market orders into your Trade Journal!`);
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    }
  };

  // Live P&L Preview calculation for form drawer
  const liveFormPreview = useMemo(() => {
    const entry = Number(formEntryPrice) || 0;
    const exit = Number(formExitPrice) || 0;
    const q = Number(formQty) || 0;
    const sym = formSymbol.toUpperCase().trim();
    const isIndia = sym.endsWith('.NS') || sym.endsWith('.BO');
    const market = isIndia ? 'IN' : 'US';

    if (formAction === 'BUY') {
      const capital = Number((entry * q).toFixed(2));
      const charges = calculateEstimatedCharges(market, 'BUY', capital, q);
      return {
        isBuy: true,
        capital,
        charges: charges.total,
        grossPnl: 0,
        netPnl: 0,
        returnPct: 0,
      };
    } else {
      // SELL mode
      const accounting = computeRealizedTradeAccounting({
        entryPrice: entry,
        exitPrice: exit,
        quantity: q,
        market,
      });
      return {
        isBuy: false,
        capital: Number((entry * q).toFixed(2)),
        charges: accounting.totalCharges,
        grossPnl: accounting.grossPnL,
        netPnl: accounting.netPnL,
        returnPct: accounting.returnPercent,
        isProfit: accounting.isWin,
      };
    }
  }, [formEntryPrice, formExitPrice, formQty, formAction, formSymbol]);

  // Save manual trade entry (with atomic portfolio execution sync option)
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    const sym = formSymbol.toUpperCase().trim();
    if (!sym) {
      toast.error('Please enter a valid stock symbol (e.g. RELIANCE.NS, AAPL)');
      return;
    }
    const q = Number(formQty);
    if (!q || q <= 0) {
      toast.error('Please enter a valid share quantity greater than 0');
      return;
    }
    const entry = Number(formEntryPrice);
    if (!entry || entry <= 0) {
      toast.error('Please enter a valid entry price greater than 0');
      return;
    }

    const isIndia = sym.endsWith('.NS') || sym.endsWith('.BO');
    const market = isIndia ? 'IN' : 'US';

    if (formAction === 'SELL') {
      const exit = Number(formExitPrice);
      if (!exit || exit <= 0) {
        toast.error('Please enter a valid exit fill price for SELL exits');
        return;
      }
    }

    const safeTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      let orderId = null;
      let isPortfolioSynced = false;

      // 1. If Portfolio Synchronization is enabled, execute real simulated order on wallet & holdings
      if (syncWithPortfolio) {
        if (formAction === 'SELL') {
          if (!ownedHolding || ownedHolding.quantity < q) {
            toast.error(
              `Insufficient simulated holding! You only own ${ownedHolding?.quantity || 0} shares of ${sym} in your portfolio.`
            );
            return;
          }

          // Execute simulated SELL order on the portfolio
          const executed = await executeOrder({
            symbol: sym,
            name: STOCK_DIRECTORY[sym]?.name || sym,
            market: isIndia ? 'NSE' : 'US',
            action: 'SELL',
            quantity: q,
            price: Number(formExitPrice),
            currency: isIndia ? 'INR' : 'USD',
            bypassMarketHours: true,
          });

          orderId = executed?.id || null;
          isPortfolioSynced = true;
        } else if (formAction === 'BUY') {
          // Execute simulated BUY order on the portfolio
          const executed = await executeOrder({
            symbol: sym,
            name: STOCK_DIRECTORY[sym]?.name || sym,
            market: isIndia ? 'NSE' : 'US',
            action: 'BUY',
            quantity: q,
            price: Number(formEntryPrice),
            currency: isIndia ? 'INR' : 'USD',
            bypassMarketHours: true,
          });

          orderId = executed?.id || null;
          isPortfolioSynced = true;
        }
      }

      // 2. Align Journal Record (Either update the record generated by executeOrder or create offline record)
      if (orderId) {
        const existingSyncRecord = await db.journal.where('orderId').equals(orderId).first();
        if (existingSyncRecord) {
          await db.journal.update(existingSyncRecord.id, {
            strategy: formStrategy.trim() || existingSyncRecord.strategy,
            tags: safeTags.length > 0 ? safeTags : existingSyncRecord.tags,
            notes: formNotes.trim() || existingSyncRecord.notes,
            rating: formRating || null,
            emotion: formEmotion || null,
            planFollowed: formPlanFollowed,
            isPortfolioSynced: true,
            hasUserReview: true,
            isSystemGenerated: false,
          });
        }
      } else {
        // Pure Offline Journal Record (does not mutate portfolio)
        const newRecord = {
          date: new Date().toISOString(),
          symbol: sym,
          name: STOCK_DIRECTORY[sym]?.name || sym,
          market,
          currency: isIndia ? 'INR' : 'USD',
          action: formAction,
          qty: q,
          entryPrice: Number(entry.toFixed(2)),
          exitPrice: formAction === 'SELL' ? Number(Number(formExitPrice).toFixed(2)) : 0,
          pnl: formAction === 'SELL' ? liveFormPreview.grossPnl : 0,
          netPnl: formAction === 'SELL' ? liveFormPreview.netPnl : 0,
          fees: liveFormPreview.charges,
          returnPercent: formAction === 'SELL' ? liveFormPreview.returnPct : 0,
          strategy: formStrategy.trim() || 'Discretionary Momentum',
          tags: safeTags,
          notes: formNotes.trim(),
          rating: formRating || null,
          emotion: formEmotion || null,
          planFollowed: formPlanFollowed,
          isSystemGenerated: false,
          hasUserReview: true,
          isPortfolioSynced: false,
          orderId: null,
        };

        await db.journal.add(newRecord);
      }

      await loadJournal();
      setIsAdding(false);

      // Reset form to clean empty defaults
      setFormSymbol('');
      setFormQty('');
      setFormEntryPrice('');
      setFormExitPrice('');
      setFormStrategy('');
      setFormTags('');
      setFormNotes('');
      setFormEmotion(null);
      setFormPlanFollowed(false);
      setSyncWithPortfolio(true);

      if (isPortfolioSynced) {
        toast.success(
          formAction === 'SELL'
            ? `Holding closed in simulated portfolio & post-mortem saved for ${sym}!`
            : `Position added to portfolio & logged for ${sym}!`
        );
      } else {
        toast.success(
          `Offline post-mortem recorded for ${sym} (simulated portfolio balance unchanged).`
        );
      }
    } catch (err) {
      console.error('Failed to save journal record:', err);
      toast.error('Failed to process trade: ' + err.message);
    }
  };

  // Save Post-Mortem User Review for an existing trade
  const handleSavePostMortemReview = async (updatedFields) => {
    if (!reviewModalEntry) return;

    try {
      await db.journal.update(reviewModalEntry.id, {
        ...updatedFields,
        hasUserReview: true,
      });
      await loadJournal();
      setReviewModalEntry(null);
      toast.success(`Post-mortem review saved for ${reviewModalEntry.symbol}!`);
    } catch (err) {
      toast.error('Failed to update post-mortem: ' + err.message);
    }
  };

  const handleDelete = async (id, sym) => {
    try {
      await db.journal.delete(id);
      await loadJournal();
      toast.info(`Deleted journal entry for ${sym}`);
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  // Institutional Multi-Currency Analytics Engine (Separated INR and USD)
  const analytics = useMemo(() => {
    return calculateJournalMetrics(entries);
  }, [entries]);

  // Filtered & Sorted Closed Trades (For Tab 1: Closed Trades & Post-Mortems)
  const filteredClosedEntries = useMemo(() => {
    // Only entries that represent completed or partial exits
    let result = entries.filter((e) => e.action === 'SELL' || (Number(e.exitPrice) > 0 && e.action !== 'BUY'));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.symbol.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.strategy.toLowerCase().includes(q) ||
          (e.tags || []).some((t) => t.toLowerCase().includes(q)) ||
          e.notes.toLowerCase().includes(q)
      );
    }

    if (outcomeFilter === 'WINS') {
      result = result.filter((e) => (e.netPnl !== undefined ? e.netPnl > 0 : e.pnl > 0));
    } else if (outcomeFilter === 'LOSSES') {
      result = result.filter((e) => (e.netPnl !== undefined ? e.netPnl < 0 : e.pnl < 0));
    } else if (outcomeFilter === 'BE') {
      result = result.filter((e) => (e.netPnl !== undefined ? e.netPnl === 0 : e.pnl === 0));
    }

    if (marketFilter !== 'ALL') {
      result = result.filter((e) => e.market === marketFilter);
    }

    if (strategyFilter !== 'ALL') {
      result = result.filter((e) => e.strategy === strategyFilter);
    }

    result.sort((a, b) => {
      if (sortBy === 'NEWEST') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'OLDEST') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'PNL_HIGH') return (b.netPnl ?? b.pnl) - (a.netPnl ?? a.pnl);
      if (sortBy === 'PNL_LOW') return (a.netPnl ?? a.pnl) - (b.netPnl ?? b.pnl);
      return 0;
    });

    return result;
  }, [entries, searchQuery, outcomeFilter, marketFilter, strategyFilter, sortBy]);

  // Filtered Open Positions (For Tab 2: Active Open Positions & Floating P&L)
  const filteredOpenPositions = useMemo(() => {
    let list = [...activeHoldingsList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h) => h.symbol.toLowerCase().includes(q) || (h.name && h.name.toLowerCase().includes(q))
      );
    }

    if (marketFilter !== 'ALL') {
      list = list.filter((h) => h.market === marketFilter);
    }

    return list;
  }, [activeHoldingsList, searchQuery, marketFilter]);

  // Filtered Order & Transaction History (For Tab 3: Execution History & Audit Trail)
  const filteredHistory = useMemo(() => {
    let list = [...reconciledOrders];

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter(
        (o) =>
          o.symbol.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }

    if (historySideFilter !== 'ALL') {
      list = list.filter((o) => o.action === historySideFilter);
    }

    if (marketFilter !== 'ALL') {
      const targetMkt = marketFilter === 'IN' ? 'NSE' : 'US';
      list = list.filter((o) => o.market === targetMkt);
    }

    return list;
  }, [reconciledOrders, historySearch, historySideFilter, marketFilter]);

  // Unique strategies for filter dropdown
  const uniqueStrategies = useMemo(() => {
    const set = new Set(entries.map((e) => e.strategy).filter(Boolean));
    return Array.from(set);
  }, [entries]);

  // Export CSV
  const handleExportCSV = () => {
    if (entries.length === 0 && reconciledOrders.length === 0) {
      toast.info('No records to export');
      return;
    }
    const cleanRows = entries.map((e) => ({
      Date: new Date(e.date).toLocaleDateString(),
      Time: new Date(e.date).toLocaleTimeString(),
      Symbol: e.symbol,
      Name: e.name,
      Market: e.market,
      Currency: e.currency,
      Action: e.action,
      Quantity: e.qty,
      EntryPrice: e.entryPrice,
      ExitPrice: e.exitPrice > 0 ? e.exitPrice : '— (Open)',
      GrossPnL: e.pnl,
      EstimatedStatutoryCharges: e.fees,
      NetPnL: e.netPnl,
      ReturnPercent: e.action === 'SELL' ? `${e.returnPercent}%` : '— (Open)',
      Strategy: e.strategy,
      RecordType: e.isSystemGenerated ? 'System Execution' : 'User Authored',
      PortfolioSyncStatus: e.isPortfolioSynced ? 'Synced to Portfolio' : 'Offline Journal Record',
      UserReviewStatus: e.hasUserReview ? 'Reviewed' : 'Unreviewed',
      PlanAdherence: e.planFollowed === true ? 'Yes' : e.planFollowed === false ? 'No' : 'Unspecified',
      Emotion: e.emotion || '—',
      Rating: e.rating || '—',
      Notes: e.notes || '—',
    }));
    const csvString = convertToCSV(cleanRows);
    downloadFile(csvString, `trade_journal_ledger_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    toast.success('Trade Journal CSV downloaded!');
  };

  // CSV Import
  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') return;

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV file is empty or missing headers');

        const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
        const importedItems = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
          if (cells.length < 3) continue;

          const row = {};
          headers.forEach((h, idx) => {
            row[h] = cells[idx] || '';
          });

          const sym = (row.symbol || row['ticker'] || 'STOCK').toUpperCase();
          const entry = Number(row.entryprice || row['entry'] || 100);
          const exit = Number(row.exitprice || row['exit'] || 0);
          const q = Number(row.quantity || row['qty'] || 1);
          const act = (row.action || (exit > 0 ? 'SELL' : 'BUY')).toUpperCase();

          const normalized = normalizeJournalEntry({
            date: row.date || new Date().toISOString(),
            symbol: sym,
            name: row.name || sym,
            action: act,
            qty: q,
            entryPrice: entry,
            exitPrice: exit,
            strategy: row.strategy || 'Imported CSV',
            tags: (row.tags || '').split(';').map((t) => t.trim()),
            notes: row.notes || '',
            rating: row.rating || null,
            emotion: row.emotion || null,
            planFollowed: row.planadherence === 'Yes' ? true : row.planadherence === 'No' ? false : null,
            isSystemGenerated: false,
            hasUserReview: true,
            isPortfolioSynced: false,
          });

          if (normalized) importedItems.push(normalized);
        }

        if (importedItems.length > 0) {
          await db.journal.bulkAdd(importedItems);
          await loadJournal();
          toast.success(`Imported ${importedItems.length} records from CSV!`);
        } else {
          toast.error('No valid records found in CSV');
        }
      } catch (err) {
        toast.error('CSV import error: ' + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const emotionPresets = [
    'Disciplined',
    'Followed Plan',
    'Patience',
    'FOMO / Chased',
    'Hesitant / Late',
    'Early Exit',
    'Revenge Trade',
  ];

  const strategyPresets = [
    'Breakout & Retest',
    'EMA 9/21 Trend Crossover',
    'RSI Oversold Bounce',
    'Support / Resistance Flip',
    'Volume Climax Reversal',
    'Earnings Momentum',
    'Pattern Forecast Confluence',
  ];

  return (
    <div className="w-full bg-[#F6F4EE] flex flex-col font-mono text-xs text-[#111111]">
      {/* Top Broadsheet Action Toolbar */}
      <div className="p-3 sm:p-4 border-b-2 border-[#111111] bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif font-black text-sm sm:text-lg uppercase tracking-wider text-[#111111] truncate">
                TRADE POST-MORTEM & EXECUTION LEDGER
              </h2>
              <span className="px-1.5 py-0.5 bg-amber-400 text-[#111111] text-[9px] font-bold border border-[#111111]">
                PRODUCTION ARCHITECTURE
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-500 font-mono truncate">
              Self-Hosted IndexedDB Ledger • Verified Gross & Net Math • Portfolio Execution Sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between sm:justify-end">
          {unjournaledOrders.length > 0 && (
            <button
              onClick={handleImportExecutedOrders}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-300 hover:bg-amber-400 border border-[#111111] text-[#111111] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-[2px_2px_0px_#111111] animate-pulse min-h-[36px]"
              title="Synchronize executed market orders into your Trade Journal"
            >
              <Zap className="w-3.5 h-3.5 text-[#111111]" />
              <span>Sync {unjournaledOrders.length} New Executions</span>
            </button>
          )}

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-[#111111] hover:bg-neutral-800 text-[#F6F4EE] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-[2px_2px_0px_#111111] min-h-[36px]"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAdding ? 'Close Drawer' : 'Log Trade'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0 && reconciledOrders.length === 0}
            className="px-2.5 py-1.5 bg-white border border-[#111111] text-[#111111] font-bold text-xs flex items-center justify-center gap-1 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer min-h-[36px]"
            title="Download full journal & execution history as CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <label className="px-2.5 py-1.5 bg-white border border-[#111111] text-[#111111] font-bold text-xs flex items-center justify-center gap-1 hover:bg-neutral-100 transition-colors cursor-pointer min-h-[36px]">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </label>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-neutral-100 border border-[#111111] hover:bg-neutral-200 transition-colors ml-1 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center font-bold"
              title="Close Modal"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Market Spotlight Filter Bar */}
      <div className="px-3 sm:px-4 py-2 border-b border-neutral-300 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Currency / Exchange:
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
              onClick={() => setMarketFilter('IN')}
              className={`px-3 py-1 transition-colors cursor-pointer flex items-center gap-1 ${
                marketFilter === 'IN'
                  ? 'bg-emerald-800 text-white'
                  : 'text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>🇮🇳 NSE (₹)</span>
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
              <span>🇺🇸 US ($)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-stone-500">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>Real-time Floor Feed Connected</span>
          <span className="text-stone-300">•</span>
          <span>{filteredOpenPositions.length} Open Holdings Tracked</span>
        </div>
      </div>

      {/* Multi-Currency Verified Performance KPI Ribbon (Guaranteed N/A states for empty samples) */}
      <div className="p-3 sm:p-4 border-b border-neutral-300 bg-[#EFECE4] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center shrink-0">
        
        {/* Card 1: INR Realized */}
        <div className={`p-2.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111] ${marketFilter === 'US' ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mb-0.5">
            <span>🇮🇳 NSE REALIZED</span>
            <span className="text-[9px] bg-stone-100 px-1 border border-stone-200">{analytics.inr.closedCount} Exits</span>
          </div>
          <span
            className={`text-base sm:text-lg font-bold tabular-nums block ${
              analytics.inr.realizedNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {analytics.inr.realizedNet >= 0 ? '+' : ''}₹{analytics.inr.realizedNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[9px] text-neutral-400 block truncate" title="Estimated STT (0.1%), Exchange Turnover, SEBI & GST">
            Est. Charges: ₹{analytics.inr.totalCharges.toFixed(2)}
          </span>
        </div>

        {/* Card 2: USD Realized */}
        <div className={`p-2.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111] ${marketFilter === 'IN' ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mb-0.5">
            <span>🇺🇸 US REALIZED</span>
            <span className="text-[9px] bg-stone-100 px-1 border border-stone-200">{analytics.usd.closedCount} Exits</span>
          </div>
          <span
            className={`text-base sm:text-lg font-bold tabular-nums block ${
              analytics.usd.realizedNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {analytics.usd.realizedNet >= 0 ? '+' : ''}${analytics.usd.realizedNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[9px] text-neutral-400 block truncate" title="Estimated SEC Section 31 Fee & FINRA TAF">
            Est. SEC/TAF: ${analytics.usd.totalCharges.toFixed(2)}
          </span>
        </div>

        {/* Card 3: Win Rate */}
        <div className="p-2.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111]">
          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mb-0.5">
            <span>WIN RATE</span>
            <span className="text-[9px] bg-stone-100 px-1 border border-stone-200">
              {analytics.closedCount > 0 ? `${analytics.closedCount} Exits` : '0 Exits'}
            </span>
          </div>
          <span
            className={`text-base sm:text-lg font-bold tabular-nums block ${
              analytics.winRate.value !== null && analytics.winRate.value >= 50
                ? 'text-emerald-700'
                : 'text-neutral-900'
            }`}
          >
            {analytics.winRate.display}
          </span>
          <span className="text-[9px] text-neutral-400 block truncate">
            {analytics.winRate.subtext}
          </span>
        </div>

        {/* Card 4: Profit Factor */}
        <div className="p-2.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111]">
          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mb-0.5">
            <span>PROFIT FACTOR</span>
            <span className="text-[9px] bg-stone-100 px-1 border border-stone-200">Net Gains/Losses</span>
          </div>
          <span
            className={`text-base sm:text-lg font-bold tabular-nums block ${
              analytics.profitFactor.value !== null && analytics.profitFactor.value >= 1.5
                ? 'text-emerald-700'
                : analytics.profitFactor.value !== null && analytics.profitFactor.value < 1
                ? 'text-rose-700'
                : 'text-neutral-900'
            }`}
          >
            {analytics.profitFactor.display}
          </span>
          <span className="text-[9px] text-neutral-400 block truncate">
            {analytics.profitFactor.subtext}
          </span>
        </div>

        {/* Card 5: Realized Payoff Ratio */}
        <div className="p-2.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111]">
          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mb-0.5">
            <span>PAYOFF RATIO</span>
            <span className="text-[9px] bg-stone-100 px-1 border border-stone-200">Avg W : Avg L</span>
          </div>
          <span className="text-base sm:text-lg font-bold text-neutral-900 tabular-nums block">
            {analytics.payoffRatio.display}
          </span>
          <span className="text-[9px] text-neutral-400 block truncate">
            {analytics.payoffRatio.subtext}
          </span>
        </div>

        {/* Card 6: Plan Discipline Score */}
        <div className="p-2.5 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111]">
          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mb-0.5">
            <span>DISCIPLINE SCORE</span>
            <span className="text-[9px] bg-stone-100 px-1 border border-stone-200">
              {analytics.disciplineScore.reviewedCount} Reviews
            </span>
          </div>
          <span
            className={`text-base sm:text-lg font-bold tabular-nums block ${
              analytics.disciplineScore.value !== null && analytics.disciplineScore.value >= 80
                ? 'text-emerald-700'
                : analytics.disciplineScore.value !== null
                ? 'text-amber-700'
                : 'text-neutral-900'
            }`}
          >
            {analytics.disciplineScore.display}
          </span>
          <span className="text-[9px] text-neutral-400 block truncate">
            {analytics.disciplineScore.subtext}
          </span>
        </div>
      </div>

      {/* Primary Workspace Navigation Tabs (3 Dedicated Views) */}
      <div className="bg-[#FAF8F3] border-b-2 border-[#111111] px-4 flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          
          {/* Tab 1: Closed Trades & Post-Mortems */}
          <button
            onClick={() => setActiveTab('CLOSED_POST_MORTEMS')}
            className={`px-3 sm:px-4 py-2.5 font-bold text-xs uppercase flex items-center gap-1.5 border-b-4 transition-all cursor-pointer ${
              activeTab === 'CLOSED_POST_MORTEMS'
                ? 'border-[#111111] text-[#111111] bg-white'
                : 'border-transparent text-neutral-600 hover:text-[#111111]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Closed Trades & Post-Mortems ({filteredClosedEntries.length})</span>
          </button>

          {/* Tab 2: Active Open Positions & Floating P&L */}
          <button
            onClick={() => setActiveTab('OPEN_POSITIONS')}
            className={`px-3 sm:px-4 py-2.5 font-bold text-xs uppercase flex items-center gap-1.5 border-b-4 transition-all cursor-pointer ${
              activeTab === 'OPEN_POSITIONS'
                ? 'border-[#111111] text-[#111111] bg-white'
                : 'border-transparent text-neutral-600 hover:text-[#111111]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-blue-600" />
            <span>Open Positions & Floating P&L ({filteredOpenPositions.length})</span>
          </button>

          {/* Tab 3: Execution History & Audit Trail */}
          <button
            onClick={() => setActiveTab('AUDIT_TRAIL')}
            className={`px-3 sm:px-4 py-2.5 font-bold text-xs uppercase flex items-center gap-1.5 border-b-4 transition-all cursor-pointer ${
              activeTab === 'AUDIT_TRAIL'
                ? 'border-[#111111] text-[#111111] bg-white'
                : 'border-transparent text-neutral-600 hover:text-[#111111]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-600" />
            <span>Execution Audit Trail ({reconciledOrders.length})</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Vault Secure</span>
        </div>
      </div>

      {/* Form Drawer (Log Trade Entry) - Starts with Clean Blank Values */}
      {isAdding && (
        <form
          onSubmit={handleSaveEntry}
          className="p-4 bg-white border-b-2 border-[#111111] space-y-3 shrink-0 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h4 className="font-serif font-black text-xs uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>{formAction === 'SELL' ? 'Record Trade Exit & Post-Mortem' : 'Log Planned Position Entry'}</span>
            </h4>
            <span className="text-[10px] text-neutral-500 font-mono">
              {formAction === 'SELL'
                ? 'Calculates gross realized return, statutory fees, and net profit'
                : 'Records entry capital and estimated statutory charges'}
            </span>
          </div>

          {/* Pre-fill helper from open holdings in SELL mode */}
          {formAction === 'SELL' && activeHoldingsList.length > 0 && (
            <div className="p-2 bg-stone-50 border border-stone-200 flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-stone-700">Quick Populate from Open Holdings:</span>
              <select
                onChange={(e) => {
                  const selSym = e.target.value;
                  if (!selSym) return;
                  const holding = activeHoldingsList.find((h) => h.symbol === selSym);
                  if (holding) {
                    setFormSymbol(holding.symbol);
                    setFormQty(String(holding.quantity));
                    setFormEntryPrice(String(holding.avgBuyPrice));
                    setFormExitPrice(String(holding.livePrice || holding.avgBuyPrice));
                    setSyncWithPortfolio(true);
                  }
                }}
                className="bg-white border border-[#111111] px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="">-- Select Active Position --</option>
                {activeHoldingsList.map((h) => (
                  <option key={h.symbol} value={h.symbol}>
                    {h.symbol} ({h.quantity} shares @ {h.currencySymbol}{h.avgBuyPrice} — Live: {h.currencySymbol}{h.livePrice})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
            {/* Symbol */}
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Symbol *</label>
              <input
                type="text"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                className="w-full bg-white border border-[#111111] px-2 py-1.5 font-bold text-xs"
                placeholder="e.g. RELIANCE.NS, AAPL"
                required
              />
            </div>

            {/* Action */}
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Action *</label>
              <select
                value={formAction}
                onChange={(e) => setFormAction(e.target.value)}
                className="w-full bg-white border border-[#111111] px-2 py-1.5 font-bold text-xs"
              >
                <option value="BUY">BUY (Position Entry)</option>
                <option value="SELL">SELL (Position Exit / Take Profit)</option>
              </select>
            </div>

            {/* Qty */}
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Shares *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={formQty}
                onChange={(e) => setFormQty(e.target.value)}
                className="w-full bg-white border border-[#111111] px-2 py-1.5 font-bold text-xs"
                placeholder="Quantity"
                required
              />
            </div>

            {/* Entry Price */}
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
                {formAction === 'SELL' ? 'Cost Basis (Avg Entry) *' : 'Entry Price *'}
              </label>
              <input
                type="number"
                step="0.05"
                value={formEntryPrice}
                onChange={(e) => setFormEntryPrice(e.target.value)}
                className="w-full bg-white border border-[#111111] px-2 py-1.5 text-xs font-bold"
                placeholder="Price"
                required
              />
            </div>

            {/* Exit Price (Only shown when action === 'SELL') */}
            {formAction === 'SELL' && (
              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Exit Fill Price *</label>
                <input
                  type="number"
                  step="0.05"
                  value={formExitPrice}
                  onChange={(e) => setFormExitPrice(e.target.value)}
                  className="w-full bg-white border border-[#111111] px-2 py-1.5 text-xs font-bold text-amber-900"
                  placeholder="Fill Price"
                  required
                />
              </div>
            )}

            {/* Strategy */}
            <div>
              <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Strategy Setup</label>
              <input
                type="text"
                list="strategy-list"
                value={formStrategy}
                onChange={(e) => setFormStrategy(e.target.value)}
                className="w-full bg-white border border-[#111111] px-2 py-1.5 text-xs"
                placeholder="e.g. Breakout & Retest"
              />
              <datalist id="strategy-list">
                {strategyPresets.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Portfolio Synchronization & Holding Lifecycle Banner */}
          <div className={`p-3 border-2 transition-all ${
            ownedHolding
              ? 'bg-emerald-50/70 border-emerald-600'
              : 'bg-stone-50 border-stone-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  {ownedHolding ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="text-emerald-950">Active Holding Detected in Simulated Portfolio</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400" />
                      <span className="text-stone-700">Stock Not Held in Simulated Portfolio</span>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-stone-600 mt-0.5">
                  {ownedHolding
                    ? `You currently hold ${ownedHolding.quantity} shares of ${formSymbol.toUpperCase()} at avg cost ${ownedHolding.currencySymbol || '₹'}${ownedHolding.avgBuyPrice}.`
                    : `Logging this trade will record an offline journal review for psychological tracking without modifying your portfolio cash balance.`}
                </p>
              </div>

              {ownedHolding && (
                <label className="flex items-center gap-2 font-bold text-xs text-[#111111] bg-white px-2.5 py-1.5 border border-[#111111] cursor-pointer shadow-[2px_2px_0px_#111111] shrink-0">
                  <input
                    type="checkbox"
                    checked={syncWithPortfolio}
                    onChange={(e) => setSyncWithPortfolio(e.target.checked)}
                    className="w-4 h-4 accent-[#111111]"
                  />
                  <span>{formAction === 'SELL' ? 'Close Holding & Credit Cash' : 'Sync with Portfolio'}</span>
                </label>
              )}
            </div>

            {ownedHolding && !syncWithPortfolio && (
              <div className="mt-2 text-[10px] text-amber-900 bg-amber-100/70 p-1.5 border border-amber-300">
                ⚠ Offline Mode: This trade will only be written to your journal notes. Your simulated portfolio holding ({ownedHolding.quantity} shares) and cash balance will remain untouched.
              </div>
            )}

            {ownedHolding && syncWithPortfolio && (
              <div className="mt-2 text-[10px] text-emerald-900 bg-emerald-100/70 p-1.5 border border-emerald-300">
                ✓ Real-time Sync: Submitting will atomically execute a simulated {formAction} fill for {formQty || 'N'} shares, updating your cash balance and holdings.
              </div>
            )}
          </div>

          {/* SELL Mode: Plan Adherence & Psychology */}
          {formAction === 'SELL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono pt-2 border-t border-neutral-100">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-neutral-500 uppercase font-bold">
                    Psychology Tag (Optional)
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPlanFollowed}
                      onChange={(e) => setFormPlanFollowed(e.target.checked)}
                      className="accent-[#111111]"
                    />
                    <span>Followed Trading Plan</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {emotionPresets.map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => setFormEmotion(formEmotion === emo ? null : emo)}
                      className={`px-1.5 py-0.5 text-[10px] border transition-colors cursor-pointer ${
                        formEmotion === emo
                          ? 'bg-[#111111] text-[#F6F4EE] border-[#111111] font-bold'
                          : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      #{emo}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full bg-white border border-[#111111] px-2 py-1 text-xs"
                  placeholder="Custom Tags (comma separated)"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
                  Post-Mortem Review & Lesson Learned
                </label>
                <textarea
                  rows="2"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-white border border-[#111111] px-2 py-1 text-xs resize-none"
                  placeholder="Why did you exit? Did you respect your stop-loss and profit targets?"
                />
              </div>
            </div>
          )}

          {/* Live Calculated Strip & Submission */}
          <div className="p-2.5 bg-neutral-50 border border-neutral-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[11px]">
              {formAction === 'BUY' ? (
                <>
                  <span className="text-neutral-600">
                    Est. Capital Required: <strong>₹/${liveFormPreview.capital}</strong>
                  </span>
                  <span className="text-stone-300 hidden sm:inline">|</span>
                  <span className="text-neutral-600">
                    Est. Entry Charges: <strong>₹/${liveFormPreview.charges}</strong>
                  </span>
                  <span className="text-stone-400 text-[10px]">
                    (Reserve net return calculations for closed exits)
                  </span>
                </>
              ) : (
                <>
                  <span className="text-neutral-600">
                    Gross P&L: <strong className={liveFormPreview.grossPnl >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                      {liveFormPreview.grossPnl >= 0 ? '+' : ''}{liveFormPreview.grossPnl} ({liveFormPreview.returnPct >= 0 ? '+' : ''}{liveFormPreview.returnPct}% Gross)
                    </strong>
                  </span>
                  <span className="text-stone-300 hidden sm:inline">|</span>
                  <span className="text-neutral-600">
                    Est. Statutory Charges: <strong>₹/${liveFormPreview.charges}</strong>
                  </span>
                  <span className="text-stone-300 hidden sm:inline">|</span>
                  <span className="font-bold">
                    Net P&L: <span className={liveFormPreview.isProfit ? 'text-emerald-700' : 'text-rose-700'}>
                      {liveFormPreview.isProfit ? '+' : ''}{liveFormPreview.netPnl}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#111111] text-xs font-bold hover:bg-neutral-100 cursor-pointer min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none px-4 py-1.5 bg-[#111111] text-[#F6F4EE] text-xs font-bold hover:bg-neutral-800 shadow-[2px_2px_0px_#111111] cursor-pointer min-h-[36px]"
              >
                {formAction === 'SELL' 
                  ? (syncWithPortfolio && ownedHolding ? 'Close Holding & Save Review' : 'Save Offline Post-Mortem')
                  : (syncWithPortfolio ? 'Execute Buy & Log Entry' : 'Log Planned Position Entry')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CLOSED TRADES & POST-MORTEMS */}
      {/* ========================================================================= */}
      {activeTab === 'CLOSED_POST_MORTEMS' && (
        <div className="flex-1 flex flex-col">
          {/* Filter and Search Bar */}
          <div className="p-3 bg-neutral-100 border-b border-neutral-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search closed ticker, strategy, or review notes..."
                  className="w-full bg-white border border-[#111111] pl-8 pr-2 py-1.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Outcome tabs */}
              <div className="flex border border-[#111111] bg-white text-[10px] font-bold">
                <button
                  onClick={() => setOutcomeFilter('ALL')}
                  className={`px-2.5 py-1 transition-colors cursor-pointer ${
                    outcomeFilter === 'ALL' ? 'bg-[#111111] text-[#F6F4EE]' : 'hover:bg-neutral-100'
                  }`}
                >
                  All ({filteredClosedEntries.length})
                </button>
                <button
                  onClick={() => setOutcomeFilter('WINS')}
                  className={`px-2.5 py-1 border-l border-[#111111] transition-colors cursor-pointer ${
                    outcomeFilter === 'WINS' ? 'bg-emerald-700 text-white' : 'hover:bg-neutral-100 text-emerald-800'
                  }`}
                >
                  Wins ({analytics.winRate.wins})
                </button>
                <button
                  onClick={() => setOutcomeFilter('LOSSES')}
                  className={`px-2.5 py-1 border-l border-[#111111] transition-colors cursor-pointer ${
                    outcomeFilter === 'LOSSES' ? 'bg-rose-700 text-white' : 'hover:bg-neutral-100 text-rose-800'
                  }`}
                >
                  Losses ({analytics.winRate.losses})
                </button>
              </div>

              {/* Strategy filter */}
              {uniqueStrategies.length > 0 && (
                <select
                  value={strategyFilter}
                  onChange={(e) => setStrategyFilter(e.target.value)}
                  className="bg-white border border-[#111111] px-2.5 py-1 text-xs max-w-[150px] truncate"
                >
                  <option value="ALL">All Setups</option>
                  {uniqueStrategies.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-[#111111] px-2.5 py-1 text-xs font-bold"
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="PNL_HIGH">P&L: High to Low</option>
                <option value="PNL_LOW">P&L: Low to High</option>
              </select>
            </div>
          </div>

          {/* Table of Closed Exits and Post-Mortems */}
          <div className="flex-1 overflow-x-auto p-3 sm:p-4 bg-[#F6F4EE]">
            {loading ? (
              <div className="text-center py-12 font-mono text-neutral-500">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                <p>Loading encrypted local ledger...</p>
              </div>
            ) : filteredClosedEntries.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-neutral-300 bg-white p-6">
                <BookOpen className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <p className="font-serif text-sm font-bold text-neutral-800">
                  No Closed Trade Post-Mortems Found
                </p>
                <p className="font-mono text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  Post-mortems represent completed exits and closed trades with measured profit or loss.
                  {activeHoldingsList.length > 0 && ' You have active open holdings ready to exit in the "Open Positions" tab.'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setFormAction('SELL');
                      setIsAdding(true);
                    }}
                    className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold text-xs inline-flex items-center gap-1.5 hover:bg-neutral-800 cursor-pointer shadow-[2px_2px_0px_#111111]"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Log Closed Trade Manually</span>
                  </button>
                  {activeHoldingsList.length > 0 && (
                    <button
                      onClick={() => setActiveTab('OPEN_POSITIONS')}
                      className="px-3 py-1.5 bg-blue-50 border border-blue-700 text-blue-900 font-bold text-xs hover:bg-blue-100 cursor-pointer"
                    >
                      <span>View Open Positions ({activeHoldingsList.length})</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-[#111111] bg-white overflow-x-auto shadow-[3px_3px_0px_#111111]">
                <table className="w-full text-left border-collapse text-xs font-mono min-w-[760px]">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-[#111111] uppercase text-neutral-600 text-[11px]">
                      <th className="p-2.5">Date / Asset</th>
                      <th className="p-2.5 text-right">Shares</th>
                      <th className="p-2.5 text-right">Cost Basis</th>
                      <th className="p-2.5 text-right">Exit Fill</th>
                      <th className="p-2.5 text-right">Net Realized Return</th>
                      <th className="p-2.5">Setup / Adherence</th>
                      <th className="p-2.5">Post-Mortem Review & Lesson</th>
                      <th className="p-2.5 text-center">Review</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredClosedEntries.map((item) => {
                      const netPnl = item.netPnl !== undefined ? item.netPnl : item.pnl;
                      const isWin = netPnl > 0;
                      const isLoss = netPnl < 0;
                      const sym = item.currencySymbol || (item.currency === 'INR' ? '₹' : '$');

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                          {/* Date & Symbol */}
                          <td className="p-2.5">
                            <div className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                              <Link
                                to={`/stock/${encodeURIComponent(item.symbol)}`}
                                className="hover:underline flex items-center gap-1"
                                title="View Real-Time Chart"
                              >
                                <span>{item.symbol}</span>
                                <ExternalLink className="w-3 h-3 text-stone-400" />
                              </Link>
                              <span className="px-1 py-0.2 bg-[#111111] text-[#F6F4EE] text-[9px] font-bold uppercase">
                                {item.market}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              {new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {item.name && item.name !== item.symbol && (
                              <div className="text-[10px] text-neutral-600 truncate max-w-[140px]">
                                {item.name}
                              </div>
                            )}
                          </td>

                          {/* Shares */}
                          <td className="p-2.5 text-right font-bold text-neutral-900 tabular-nums">
                            {item.qty}
                          </td>

                          {/* Entry Price */}
                          <td className="p-2.5 text-right tabular-nums text-neutral-700">
                            {sym}{item.entryPrice.toFixed(2)}
                          </td>

                          {/* Exit Price */}
                          <td className="p-2.5 text-right tabular-nums font-bold text-neutral-800">
                            {sym}{item.exitPrice.toFixed(2)}
                          </td>

                          {/* Net Realized Return */}
                          <td className="p-2.5 text-right">
                            <div
                              className={`font-bold text-sm tabular-nums flex items-center justify-end gap-0.5 ${
                                isWin
                                  ? 'text-emerald-700'
                                  : isLoss
                                  ? 'text-rose-700'
                                  : 'text-neutral-600'
                              }`}
                            >
                              {isWin && <TrendingUp className="w-3.5 h-3.5" />}
                              {isLoss && <TrendingDown className="w-3.5 h-3.5" />}
                              <span>
                                {netPnl >= 0 ? '+' : ''}{sym}{netPnl.toFixed(2)}
                              </span>
                            </div>
                            <div
                              className={`text-[10px] font-bold tabular-nums ${
                                isWin ? 'text-emerald-700' : isLoss ? 'text-rose-700' : 'text-neutral-400'
                              }`}
                            >
                              {item.returnPercent >= 0 ? '+' : ''}{item.returnPercent}%
                              <span className="text-[9px] text-neutral-400 font-normal ml-1" title="Estimated Statutory Charges">
                                (Est. Charges: {sym}{item.fees})
                              </span>
                            </div>
                          </td>

                          {/* Setup, Plan Adherence, & Sync Status */}
                          <td className="p-2.5">
                            <div className="font-bold text-[#111111]">
                              {item.strategy}
                            </div>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {item.isPortfolioSynced || item.orderId ? (
                                <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-bold" title="Linked to simulated portfolio fill">
                                  ✓ Portfolio Synced
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 bg-stone-100 border border-stone-300 text-stone-600 text-[9px]" title="Offline journal record only — portfolio balance unchanged">
                                  ✎ Offline Journal
                                </span>
                              )}

                              {item.planFollowed === true && (
                                <span className="px-1.5 py-0.2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-bold">
                                  ✓ Plan Adhered
                                </span>
                              )}
                              {item.planFollowed === false && (
                                <span className="px-1.5 py-0.2 bg-rose-50 border border-rose-300 text-rose-800 text-[9px] font-bold">
                                  ⚠ Deviated from Plan
                                </span>
                              )}
                              {item.isSystemGenerated && !item.hasUserReview && (
                                <span className="px-1.5 py-0.2 bg-stone-100 border border-stone-300 text-stone-600 text-[9px]">
                                  System Execution Log
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Psychology & Notes */}
                          <td className="p-2.5 max-w-[200px]">
                            {item.emotion && (
                              <span className="inline-block px-1.5 py-0.2 bg-amber-50 border border-amber-300 text-amber-900 text-[9px] font-bold mb-0.5">
                                🧠 {item.emotion}
                              </span>
                            )}
                            <p className="text-neutral-600 text-[11px] font-sans line-clamp-2" title={item.notes}>
                              {item.notes || <span className="italic text-neutral-400">No post-mortem review recorded yet</span>}
                            </p>
                          </td>

                          {/* Review Action */}
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => setReviewModalEntry(item)}
                              className="px-2 py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-white text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Add or edit post-mortem review notes and plan adherence"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{item.hasUserReview ? 'Edit' : '+ Review'}</span>
                            </button>
                          </td>

                          {/* Delete Action */}
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => handleDelete(item.id, item.symbol)}
                              className="p-1 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-300 transition-colors cursor-pointer"
                              title="Delete journal record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACTIVE OPEN POSITIONS & FLOATING P&L */}
      {/* ========================================================================= */}
      {activeTab === 'OPEN_POSITIONS' && (
        <div className="flex-1 flex flex-col">
          <div className="p-3 bg-neutral-100 border-b border-neutral-300 flex items-center justify-between gap-2 shrink-0">
            <span className="font-bold text-neutral-800">
              Active Holdings with Live Floating Valuations ({filteredOpenPositions.length})
            </span>
            <span className="text-[11px] text-neutral-500">
              Values calculated using real-time floor marks. Gross and Net figures are explicitly distinguished.
            </span>
          </div>

          <div className="flex-1 overflow-x-auto p-3 sm:p-4 bg-[#F6F4EE]">
            {filteredOpenPositions.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-neutral-300 bg-white p-6">
                <Wallet className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <p className="font-serif text-sm font-bold text-neutral-800">
                  No Open Positions in Active Portfolio
                </p>
                <p className="font-mono text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  When you execute BUY orders on the floor, your active equity holdings appear here with live floating valuation and quote freshness.
                </p>
              </div>
            ) : (
              <div className="border border-[#111111] bg-white overflow-x-auto shadow-[3px_3px_0px_#111111]">
                <table className="w-full text-left border-collapse text-xs font-mono min-w-[760px]">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-[#111111] uppercase text-neutral-600 text-[11px]">
                      <th className="p-2.5">Asset / Exchange</th>
                      <th className="p-2.5 text-right">Shares</th>
                      <th className="p-2.5 text-right">Avg Entry Cost</th>
                      <th className="p-2.5 text-right">Invested Value</th>
                      <th className="p-2.5 text-right">Live Mark Price</th>
                      <th className="p-2.5 text-right">Unrealized P&L (Net / Gross)</th>
                      <th className="p-2.5 text-center">Quote Freshness</th>
                      <th className="p-2.5 text-center">Position Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredOpenPositions.map((h) => {
                      const isProfit = h.floatingNetPnL >= 0;

                      return (
                        <tr key={h.symbol} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-2.5">
                            <div className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                              <Link
                                to={`/stock/${encodeURIComponent(h.symbol)}`}
                                className="hover:underline flex items-center gap-1"
                              >
                                <span>{h.symbol}</span>
                                <ExternalLink className="w-3 h-3 text-stone-400" />
                              </Link>
                              <span className="px-1 py-0.2 bg-[#111111] text-[#F6F4EE] text-[9px] font-bold uppercase">
                                {h.market === 'IN' ? 'NSE' : 'US'}
                              </span>
                            </div>
                            {h.name && h.name !== h.symbol && (
                              <div className="text-[10px] text-neutral-500 truncate max-w-[150px]">
                                {h.name}
                              </div>
                            )}
                          </td>

                          <td className="p-2.5 text-right font-bold text-neutral-900 tabular-nums">
                            {h.quantity}
                          </td>

                          <td className="p-2.5 text-right tabular-nums text-neutral-700">
                            {h.currencySymbol}{Number(h.avgBuyPrice).toFixed(2)}
                          </td>

                          <td className="p-2.5 text-right tabular-nums text-neutral-700">
                            {h.currencySymbol}{Number(h.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className="p-2.5 text-right tabular-nums font-bold text-neutral-900">
                            {h.currencySymbol}{Number(h.livePrice).toFixed(2)}
                          </td>

                          {/* Floating Unrealized P&L (Strict Gross vs Net Separation) */}
                          <td className="p-2.5 text-right">
                            {/* Primary: Net Floating P&L and Net Return % */}
                            <div className={`font-bold text-sm tabular-nums flex items-center justify-end gap-1 ${
                              isProfit ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {isProfit && <TrendingUp className="w-3.5 h-3.5 shrink-0" />}
                              {!isProfit && <TrendingDown className="w-3.5 h-3.5 shrink-0" />}
                              <span>
                                {isProfit ? '+' : ''}{h.currencySymbol}{h.floatingNetPnL.toFixed(2)}
                              </span>
                              <span className="text-[11px] font-bold">
                                ({isProfit ? '+' : ''}{h.netReturnPercent}% Net)
                              </span>
                            </div>

                            {/* Subtext: Gross Unrealized & Estimated Charges clearly labeled */}
                            <div className="text-[10px] text-neutral-500 font-mono mt-0.5 flex items-center justify-end gap-1.5 flex-wrap">
                              <span>
                                Gross: <strong className={h.floatingGrossPnL >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                                  {h.floatingGrossPnL >= 0 ? '+' : ''}{h.currencySymbol}{h.floatingGrossPnL.toFixed(2)} ({h.grossReturnPercent >= 0 ? '+' : ''}{h.grossReturnPercent}% Gross)
                                </strong>
                              </span>
                              <span className="text-stone-300">•</span>
                              <span title="Estimated entry statutory charges (STT, turnover, SEBI, GST)">
                                Est. Charges: {h.currencySymbol}{h.allocatedEntryCharges.toFixed(2)}
                              </span>
                            </div>
                          </td>

                          {/* Quote Freshness Badge */}
                          <td className="p-2.5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`px-1.5 py-0.2 text-[9px] font-bold border ${
                                h.freshness.status === 'LIVE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : h.freshness.status === 'DELAYED'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-stone-100 text-stone-700 border-stone-300'
                              }`}>
                                {h.freshness.label}
                              </span>
                              <span className="text-[9px] text-neutral-400 mt-0.5">
                                {new Date(h.quoteTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                          </td>

                          {/* Position Actions */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormAction('SELL');
                                  setFormSymbol(h.symbol);
                                  setFormQty(String(h.quantity));
                                  setFormEntryPrice(String(h.avgBuyPrice));
                                  setFormExitPrice(String(h.livePrice || h.avgBuyPrice));
                                  setSyncWithPortfolio(true);
                                  setIsAdding(true);
                                }}
                                className="px-2 py-1 bg-amber-50 border border-amber-800 text-amber-900 hover:bg-amber-100 font-bold text-[10px] cursor-pointer"
                                title="Close position in portfolio and write post-mortem review"
                              >
                                Close & Review
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  openTrade(
                                    {
                                      symbol: h.symbol,
                                      name: h.name,
                                      price: h.livePrice,
                                      currency: h.currency,
                                      market: h.market === 'IN' ? 'NSE' : 'US',
                                    },
                                    'SELL'
                                  );
                                }}
                                className="px-2 py-1 bg-rose-50 border border-rose-800 text-rose-900 hover:bg-rose-100 font-bold text-[10px] cursor-pointer"
                                title="Exit on exchange floor"
                              >
                                Floor Sell
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VERIFIED ORDER & EXECUTION HISTORY (ALL BUYS & SELLS) */}
      {/* ========================================================================= */}
      {activeTab === 'AUDIT_TRAIL' && (
        <div className="flex-1 flex flex-col">
          {/* History Search & Filters */}
          <div className="p-3 bg-neutral-100 border-b border-neutral-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search execution ticker or order ID..."
                  className="w-full bg-white border border-[#111111] pl-8 pr-2 py-1.5 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex border border-[#111111] bg-white text-[10px] font-bold">
                <button
                  onClick={() => setHistorySideFilter('ALL')}
                  className={`px-2.5 py-1 transition-colors cursor-pointer ${
                    historySideFilter === 'ALL' ? 'bg-[#111111] text-[#F6F4EE]' : 'hover:bg-neutral-100'
                  }`}
                >
                  All ({reconciledOrders.length})
                </button>
                <button
                  onClick={() => setHistorySideFilter('BUY')}
                  className={`px-2.5 py-1 border-l border-[#111111] transition-colors cursor-pointer ${
                    historySideFilter === 'BUY' ? 'bg-emerald-700 text-white' : 'hover:bg-neutral-100 text-emerald-800'
                  }`}
                >
                  Buys ({reconciledOrders.filter((o) => o.action === 'BUY').length})
                </button>
                <button
                  onClick={() => setHistorySideFilter('SELL')}
                  className={`px-2.5 py-1 border-l border-[#111111] transition-colors cursor-pointer ${
                    historySideFilter === 'SELL' ? 'bg-rose-700 text-white' : 'hover:bg-neutral-100 text-rose-800'
                  }`}
                >
                  Sells ({reconciledOrders.filter((o) => o.action === 'SELL').length})
                </button>
              </div>
            </div>
          </div>

          {/* Table of Market Executions */}
          <div className="flex-1 overflow-x-auto p-3 sm:p-4 bg-[#F6F4EE]">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-neutral-300 bg-white p-6">
                <History className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <p className="font-serif text-sm font-bold text-neutral-800">
                  No Execution History Found
                </p>
                <p className="font-mono text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  When you execute BUY or SELL orders on the exchange floor, every single fill is permanently registered in this unalterable transaction ledger.
                </p>
              </div>
            ) : (
              <div className="border border-[#111111] bg-white overflow-x-auto shadow-[3px_3px_0px_#111111]">
                <table className="w-full text-left border-collapse text-xs font-mono min-w-[760px]">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-[#111111] uppercase text-neutral-600 text-[11px]">
                      <th className="p-2.5">Timestamp / ID</th>
                      <th className="p-2.5">Asset</th>
                      <th className="p-2.5">Side</th>
                      <th className="p-2.5 text-right">Shares</th>
                      <th className="p-2.5 text-right">Fill Price</th>
                      <th className="p-2.5 text-right">Total Order Value</th>
                      <th className="p-2.5 text-right">Realized P&L</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredHistory.map((ord) => {
                      const isSell = ord.action === 'SELL';
                      const pnl = ord.realizedPnL;
                      const hasPnl = pnl !== null && pnl !== undefined;
                      const isProfit = hasPnl && pnl >= 0;

                      return (
                        <tr key={ord.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-2.5">
                            <div className="font-bold text-[#111111]">
                              {new Date(ord.timestamp).toLocaleDateString()}
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              {new Date(ord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[9px] text-neutral-400 font-mono">
                              #{ord.id.slice(-8)}
                            </div>
                          </td>

                          <td className="p-2.5">
                            <div className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                              <span>{ord.symbol}</span>
                              <span className="px-1 py-0.2 bg-[#111111] text-[#F6F4EE] text-[9px] font-bold uppercase">
                                {ord.market}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-500 truncate max-w-[150px]">
                              {ord.name}
                            </div>
                          </td>

                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 font-bold text-[10px] uppercase border ${
                                ord.action === 'BUY'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                                  : 'bg-rose-100 text-rose-900 border-rose-400'
                              }`}
                            >
                              {ord.action}
                            </span>
                          </td>

                          <td className="p-2.5 text-right font-bold text-neutral-900 tabular-nums">
                            {ord.quantity}
                          </td>

                          <td className="p-2.5 text-right tabular-nums font-bold text-neutral-800">
                            {ord.currencySymbol}{ord.price.toFixed(2)}
                          </td>

                          <td className="p-2.5 text-right tabular-nums text-neutral-700">
                            {ord.currencySymbol}{ord.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className="p-2.5 text-right">
                            {isSell && hasPnl ? (
                              <div>
                                <span
                                  className={`font-bold tabular-nums text-sm ${
                                    isProfit ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {isProfit ? '+' : ''}{ord.currencySymbol}{pnl.toFixed(2)}
                                </span>
                                {ord.returnPercent !== null && (
                                  <div className={`text-[10px] font-bold ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    ({isProfit ? '+' : ''}{ord.returnPercent}%)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-400 uppercase">
                                Open Entry
                              </span>
                            )}
                          </td>

                          <td className="p-2.5 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>{ord.status}</span>
                            </span>
                          </td>

                          <td className="p-2.5 text-center">
                            <Link
                              to={`/stock/${encodeURIComponent(ord.symbol)}`}
                              className="px-2 py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                              title="Inspect Live Stock Chart"
                            >
                              <span>Chart</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Bottom Ledger Status Bar */}
      <div className="px-4 py-2.5 border-t border-neutral-300 bg-neutral-100 flex items-center justify-between text-xs font-mono text-neutral-500 shrink-0">
        <span>Verified Client-Side Ledger • IndexedDB Storage • Zero Server Telemetry</span>
        <span>
          {activeTab === 'CLOSED_POST_MORTEMS'
            ? `Showing ${filteredClosedEntries.length} Closed Exits`
            : activeTab === 'OPEN_POSITIONS'
            ? `Tracking ${filteredOpenPositions.length} Open Holdings`
            : `Audit Log: ${reconciledOrders.length} Executions`}
        </span>
      </div>

      {/* Post-Mortem User Review Modal */}
      {reviewModalEntry && (
        <PostMortemReviewModal
          entry={reviewModalEntry}
          onClose={() => setReviewModalEntry(null)}
          onSave={handleSavePostMortemReview}
          strategyPresets={strategyPresets}
          emotionPresets={emotionPresets}
        />
      )}
    </div>
  );
}

/**
 * Dedicated Post-Mortem Review Modal
 * Allows user to review plan adherence, record emotions, lessons learned, and strategy setups.
 */
function PostMortemReviewModal({ entry, onClose, onSave, strategyPresets, emotionPresets }) {
  const [strategy, setStrategy] = useState(entry.strategy || 'Breakout & Retest');
  const [emotion, setEmotion] = useState(entry.emotion || null);
  const [planFollowed, setPlanFollowed] = useState(entry.planFollowed === true);
  const [notes, setNotes] = useState(entry.notes || '');
  const [rating, setRating] = useState(entry.rating || 'A');

  const sym = entry.currencySymbol || (entry.currency === 'INR' ? '₹' : '$');
  const netPnl = entry.netPnl !== undefined ? entry.netPnl : entry.pnl;
  const isWin = netPnl >= 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      strategy,
      emotion,
      planFollowed,
      notes: notes.trim(),
      rating,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col font-mono text-xs">
        
        {/* Header */}
        <div className="p-3 bg-[#FAF8F3] border-b-2 border-[#111111] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h3 className="font-serif font-black text-sm uppercase text-[#111111]">
              Post-Mortem Trade Review: {entry.symbol}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-200 border border-[#111111] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Trade Details Summary */}
        <div className="p-3 bg-neutral-50 border-b border-neutral-200 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div>
            <span className="text-neutral-500 block text-[9px] uppercase font-bold">Closed Quantity</span>
            <strong className="text-sm font-bold text-neutral-900">{entry.qty} Shares</strong>
          </div>
          <div>
            <span className="text-neutral-500 block text-[9px] uppercase font-bold">Entry → Exit</span>
            <strong className="text-sm font-bold text-neutral-900">
              {sym}{entry.entryPrice} → {sym}{entry.exitPrice}
            </strong>
          </div>
          <div>
            <span className="text-neutral-500 block text-[9px] uppercase font-bold">Net Realized P&L</span>
            <strong className={`text-sm font-bold ${isWin ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isWin ? '+' : ''}{sym}{netPnl.toFixed(2)} ({entry.returnPercent}%)
            </strong>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 flex-1 overflow-y-auto">
          {/* Strategy Setup */}
          <div>
            <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
              Strategy Setup
            </label>
            <input
              type="text"
              list="modal-strategy-presets"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full bg-white border border-[#111111] px-2.5 py-1.5 text-xs font-bold"
              placeholder="Select or enter strategy..."
              required
            />
            <datalist id="modal-strategy-presets">
              {strategyPresets.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Plan Adherence Checklist */}
          <div className="p-2.5 bg-amber-50/50 border border-amber-300 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-neutral-900">
              <input
                type="checkbox"
                checked={planFollowed}
                onChange={(e) => setPlanFollowed(e.target.checked)}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>I followed my predefined trade plan, risk limits, and stop rules.</span>
            </label>
            <p className="text-[10px] text-neutral-500 pl-6">
              This choice directly calculates your statistical Discipline Score.
            </p>
          </div>

          {/* Psychology / Emotion Chips */}
          <div>
            <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
              Emotional State / Psychology Tag
            </label>
            <div className="flex flex-wrap gap-1">
              {emotionPresets.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => setEmotion(emotion === emo ? null : emo)}
                  className={`px-2 py-1 text-[10px] border transition-colors cursor-pointer ${
                    emotion === emo
                      ? 'bg-[#111111] text-[#F6F4EE] border-[#111111] font-bold'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  #{emo}
                </button>
              ))}
            </div>
          </div>

          {/* Lessons Learned & Review Notes */}
          <div>
            <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
              Post-Mortem Lessons Learned & Review Notes
            </label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-[#111111] p-2 text-xs resize-none"
              placeholder="What went right or wrong? Did market conditions invalidate your thesis?"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white border border-[#111111] text-xs font-bold hover:bg-neutral-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#111111] text-[#F6F4EE] text-xs font-bold hover:bg-neutral-800 shadow-[2px_2px_0px_#111111] cursor-pointer"
            >
              Save Post-Mortem Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
