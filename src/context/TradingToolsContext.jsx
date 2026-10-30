import React, { createContext, useContext, useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { db } from '../lib/localDb';
import { STOCK_DIRECTORY, getInstantInitialQuotes } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import { triggerSelectiveToolAd } from '../config/adsterra';

const CommandPalette = lazy(() => import('../components/CommandPalette'));
const RiskCalculatorModal = lazy(() => import('../components/RiskCalculatorModal'));
const StockScreenerModal = lazy(() => import('../components/StockScreenerModal'));
const BacktesterModal = lazy(() => import('../components/BacktesterModal'));
const TradeJournalModal = lazy(() => import('../components/TradeJournalModal'));
const AlertsManagerModal = lazy(() => import('../components/AlertsManagerModal'));
const DataVaultModal = lazy(() => import('../components/DataVaultModal'));
const TradeModal = lazy(() => import('../components/TradeModal'));

const TradingToolsContext = createContext(null);

export function useTradingTools() {
  const ctx = useContext(TradingToolsContext);
  if (!ctx) throw new Error('useTradingTools must be used within TradingToolsProvider');
  return ctx;
}

export function TradingToolsProvider({ children }) {
  const navigate = useNavigate();
  const { userProfile, buyStock, sellStock } = useAuth();

  // Modals visibility state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [screenerOpen, setScreenerOpen] = useState(false);
  const [backtesterOpen, setBacktesterOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [riskCalcOpen, setRiskCalcOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  // Active contextual stock
  const [contextStock, setContextStock] = useState(null);
  const [tradeModalProps, setTradeModalProps] = useState(null);
  const [universeStocks, setUniverseStocks] = useState([]);

  // Active chart indicators state
  const [activeIndicators, setActiveIndicators] = useState({
    sma20: false,
    ema50: false,
    bbands: false,
    rsi: false,
  });

  // Global live stream price cache for alert evaluation
  const [streamPrices, setStreamPrices] = useState(() => getInstantInitialQuotes());

  // Subscribe to live market ticks across all stocks
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      if (prices && Object.keys(prices).length > 0) {
        setStreamPrices((prev) => ({ ...prev, ...prices }));
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Background multi-stock alert checker loop (Evaluates holdings & watchlist continuously)
  useEffect(() => {
    let intervalId = null;

    const checkAlerts = async () => {
      try {
        const activeAlerts = await db.alerts.filter((a) => a.active === true).toArray();
        if (activeAlerts.length === 0) return;

        // Current user holdings mapping
        const holdings = userProfile?.holdings || {};

        for (const alt of activeAlerts) {
          // Resolve live price from stream or context
          const quote = streamPrices[alt.symbol];
          const livePrice =
            contextStock && contextStock.symbol === alt.symbol && contextStock.price
              ? contextStock.price
              : quote?.price || STOCK_DIRECTORY[alt.symbol]?.basePrice;

          if (!livePrice || isNaN(livePrice)) continue;

          // Check cooldown (90 seconds minimum between repeat triggers to prevent spam)
          if (alt.lastTriggeredAt) {
            const diffMs = Date.now() - new Date(alt.lastTriggeredAt).getTime();
            if (diffMs < 90000) continue;
          }

          let triggered = false;
          if (alt.condition === 'GTE' && livePrice >= alt.targetValue) triggered = true;
          if (alt.condition === 'LTE' && livePrice <= alt.targetValue) triggered = true;

          if (triggered) {
            // Find holding info if user owns this stock
            const cleanKey = alt.symbol.replace(/[^a-zA-Z0-9]/g, '_');
            const held = holdings[alt.symbol] || holdings[cleanKey];
            const stockName = alt.name || STOCK_DIRECTORY[alt.symbol]?.name || alt.symbol;
            const isIndia = alt.symbol.endsWith('.NS') || alt.symbol.endsWith('.BO') || held?.currency === 'INR';
            const currSym = isIndia ? '₹' : '$';

            const heldNote =
              held && held.quantity > 0
                ? ` • 💼 You hold ${held.quantity} shs (@ ${currSym}${held.avgBuyPrice})`
                : '';

            const notifTitle = `🔔 Target Alert: ${stockName} (${alt.symbol})`;
            const notifBody = `Price reached ${currSym}${livePrice.toFixed(2)} (${
              alt.condition === 'GTE' ? '≥' : '≤'
            } ${currSym}${alt.targetValue})${heldNote}`;

            toast.info(notifTitle, {
              description: notifBody,
              duration: 7000,
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(notifTitle, {
                  body: notifBody,
                  icon: '/logo.png',
                });
              } catch (e) {
                // browser background notification restriction handled gracefully
              }
            }

            // Update alert with lastTriggeredAt to respect cooldown
            await db.alerts.update(alt.id, { lastTriggeredAt: new Date().toISOString() });
          }
        }
      } catch (err) {
        // silent local db error protection
      }
    };

    intervalId = setInterval(checkAlerts, 4000);
    return () => clearInterval(intervalId);
  }, [contextStock, streamPrices, userProfile]);

  const toggleIndicator = (name, forceState) => {
    setActiveIndicators((prev) => ({
      ...prev,
      [name]: forceState !== undefined ? forceState : !prev[name],
    }));
  };

  // Natural Language Command Dispatcher
  const handleExecuteCommand = (action) => {
    if (!action) return;

    switch (action.type) {
      case 'OPEN_PALETTE':
        setPaletteOpen(true);
        break;

      case 'NAVIGATE_STOCK':
        if (action.payload?.symbol) {
          navigate(`/stock/${action.payload.symbol}`);
          toast.success(`Opening ${action.payload.symbol}...`);
        }
        break;

      case 'OPEN_TRADE':
        setTradeModalProps({
          stock: { symbol: action.payload.symbol, price: 1000 },
          defaultAction: action.payload.action || 'BUY',
          initialQty: action.payload.qty || 1,
        });
        setTradeModalOpen(true);
        break;

      case 'SET_TIMEFRAME':
        toast.info(`Chart timeframe changed to ${action.payload.timeframe}`);
        break;

      case 'TOGGLE_INDICATOR':
        if (action.payload.indicator === 'RSI') toggleIndicator('rsi');
        if (action.payload.indicator === 'BBANDS') toggleIndicator('bbands');
        if (action.payload.indicator === 'SMA20') toggleIndicator('sma20');
        if (action.payload.indicator === 'EMA50') toggleIndicator('ema50');
        toast.success(`Indicator ${action.payload.indicator} toggled`);
        break;

      case 'CLEAR_INDICATORS':
        setActiveIndicators({ sma20: false, ema50: false, bbands: false, rsi: false });
        toast.info('All chart indicators cleared');
        break;

      case 'OPEN_SCREENER':
        setScreenerOpen(true);
        break;

      case 'OPEN_BACKTESTER':
        triggerSelectiveToolAd('backtest');
        setBacktesterOpen(true);
        break;

      case 'OPEN_JOURNAL':
        setJournalOpen(true);
        break;

      case 'OPEN_RISK_CALCULATOR':
      case 'CALCULATE_RISK':
        triggerSelectiveToolAd('risk-calculator');
        setRiskCalcOpen(true);
        break;

      case 'OPEN_ALERTS':
        setAlertsOpen(true);
        break;

      case 'OPEN_VAULT':
        triggerSelectiveToolAd('vault');
        setVaultOpen(true);
        break;

      case 'TRIGGER_SIGNALS':
        setScreenerOpen(true);
        break;

      default:
        break;
    }
  };

  const handleOpenTradeWithParams = (params) => {
    setTradeModalProps({
      stock: contextStock || { symbol: 'RELIANCE.NS', price: params.entryPrice || 1000 },
      defaultAction: 'BUY',
      initialQty: params.quantity || 1,
      targetPrice: params.target,
      stopLossPrice: params.stopLoss,
    });
    setTradeModalOpen(true);
  };

  const handleSelectFromScreener = (stock) => {
    setContextStock(stock);
    navigate(`/stock/${stock.symbol}`);
  };

  const value = {
    // Openers
    openPalette: () => setPaletteOpen(true),
    openScreener: (stocks) => {
      if (stocks) setUniverseStocks(stocks);
      setScreenerOpen(true);
    },
    openBacktester: (stock) => {
      if (stock) setContextStock(stock);
      triggerSelectiveToolAd('backtest');
      setBacktesterOpen(true);
    },
    openJournal: () => setJournalOpen(true),
    openRiskCalculator: (stock) => {
      if (stock) setContextStock(stock);
      triggerSelectiveToolAd('risk-calculator');
      setRiskCalcOpen(true);
    },
    openAlerts: () => setAlertsOpen(true),
    openVault: () => {
      triggerSelectiveToolAd('vault');
      setVaultOpen(true);
    },
    openTrade: (stock, action = 'BUY') => {
      setTradeModalProps({ stock, defaultAction: action });
      setTradeModalOpen(true);
    },
    // Context
    contextStock,
    setContextStock,
    activeIndicators,
    toggleIndicator,
    executeCommand: handleExecuteCommand,
  };

  return (
    <TradingToolsContext.Provider value={value}>
      {children}

      <Suspense fallback={null}>
        {/* Global Command Palette (Ctrl+K or '/') */}
        {paletteOpen && (
          <CommandPalette
            isOpen={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onExecuteCommand={handleExecuteCommand}
            context={{ activeStock: contextStock, activeIndicators }}
          />
        )}

        {/* Position Sizer & Risk-Reward Planner */}
        {riskCalcOpen && (
          <RiskCalculatorModal
            isOpen={riskCalcOpen}
            onClose={() => setRiskCalcOpen(false)}
            initialStock={contextStock}
            onSendToOrder={handleOpenTradeWithParams}
          />
        )}

        {/* Stock Screener & Market Heatmap */}
        {screenerOpen && (
          <StockScreenerModal
            isOpen={screenerOpen}
            onClose={() => setScreenerOpen(false)}
            onSelectStock={handleSelectFromScreener}
            onOpenTrade={(stock, action) => {
              setTradeModalProps({ stock, defaultAction: action || 'BUY' });
              setTradeModalOpen(true);
            }}
            onOpenRiskCalculator={(stock) => {
              if (stock) setContextStock(stock);
              setRiskCalcOpen(true);
            }}
          />
        )}

        {/* Strategy Backtester (Web Worker) */}
        {backtesterOpen && (
          <BacktesterModal
            isOpen={backtesterOpen}
            onClose={() => setBacktesterOpen(false)}
            currentStock={contextStock}
          />
        )}

        {/* Trade Journal & Performance Analytics */}
        {journalOpen && (
          <TradeJournalModal
            isOpen={journalOpen}
            onClose={() => setJournalOpen(false)}
            currentStock={contextStock}
          />
        )}

        {/* Local Alerts & Browser Notifications */}
        {alertsOpen && (
          <AlertsManagerModal
            isOpen={alertsOpen}
            onClose={() => setAlertsOpen(false)}
            currentStock={contextStock}
          />
        )}

        {/* Encrypted Local Data Vault (Web Crypto) */}
        {vaultOpen && (
          <DataVaultModal
            isOpen={vaultOpen}
            onClose={() => setVaultOpen(false)}
          />
        )}

        {/* Universal Trade Execution Modal */}
        {tradeModalOpen && tradeModalProps && (
          <TradeModal
            isOpen={tradeModalOpen}
            onClose={() => setTradeModalOpen(false)}
            stock={tradeModalProps.stock}
            initialAction={tradeModalProps.defaultAction}
            initialQty={tradeModalProps.initialQty}
          />
        )}
      </Suspense>
    </TradingToolsContext.Provider>
  );
}
