import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Zap, 
  Target,
  Send
} from 'lucide-react';
import { db } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { STOCK_DIRECTORY, getInstantInitialQuotes } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import HoldingSparkline from './HoldingSparkline';
import { toast } from 'sonner';

export default function AlertsManagerModal({ isOpen, onClose, currentStock }) {
  const { userProfile } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [livePrices, setLivePrices] = useState(() => getInstantInitialQuotes());
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Form state
  const [symbol, setSymbol] = useState(currentStock?.symbol || 'RELIANCE.NS');
  const [condition, setCondition] = useState('GTE'); // 'GTE' | 'LTE' | 'RSI_GTE' | 'RSI_LTE'
  const [targetValue, setTargetValue] = useState(currentStock?.price || 1250);

  // Extract user holdings list
  const holdingsList = useMemo(() => {
    const raw = userProfile?.holdings;
    if (raw && typeof raw === 'object') {
      return Object.values(raw).filter(h => h && h.quantity > 0);
    }
    // Fallback to local storage if profile is still syncing
    try {
      const local = JSON.parse(localStorage.getItem('paper_trading_mock_user') || '{}');
      if (local?.holdings && typeof local.holdings === 'object') {
        return Object.values(local.holdings).filter(h => h && h.quantity > 0);
      }
    } catch {
      // ignore
    }
    return [];
  }, [userProfile]);

  // Map holdings by symbol for fast lookup
  const holdingsMap = useMemo(() => {
    const map = {};
    holdingsList.forEach(h => {
      if (h?.symbol) {
        map[h.symbol] = h;
        map[h.symbol.replace(/[^a-zA-Z0-9]/g, '_')] = h;
      }
    });
    return map;
  }, [holdingsList]);

  // Subscribe to omniFeed live prices when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      if (prices && Object.keys(prices).length > 0) {
        setLivePrices(prev => ({ ...prev, ...prices }));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  // Load alerts from Dexie
  const loadAlerts = async () => {
    try {
      const allAlerts = await db.alerts.reverse().toArray();
      setAlerts(allAlerts || []);
    } catch (err) {
      console.error('Failed to load alerts from DB:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  // Sync symbol / price when currentStock changes
  useEffect(() => {
    if (currentStock?.symbol) {
      setSymbol(currentStock.symbol);
      if (currentStock.price) {
        setTargetValue(Number(currentStock.price.toFixed(2)));
      }
    }
  }, [currentStock]);

  // Escape key handler to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Helper to get Stock Full Name
  const getStockName = (sym) => {
    if (!sym) return 'Unknown Asset';
    const held = holdingsMap[sym];
    if (held?.name) return held.name;
    const dir = STOCK_DIRECTORY[sym];
    if (dir?.name) return dir.name;
    return sym;
  };

  // Helper to get Live Price for a symbol
  const getLivePrice = (sym) => {
    const quote = livePrices[sym];
    if (quote?.price) return quote.price;
    if (currentStock?.symbol === sym && currentStock.price) return currentStock.price;
    const dir = STOCK_DIRECTORY[sym];
    if (dir?.basePrice) return dir.basePrice;
    const held = holdingsMap[sym];
    if (held?.avgBuyPrice) return held.avgBuyPrice;
    return 100;
  };

  // Helper for Currency Symbol
  const getCurrencySymbol = (sym) => {
    const isIndia = sym?.endsWith('.NS') || sym?.endsWith('.BO') || holdingsMap[sym]?.currency === 'INR';
    return isIndia ? '₹' : '$';
  };

  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      setNotificationPermission(res);
      if (res === 'granted') {
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
          } catch {
            // Service worker registration optional failover
          }
        }
        toast.success('Browser notifications enabled! You will be alerted on price triggers.');
      } else if (res === 'denied') {
        toast.error('Notifications blocked. Please permit notifications in your browser settings.');
      }
    }
  };

  const handleTestNotification = () => {
    const testTitle = '🔔 TraderVault Alert Test';
    const testBody = 'Desktop notification verified! Real-time alerts will pop up when stocks hit your targets.';

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(testTitle, {
          body: testBody,
          icon: '/logo.png',
        });
        toast.success('Test desktop notification sent to your operating system!');
      } catch (err) {
        toast.error('Failed to trigger notification: ' + err.message);
      }
    } else {
      toast.info('Notification permission is not granted yet. Click "Enable Notifications" first.', {
        description: testBody,
      });
    }
  };

  const handleSelectSymbol = (selectedSym) => {
    setSymbol(selectedSym);
    const p = getLivePrice(selectedSym);
    setTargetValue(Number(p.toFixed(2)));
  };

  // 1-Click Preset Alert creation directly from holding
  const handleQuickPreset = async (holding, presetType) => {
    const sym = holding.symbol;
    const stockName = holding.name || getStockName(sym);
    const livePrice = getLivePrice(sym);
    const costBasis = holding.avgBuyPrice;
    let target = livePrice;
    let cond = 'GTE';
    let label = '';

    if (presetType === 'TP_5') {
      target = Number((costBasis * 1.05).toFixed(2));
      cond = 'GTE';
      label = '+5% Take Profit';
    } else if (presetType === 'TP_10') {
      target = Number((costBasis * 1.10).toFixed(2));
      cond = 'GTE';
      label = '+10% Take Profit';
    } else if (presetType === 'SL_3') {
      target = Number((costBasis * 0.97).toFixed(2));
      cond = 'LTE';
      label = '-3% Stop Loss';
    } else if (presetType === 'SL_5') {
      target = Number((costBasis * 0.95).toFixed(2));
      cond = 'LTE';
      label = '-5% Stop Loss';
    } else if (presetType === 'BE') {
      target = Number(costBasis.toFixed(2));
      cond = livePrice < costBasis ? 'GTE' : 'LTE';
      label = 'Break-Even';
    }

    const market = sym.includes('.NS') || sym.includes('.BO') ? 'IN' : 'US';
    const currSym = getCurrencySymbol(sym);

    await db.alerts.add({
      symbol: sym.toUpperCase(),
      name: stockName,
      market,
      condition: cond,
      targetValue: target,
      active: true,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
      isHoldingAlert: true,
      holdingQty: holding.quantity,
      holdingAvgCost: holding.avgBuyPrice,
    });

    await loadAlerts();
    toast.success(`Alert Created: ${sym} (${stockName})`, {
      description: `${label} rule set for ${cond === 'GTE' ? '≥' : '≤'} ${currSym}${target}`,
    });
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    const sym = symbol.toUpperCase().trim();
    const stockName = getStockName(sym);
    const held = holdingsMap[sym];

    await db.alerts.add({
      symbol: sym,
      name: stockName,
      market: sym.includes('.NS') || sym.includes('.BO') ? 'IN' : 'US',
      condition,
      targetValue: Number(targetValue),
      active: true,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
      isHoldingAlert: !!held,
      holdingQty: held ? held.quantity : null,
      holdingAvgCost: held ? held.avgBuyPrice : null,
    });

    await loadAlerts();
    toast.success(`Alert added for ${stockName} (${sym})`);
  };

  const handleDeleteAlert = async (id, alertSymbol) => {
    await db.alerts.delete(id);
    await loadAlerts();
    toast.info(`Alert removed for ${alertSymbol}`);
  };

  const currentSelectedStockName = getStockName(symbol);
  const currentSelectedHeld = holdingsMap[symbol];
  const currentSelectedPrice = getLivePrice(symbol);
  const currentSelectedCurrency = getCurrencySymbol(symbol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#111111] bg-[#111111] text-[#F6F4EE] shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base uppercase tracking-wider">
                Local Alerts & Browser Notifications
              </h3>
              <p className="text-[10px] font-mono text-neutral-400">
                100% Client-Side Engine • Monitors Active Portfolio Holdings & Watchlist Assets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer"
            title="Close Alerts Desk [Esc]"
          >
            <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">[Esc]</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification Permission & Test Banner */}
        <div className="p-3 bg-neutral-100 border-b border-neutral-300 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-700" />
            <span>
              OS Notifications:{' '}
              <strong className={
                notificationPermission === 'granted' 
                  ? 'text-emerald-700 font-bold' 
                  : notificationPermission === 'denied'
                  ? 'text-rose-700 font-bold'
                  : 'text-amber-700 font-bold'
              }>
                {notificationPermission.toUpperCase()}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="px-2.5 py-1 bg-[#111111] text-[#F6F4EE] font-bold text-[10px] uppercase hover:bg-neutral-800 transition-colors"
              >
                Enable Notifications
              </button>
            )}
            <button
              onClick={handleTestNotification}
              className="px-2.5 py-1 bg-white border border-[#111111] text-[#111111] font-bold text-[10px] uppercase hover:bg-neutral-200 transition-colors flex items-center gap-1"
              title="Test a browser notification immediately"
            >
              <Send className="w-3 h-3 text-amber-600" />
              <span>Test Notification</span>
            </button>
          </div>
        </div>

        {/* Scrollable Container for Holdings & Forms */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-300">
          
          {/* SECTION 1: Active Portfolio Holdings */}
          <div className="p-4 bg-[#EFECE4]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-neutral-800" />
                <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#111111]">
                  Your Portfolio Holdings ({holdingsList.length})
                </h4>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                1-Click Preset Alerts for Stop-Loss & Take-Profit
              </span>
            </div>

            {holdingsList.length === 0 ? (
              <div className="p-3 bg-white border border-dashed border-neutral-300 text-center font-mono text-xs text-neutral-600">
                <p className="font-bold text-neutral-700">No active stock holdings in your portfolio yet.</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Execute paper trades in the market to view your positions and set quick stop-loss or profit-target alerts here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {holdingsList.map((h) => {
                  const sym = h.symbol;
                  const stockName = h.name || getStockName(sym);
                  const currPrice = getLivePrice(sym);
                  const currSym = getCurrencySymbol(sym);
                  const totalCost = h.totalCost || (h.quantity * h.avgBuyPrice);
                  const currentVal = h.quantity * currPrice;
                  const pnl = currentVal - totalCost;
                  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
                  const isProfit = pnl >= 0;

                  return (
                    <div 
                      key={sym} 
                      className="p-3 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111] font-mono text-xs space-y-2"
                    >
                      {/* Ticker & Name & P&L Status */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-[#111111]">{sym}</span>
                            <span className="px-1.5 py-0.2 bg-[#111111] text-[#F6F4EE] text-[9px] font-bold uppercase">
                              {h.market || (sym.includes('.NS') ? 'NSE' : 'US')}
                            </span>
                            <span className={`px-1 py-0.2 border text-[8px] font-bold uppercase inline-flex items-center gap-0.5 ${
                              isProfit
                                ? 'bg-emerald-50 border-emerald-700 text-emerald-800'
                                : 'bg-rose-50 border-rose-700 text-rose-800'
                            }`}>
                              {isProfit ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                              <span>{isProfit ? 'PROFIT' : 'LOSS'}</span>
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-600 font-serif font-medium truncate max-w-[180px]" title={stockName}>
                            {stockName}
                          </div>
                        </div>

                        {/* P&L & Sparkline */}
                        <div className="flex items-center gap-2">
                          <HoldingSparkline
                            symbol={sym}
                            entryPrice={h.avgBuyPrice}
                            currentPrice={currPrice}
                            width={80}
                            height={26}
                          />
                          <div className="text-right">
                            <div className="font-bold text-xs text-[#111111]">
                              {currSym}{currPrice.toFixed(2)}
                            </div>
                            <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                              <span>{isProfit ? '+' : ''}{pnlPercent.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Details Strip: Entry Price, Quantity, Unrealized P&L */}
                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-neutral-200 text-[10px] text-neutral-600">
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase font-bold">ENTRY PRICE:</span>
                          <strong className="text-neutral-900">{currSym}{h.avgBuyPrice.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase font-bold">HELD:</span>
                          <strong className="text-neutral-900">{h.quantity} shs</strong>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[9px] uppercase font-bold">UNREALIZED P&L:</span>
                          <span className={isProfit ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {isProfit ? '+' : ''}{currSym}{pnl.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* 1-Click Fast Presets */}
                      <div className="pt-2 border-t border-neutral-200">
                        <div className="text-[9px] font-bold text-neutral-500 uppercase mb-1 flex items-center justify-between">
                          <span>Quick 1-Click Alerts:</span>
                          <button
                            type="button"
                            onClick={() => handleSelectSymbol(sym)}
                            className="text-[#111111] underline hover:text-amber-700 text-[9px]"
                          >
                            Custom...
                          </button>
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-[9px]">
                          <button
                            onClick={() => handleQuickPreset(h, 'TP_5')}
                            className="px-1 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-center transition-colors"
                            title="Alert when price hits +5% from cost basis"
                          >
                            +5% TP
                          </button>
                          <button
                            onClick={() => handleQuickPreset(h, 'TP_10')}
                            className="px-1 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-center transition-colors"
                            title="Alert when price hits +10% from cost basis"
                          >
                            +10% TP
                          </button>
                          <button
                            onClick={() => handleQuickPreset(h, 'SL_3')}
                            className="px-1 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold text-center transition-colors"
                            title="Alert when price drops -3% from cost basis"
                          >
                            -3% SL
                          </button>
                          <button
                            onClick={() => handleQuickPreset(h, 'SL_5')}
                            className="px-1 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold text-center transition-colors"
                            title="Alert when price drops -5% from cost basis"
                          >
                            -5% SL
                          </button>
                          <button
                            onClick={() => handleQuickPreset(h, 'BE')}
                            className="px-1 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 font-bold text-center transition-colors"
                            title="Alert when price crosses back to your entry cost basis"
                          >
                            B-Even
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Custom Alert Form */}
          <div className="p-4 bg-white">
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4 text-neutral-800" />
              <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#111111]">
                Configure Target Alert Rule
              </h4>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Stock Selector / Input */}
                <div>
                  <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
                    Select Stock / Ticker
                  </label>
                  <select
                    value={symbol}
                    onChange={(e) => handleSelectSymbol(e.target.value)}
                    className="w-full border border-[#111111] px-2 py-1.5 font-bold bg-white text-xs"
                  >
                    {holdingsList.length > 0 && (
                      <optgroup label="💼 Your Active Portfolio Holdings">
                        {holdingsList.map((h) => (
                          <option key={h.symbol} value={h.symbol}>
                            {h.symbol} — {h.name || h.symbol} ({h.quantity} shs)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Standard Market Universe">
                      {Object.entries(STOCK_DIRECTORY).map(([k, s]) => (
                        <option key={k} value={k}>
                          {k} — {s.name} ({s.market})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
                    Trigger Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full border border-[#111111] px-2 py-1.5 font-bold bg-white text-xs"
                  >
                    <option value="GTE">Price &ge; Target (Take-Profit / Upper)</option>
                    <option value="LTE">Price &le; Target (Stop-Loss / Dip)</option>
                    <option value="RSI_GTE">RSI &ge; Overbought (RSI &ge; 70)</option>
                    <option value="RSI_LTE">RSI &le; Oversold (RSI &le; 30)</option>
                  </select>
                </div>

                {/* Target Value */}
                <div>
                  <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">
                    Target Value ({currentSelectedCurrency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      value={targetValue}
                      onChange={(e) => setTargetValue(Number(e.target.value))}
                      className="w-full border border-[#111111] px-2 py-1.5 font-bold text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Selected Stock Live Snapshot Banner */}
              <div className="p-2.5 bg-neutral-50 border border-neutral-300 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="font-serif font-bold text-neutral-900">
                    {currentSelectedStockName} <span className="font-mono text-neutral-500 text-[10px]">({symbol})</span>
                  </div>
                  {currentSelectedHeld && (
                    <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[9px] uppercase">
                      💼 Held: {currentSelectedHeld.quantity} shs @ {currentSelectedCurrency}{currentSelectedHeld.avgBuyPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span>Live: <strong className="text-neutral-900">{currentSelectedCurrency}{currentSelectedPrice.toFixed(2)}</strong></span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setTargetValue(Number((currentSelectedPrice * 1.02).toFixed(2)))}
                      className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-700 text-neutral-700 font-bold"
                    >
                      +2%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetValue(Number((currentSelectedPrice * 1.05).toFixed(2)))}
                      className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-700 text-neutral-700 font-bold"
                    >
                      +5%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetValue(Number((currentSelectedPrice * 0.98).toFixed(2)))}
                      className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-700 text-neutral-700 font-bold"
                    >
                      -2%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetValue(Number((currentSelectedPrice * 0.95).toFixed(2)))}
                      className="px-1.5 py-0.5 bg-white border border-neutral-300 hover:border-neutral-700 text-neutral-700 font-bold"
                    >
                      -5%
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#111111] text-[#F6F4EE] font-bold text-xs uppercase hover:bg-neutral-800 flex items-center gap-1.5 shadow-[2px_2px_0px_#111111]"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Activate Target Alert</span>
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: Active Configured Alerts */}
          <div className="p-4 bg-[#F6F4EE]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-neutral-800" />
                <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#111111]">
                  Active Alert Rules ({alerts.length})
                </h4>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                Continuous Browser Evaluation
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-neutral-300 bg-white">
                <Bell className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                <p className="font-serif text-sm font-bold text-neutral-700">No Alerts Configured</p>
                <p className="font-mono text-xs text-neutral-500 mt-1 max-w-md mx-auto">
                  Set alerts on your portfolio holdings or any watchlist stock above. When prices hit your targets, a native OS desktop notification and in-app sound will trigger.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alt) => {
                  const stockName = alt.name || getStockName(alt.symbol);
                  const isHeld = !!holdingsMap[alt.symbol];
                  const liveP = getLivePrice(alt.symbol);
                  const currSym = getCurrencySymbol(alt.symbol);
                  
                  // Calculate distance to target
                  let distanceText = '';
                  if (alt.condition === 'GTE') {
                    const diff = alt.targetValue - liveP;
                    const diffPct = ((diff / liveP) * 100);
                    distanceText = diff <= 0 ? 'Target Reached!' : `${diffPct.toFixed(1)}% above current`;
                  } else if (alt.condition === 'LTE') {
                    const diff = liveP - alt.targetValue;
                    const diffPct = ((diff / liveP) * 100);
                    distanceText = diff <= 0 ? 'Target Reached!' : `${diffPct.toFixed(1)}% below current`;
                  }

                  return (
                    <div
                      key={alt.id}
                      className="p-3 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-mono flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#111111]">{alt.symbol}</span>
                          <span className="font-serif font-bold text-neutral-800 text-xs">
                            {stockName}
                          </span>
                          {isHeld && (
                            <span className="px-1.5 py-0.2 bg-amber-100 border border-amber-300 text-amber-900 text-[9px] font-bold uppercase">
                              💼 Held
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                          <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 font-bold text-neutral-900">
                            {alt.condition === 'GTE'
                              ? `Price ≥ ${currSym}${alt.targetValue}`
                              : alt.condition === 'LTE'
                              ? `Price ≤ ${currSym}${alt.targetValue}`
                              : alt.condition === 'RSI_GTE'
                              ? `RSI ≥ ${alt.targetValue}`
                              : `RSI ≤ ${alt.targetValue}`}
                          </span>

                          <span>
                            Current: <strong>{currSym}{liveP.toFixed(2)}</strong>
                          </span>

                          <span className="text-neutral-400">
                            • {distanceText}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-[10px]">
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold uppercase">
                            Active
                          </span>
                          {alt.lastTriggeredAt && (
                            <div className="text-[9px] text-neutral-400 mt-0.5">
                              Last: {new Date(alt.lastTriggeredAt).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteAlert(alt.id, alt.symbol)}
                          className="p-1.5 hover:bg-rose-50 text-neutral-500 hover:text-rose-600 border border-transparent hover:border-rose-300 transition-colors"
                          title="Delete Alert"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-neutral-300 bg-neutral-100 flex items-center justify-between text-xs font-mono text-neutral-500 shrink-0">
          <span>Client-side continuous evaluation • Native OS desktop notifications</span>
          <span>{alerts.length} Active Rules</span>
        </div>
      </div>
    </div>
  );
}
