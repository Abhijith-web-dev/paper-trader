import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Calculator, 
  ShieldAlert, 
  ArrowRight, 
  DollarSign, 
  Target, 
  Percent, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  RefreshCw,
  Sliders,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Check,
  Command,
  Zap,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STOCK_DIRECTORY, fetchSingleYahooQuote } from '../lib/yahooFinance';
import { searchGlobalEquities } from '../lib/stockSearchEngine';

/**
 * Institutional Stock Risk & Volatility Intelligence
 * Analyzes market fundamentals, 52-week price range, and true intraday range
 * to learn the stock's natural ATR volatility profile.
 */
export function analyzeStockRiskProfile(symbol, livePrice, stockDirectoryItem) {
  const dirItem = stockDirectoryItem || STOCK_DIRECTORY[symbol] || {};
  const price = Number(livePrice || dirItem.basePrice || 100);
  const isIndia = Boolean(
    symbol?.endsWith('.NS') ||
    symbol?.endsWith('.BO') ||
    dirItem.market === 'NSE' ||
    dirItem.currency === 'INR'
  );

  // 1. 52-Week Range & Volatility Proxy
  const high52 = Number(dirItem.high52 || (price * 1.25));
  const low52 = Number(dirItem.low52 || (price * 0.75));
  const range52Pct = high52 > low52 ? Number((((high52 - low52) / (price || 1)) * 100).toFixed(1)) : 35.0;

  // 2. Asset-specific learned ATR % proxy
  // High-beta growth / tech / momentum has wider normal range
  // Large-cap defensive / banking / IT has tighter normal range
  let atrPct = 2.0;
  if (['NVDA', 'TSLA', 'TATAMOTORS.NS', 'ADANIENT.NS'].includes(symbol) || range52Pct > 65) {
    atrPct = 3.2; // High volatility / Momentum
  } else if (['HDFCBANK.NS', 'TCS.NS', 'KO', 'JNJ', 'PG', 'ITC.NS', 'SBIN.NS'].includes(symbol) || range52Pct < 30) {
    atrPct = 1.4; // Low volatility / Defensive Blue-Chip
  } else {
    // Proportional between 1.5% and 2.8%
    atrPct = Number(Math.min(2.8, Math.max(1.5, range52Pct / 24)).toFixed(2));
  }

  const atrValue = Number(((price * atrPct) / 100).toFixed(2));

  // Volatility Regime
  let regime = 'NORMAL';
  let regimeLabel = 'Standard Market Beta (~1.0)';
  let regimeBadgeClass = 'bg-blue-100 text-blue-900 border-blue-400';
  if (atrPct < 1.7) {
    regime = 'DEFENSIVE';
    regimeLabel = 'Low Volatility Blue-Chip (Beta < 0.9)';
    regimeBadgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-400';
  } else if (atrPct > 2.6) {
    regime = 'MOMENTUM';
    regimeLabel = 'High Beta / Momentum (Beta > 1.3)';
    regimeBadgeClass = 'bg-purple-100 text-purple-900 border-purple-400';
  }

  // Position in 52-Week Range
  const rangeSpan = high52 - low52;
  const positionInRange = rangeSpan > 0 ? Math.min(100, Math.max(0, Math.round(((price - low52) / rangeSpan) * 100))) : 50;

  return {
    symbol,
    name: dirItem.name || symbol,
    price,
    isIndia,
    currency: isIndia ? 'INR' : 'USD',
    currencySymbol: isIndia ? '₹' : '$',
    high52,
    low52,
    range52Pct,
    positionInRange,
    atrPct,
    atrValue,
    regime,
    regimeLabel,
    regimeBadgeClass,
  };
}

/**
 * Institutional Market Fee Calculator
 * Accurately models Indian NSE statutory taxes (STT, Exchange Turnover, SEBI, Stamp Duty, GST)
 * and US regulatory fees (SEC Section 31, FINRA TAF, clearing pass-through).
 */
export function calculateRoundtripFees(market, entryPrice, exitPrice, quantity) {
  const isIndia = market === 'IN' || market === 'NSE';
  const qty = Math.max(1, Number(quantity) || 1);
  const buyVal = qty * Math.max(0, Number(entryPrice) || 0);
  const exitVal = qty * Math.max(0, Number(exitPrice) || 0);
  const totalTurnover = buyVal + exitVal;

  if (isIndia) {
    // 1. STT (Securities Transaction Tax: 0.1% on delivery buy and sell)
    const stt = totalTurnover * 0.001;
    // 2. Exchange Turnover Charge (NSE: 0.00345%)
    const turnoverCharge = totalTurnover * 0.0000345;
    // 3. SEBI Regulatory Turnover Fee (₹10 / Crore = 0.0001%)
    const sebiCharge = totalTurnover * 0.000001;
    // 4. State Stamp Duty (0.015% on buy leg only)
    const stampDuty = buyVal * 0.00015;
    // 5. GST (18% on Exchange Turnover + SEBI charge)
    const gst = (turnoverCharge + sebiCharge) * 0.18;

    const total = Number((stt + turnoverCharge + sebiCharge + stampDuty + gst).toFixed(2));
    return {
      total,
      breakdown: {
        stt: Number(stt.toFixed(2)),
        exchange: Number(turnoverCharge.toFixed(2)),
        stampDuty: Number(stampDuty.toFixed(2)),
        sebiAndGst: Number((sebiCharge + gst).toFixed(2)),
      },
      currency: 'INR',
      symbol: '₹',
    };
  } else {
    // 1. SEC Section 31 Fee ($0.0000278 of sell leg only)
    const secFee = exitVal * 0.0000278;
    // 2. FINRA Trading Activity Fee (TAF: $0.000166 per share, max $8.30)
    const finraTaf = Math.min(8.30, qty * 0.000166);
    // 3. Exchange clearing pass-through buffer ($0.0001/sh, min $0.02)
    const clearing = Math.max(0.02, qty * 0.0001);

    const total = Number(Math.max(0.04, secFee + finraTaf + clearing).toFixed(2));
    return {
      total,
      breakdown: {
        secFee: Number(secFee.toFixed(3)),
        finraTaf: Number(finraTaf.toFixed(3)),
        clearing: Number(clearing.toFixed(2)),
      },
      currency: 'USD',
      symbol: '$',
    };
  }
}

export default function RiskCalculatorModal({ isOpen, onClose, initialStock, onSendToOrder }) {
  const { userProfile } = useAuth();
  const searchInputRef = useRef(null);

  // Current selected stock symbol
  const [selectedSymbol, setSelectedSymbol] = useState(initialStock?.symbol || 'RELIANCE.NS');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Auto-Optimization Flash Feedback
  const [justOptimizedMsg, setJustOptimizedMsg] = useState('');

  // Market classification
  const isIndia = useMemo(() => {
    return (
      selectedSymbol?.endsWith('.NS') ||
      selectedSymbol?.endsWith('.BO') ||
      STOCK_DIRECTORY[selectedSymbol]?.market === 'NSE' ||
      initialStock?.market === 'IN' ||
      initialStock?.market === 'NSE'
    );
  }, [selectedSymbol, initialStock]);

  const currencySymbol = isIndia ? '₹' : '$';
  const marketKey = isIndia ? 'NSE' : 'US';

  // Capital Balance
  const defaultCapital = useMemo(() => {
    if (isIndia) {
      return userProfile?.wallets?.inr?.cashBalance ?? 1000000;
    }
    return userProfile?.wallets?.usd?.cashBalance ?? 100000;
  }, [isIndia, userProfile]);

  const [capital, setCapital] = useState(defaultCapital);

  // Sync capital when switching markets
  useEffect(() => {
    setCapital(defaultCapital);
  }, [defaultCapital]);

  // Trade Direction: LONG (Buy) vs SHORT (Sell)
  const [direction, setDirection] = useState('LONG');

  // Risk Parameters
  const [riskPercent, setRiskPercent] = useState(1.5); // % of account capital to risk
  const [maxAllocationPercent, setMaxAllocationPercent] = useState(30); // Max % of account allocated to position
  const [atrMultiplier, setAtrMultiplier] = useState(1.5); // Configurable ATR Stop Multiplier (1.0x to 3.0x)
  const [strategyWinRate, setStrategyWinRate] = useState(50); // Configurable Win Rate % for Kelly Criterion (35% to 75%)
  const [showFormulaDocs, setShowFormulaDocs] = useState(false); // Collapsible model transparency docs

  // Price Levels
  const basePrice = useMemo(() => {
    return Number(
      initialStock?.price || 
      STOCK_DIRECTORY[selectedSymbol]?.basePrice || 
      (isIndia ? 2500 : 150)
    );
  }, [initialStock, selectedSymbol, isIndia]);

  const [entryPrice, setEntryPrice] = useState(basePrice);
  const [stopLossPrice, setStopLossPrice] = useState(
    direction === 'LONG'
      ? Number((basePrice * 0.98).toFixed(2))
      : Number((basePrice * 1.02).toFixed(2))
  );
  const [targetPrice, setTargetPrice] = useState(
    direction === 'LONG'
      ? Number((basePrice * 1.05).toFixed(2))
      : Number((basePrice * 0.95).toFixed(2))
  );

  // Learned Stock Risk & Volatility Profile (Reactively updates with selected symbol)
  const stockProfile = useMemo(() => {
    return analyzeStockRiskProfile(selectedSymbol, entryPrice, STOCK_DIRECTORY[selectedSymbol]);
  }, [selectedSymbol, entryPrice]);

  // Real-time stock search engine
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(Object.values(STOCK_DIRECTORY).slice(0, 8));
      return;
    }

    let isMounted = true;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchGlobalEquities(searchQuery);
        if (isMounted) {
          setSearchResults(results.slice(0, 10));
          setSearchLoading(false);
        }
      } catch (err) {
        if (isMounted) setSearchLoading(false);
      }
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Auto-Calibrate levels using learned asset volatility & user-selected ATR multiplier
  const handleAutoOptimize = (customMultiplier, rrMultiplier = 2.2) => {
    const mult = typeof customMultiplier === 'number' ? customMultiplier : atrMultiplier;
    const profile = analyzeStockRiskProfile(selectedSymbol, entryPrice, STOCK_DIRECTORY[selectedSymbol]);
    const stopBuffer = Math.max(entryPrice * 0.005, Number((profile.atrValue * mult).toFixed(2)));
    const targetBuffer = Number((stopBuffer * rrMultiplier).toFixed(2));

    if (direction === 'LONG') {
      setStopLossPrice(Number((entryPrice - stopBuffer).toFixed(2)));
      setTargetPrice(Number((entryPrice + targetBuffer).toFixed(2)));
    } else {
      setStopLossPrice(Number((entryPrice + stopBuffer).toFixed(2)));
      setTargetPrice(Number((entryPrice - targetBuffer).toFixed(2)));
    }

    setJustOptimizedMsg(`Learned ${profile.atrPct}% ATR • Calibrated ${mult}x ATR Stop & 1:${rrMultiplier} Target`);
    setTimeout(() => setJustOptimizedMsg(''), 3000);
  };

  // Synchronize immediately whenever initialStock changes from caller
  useEffect(() => {
    if (isOpen && initialStock?.symbol) {
      handleSelectStock(initialStock.symbol, initialStock.price);
    }
  }, [isOpen, initialStock?.symbol]);

  // Instant & Adaptive Stock Selection Engine
  const handleSelectStock = async (sym, customPrice) => {
    setSelectedSymbol(sym);
    setIsSearching(false);
    setSearchQuery('');

    // 1. Immediately determine market and switch wallet capital
    const targetIsIndia = sym.endsWith('.NS') || sym.endsWith('.BO') || STOCK_DIRECTORY[sym]?.market === 'NSE';
    const targetCapital = targetIsIndia 
      ? (userProfile?.wallets?.inr?.cashBalance ?? 1000000)
      : (userProfile?.wallets?.usd?.cashBalance ?? 100000);
    setCapital(targetCapital);

    // 2. Synchronous initial price & volatility calibration
    let px = customPrice || STOCK_DIRECTORY[sym]?.basePrice || 100;
    const profile = analyzeStockRiskProfile(sym, px, STOCK_DIRECTORY[sym]);
    
    // Adaptive stop based on the stock's learned daily range (1.5x ATR)
    const stopBuffer = Math.max(px * 0.005, Number((profile.atrValue * 1.5).toFixed(2)));
    const targetBuffer = Number((stopBuffer * 2.2).toFixed(2)); // Guaranteed asymmetric edge

    setEntryPrice(Number(px.toFixed(2)));
    if (direction === 'LONG') {
      setStopLossPrice(Number((px - stopBuffer).toFixed(2)));
      setTargetPrice(Number((px + targetBuffer).toFixed(2)));
    } else {
      setStopLossPrice(Number((px + stopBuffer).toFixed(2)));
      setTargetPrice(Number((px - targetBuffer).toFixed(2)));
    }

    setJustOptimizedMsg(`Auto-Optimized for ${sym} (Learned ${profile.atrPct}% ATR)`);
    setTimeout(() => setJustOptimizedMsg(''), 3000);

    // 3. Background fetch real-time quote for tick-precision
    try {
      const q = await fetchSingleYahooQuote(sym, 1800);
      if (q?.price && Math.abs(q.price - px) > 0.01) {
        const livePx = q.price;
        const liveProfile = analyzeStockRiskProfile(sym, livePx, { ...STOCK_DIRECTORY[sym], high52: q.high52, low52: q.low52 });
        const liveStopBuffer = Math.max(livePx * 0.005, Number((liveProfile.atrValue * 1.5).toFixed(2)));
        const liveTargetBuffer = Number((liveStopBuffer * 2.2).toFixed(2));

        setEntryPrice(Number(livePx.toFixed(2)));
        if (direction === 'LONG') {
          setStopLossPrice(Number((livePx - liveStopBuffer).toFixed(2)));
          setTargetPrice(Number((livePx + liveTargetBuffer).toFixed(2)));
        } else {
          setStopLossPrice(Number((livePx + liveStopBuffer).toFixed(2)));
          setTargetPrice(Number((livePx - liveTargetBuffer).toFixed(2)));
        }
      }
    } catch (e) {
      // Graceful fallback to seeded quote
    }
  };

  // Direction Switch Handler
  const handleToggleDirection = (newDir) => {
    if (newDir === direction) return;
    setDirection(newDir);
    
    // Auto-rebalance stop and target based on learned ATR
    const stopBuffer = Math.max(entryPrice * 0.005, Number((stockProfile.atrValue * 1.5).toFixed(2)));
    const targetBuffer = Number((stopBuffer * 2.2).toFixed(2));

    if (newDir === 'LONG') {
      setStopLossPrice(Number((entryPrice - stopBuffer).toFixed(2)));
      setTargetPrice(Number((entryPrice + targetBuffer).toFixed(2)));
    } else {
      setStopLossPrice(Number((entryPrice + stopBuffer).toFixed(2)));
      setTargetPrice(Number((entryPrice - targetBuffer).toFixed(2)));
    }
  };

  // Quick Stop-Loss Presets (% from entry)
  const handleSetStopLossPct = (pct) => {
    if (direction === 'LONG') {
      setStopLossPrice(Number((entryPrice * (1 - pct / 100)).toFixed(2)));
    } else {
      setStopLossPrice(Number((entryPrice * (1 + pct / 100)).toFixed(2)));
    }
  };

  // Quick Target Presets based on R:R multiplier
  const handleSetTargetRR = (multiplier) => {
    const riskDistance = Math.abs(entryPrice - stopLossPrice);
    if (riskDistance <= 0) return;
    if (direction === 'LONG') {
      setTargetPrice(Number((entryPrice + riskDistance * multiplier).toFixed(2)));
    } else {
      setTargetPrice(Number((entryPrice - riskDistance * multiplier).toFixed(2)));
    }
  };

  // =========================================================================
  // MATHEMATICAL POSITION SIZING & RISK-REWARD ENGINE
  // =========================================================================
  const {
    isValidSetup,
    validationError,
    riskAmount,
    perShareRisk,
    perShareReward,
    grossRewardRatio,
    quantityByRisk,
    quantityByCapital,
    finalQuantity,
    isCapitalConstrained,
    totalPositionCost,
    portfolioAllocationPct,
    winFees,
    lossFees,
    grossPotentialProfit,
    netPotentialProfit,
    grossPotentialLoss,
    netPotentialLoss,
    netRealizedRR,
    breakEvenPrice,
    breakEvenSpread,
    lossConsecutiveBefore10PctDrawdown,
    riskVerdict,
    halfKellyFractionPct
  } = useMemo(() => {
    let valid = true;
    let err = '';

    if (entryPrice <= 0) {
      valid = false;
      err = 'Entry price must be greater than zero.';
    } else if (direction === 'LONG') {
      if (stopLossPrice >= entryPrice) {
        valid = false;
        err = 'For a LONG trade, Stop-Loss must be placed strictly below Entry Price.';
      } else if (targetPrice <= entryPrice) {
        valid = false;
        err = 'For a LONG trade, Take-Profit target must be placed strictly above Entry Price.';
      }
    } else {
      if (stopLossPrice <= entryPrice) {
        valid = false;
        err = 'For a SHORT trade, Stop-Loss must be placed strictly above Entry Price.';
      } else if (targetPrice >= entryPrice) {
        valid = false;
        err = 'For a SHORT trade, Take-Profit target must be placed strictly below Entry Price.';
      }
    }

    if (!valid) {
      return {
        isValidSetup: false,
        validationError: err,
        riskAmount: 0,
        perShareRisk: 0,
        perShareReward: 0,
        grossRewardRatio: 0,
        quantityByRisk: 0,
        quantityByCapital: 0,
        finalQuantity: 0,
        isCapitalConstrained: false,
        totalPositionCost: 0,
        portfolioAllocationPct: 0,
        winFees: 0,
        lossFees: 0,
        grossPotentialProfit: 0,
        netPotentialProfit: 0,
        grossPotentialLoss: 0,
        netPotentialLoss: 0,
        netRealizedRR: 0,
        breakEvenPrice: entryPrice,
        breakEvenSpread: 0,
        lossConsecutiveBefore10PctDrawdown: 0,
        riskVerdict: { level: 'INVALID', text: err, color: 'text-rose-700' },
        halfKellyFractionPct: 1.5,
      };
    }

    const pRisk = direction === 'LONG' ? (entryPrice - stopLossPrice) : (stopLossPrice - entryPrice);
    const pReward = direction === 'LONG' ? (targetPrice - entryPrice) : (entryPrice - targetPrice);
    const budget = (capital * riskPercent) / 100;

    const qRisk = pRisk > 0 ? Math.floor(budget / pRisk) : 0;
    const maxCapitalAllowed = (capital * (maxAllocationPercent / 100));
    const qCap = entryPrice > 0 ? Math.floor(maxCapitalAllowed / entryPrice) : 0;

    const finalQty = Math.max(0, Math.min(qRisk, qCap));
    const constrained = qCap < qRisk && finalQty > 0;

    const posCost = finalQty * entryPrice;
    const allocPct = capital > 0 ? Number(((posCost / capital) * 100).toFixed(1)) : 0;

    const targetFeeObj = calculateRoundtripFees(marketKey, entryPrice, targetPrice, finalQty);
    const stopFeeObj = calculateRoundtripFees(marketKey, entryPrice, stopLossPrice, finalQty);

    const feeOnWin = targetFeeObj.total;
    const feeOnLoss = stopFeeObj.total;

    const grossProfit = finalQty * pReward;
    const netProfit = Math.max(0, grossProfit - feeOnWin);

    const grossLoss = finalQty * pRisk;
    const netLoss = grossLoss + feeOnLoss;

    const grossRR = pRisk > 0 ? Number((pReward / pRisk).toFixed(2)) : 0;
    const netRR = netLoss > 0 ? Number((netProfit / netLoss).toFixed(2)) : 0;

    const flatFeeObj = calculateRoundtripFees(marketKey, entryPrice, entryPrice, finalQty);
    const perShareFee = finalQty > 0 ? (flatFeeObj.total / finalQty) : 0;
    const bePrice = direction === 'LONG' 
      ? Number((entryPrice + perShareFee).toFixed(2))
      : Number((entryPrice - perShareFee).toFixed(2));
    const beSpread = Number(Math.abs(bePrice - entryPrice).toFixed(2));

    const consecutiveLosses = riskPercent > 0 ? Math.floor(10 / riskPercent) : 0;

    // Configurable Half-Kelly optimal risk calculation
    // Formula: K = (p * b - q) / b, where p = win rate, q = 1 - p, b = payoff ratio
    const bRatio = pRisk > 0 ? (pReward / pRisk) : 1;
    const pWin = Math.max(0.1, Math.min(0.9, (strategyWinRate || 50) / 100));
    const qLoss = 1 - pWin;
    const rawKelly = bRatio > 0 ? ((pWin * bRatio - qLoss) / bRatio) : 0;
    // Half-Kelly allocates half the full Kelly fraction to dampen volatility by 50%
    const halfKellyPct = rawKelly > 0
      ? Number(Math.min(5.0, Math.max(0.2, (rawKelly / 2) * 100)).toFixed(1))
      : 0;

    let verdict = {
      level: 'OPTIMAL',
      text: 'Institutional Asymmetry: Favorable Net Risk-to-Reward (≥ 1:2.0). Sustainable statistical edge.',
      color: 'text-emerald-700',
    };

    if (netRR < 1.0) {
      verdict = {
        level: 'CRITICAL',
        text: 'Negative Edge: Net risk exceeds reward (< 1:1.0). Taxes and stop distance degrade expected return.',
        color: 'text-rose-700',
      };
    } else if (netRR < 1.5) {
      verdict = {
        level: 'CAUTION',
        text: 'Low Payoff Ratio (< 1:1.5): Requires high win-rate (> 50%) to achieve profit after statutory fees.',
        color: 'text-amber-700',
      };
    }

    return {
      isValidSetup: true,
      validationError: '',
      riskAmount: Number(budget.toFixed(2)),
      perShareRisk: Number(pRisk.toFixed(2)),
      perShareReward: Number(pReward.toFixed(2)),
      grossRewardRatio: grossRR,
      quantityByRisk: qRisk,
      quantityByCapital: qCap,
      finalQuantity: finalQty,
      isCapitalConstrained: constrained,
      totalPositionCost: Number(posCost.toFixed(2)),
      portfolioAllocationPct: allocPct,
      winFees: feeOnWin,
      lossFees: feeOnLoss,
      grossPotentialProfit: Number(grossProfit.toFixed(2)),
      netPotentialProfit: Number(netProfit.toFixed(2)),
      grossPotentialLoss: Number(grossLoss.toFixed(2)),
      netPotentialLoss: Number(netLoss.toFixed(2)),
      netRealizedRR: netRR,
      breakEvenPrice: bePrice,
      breakEvenSpread: beSpread,
      lossConsecutiveBefore10PctDrawdown: consecutiveLosses,
      riskVerdict: verdict,
      halfKellyFractionPct: halfKellyPct,
    };
  }, [
    entryPrice, 
    stopLossPrice, 
    targetPrice, 
    capital, 
    riskPercent, 
    maxAllocationPercent, 
    direction, 
    marketKey,
    strategyWinRate
  ]);

  const handleApplyOrder = () => {
    if (onSendToOrder && finalQuantity > 0 && isValidSetup) {
      onSendToOrder({
        symbol: selectedSymbol,
        quantity: finalQuantity,
        entryPrice,
        stopLoss: stopLossPrice,
        target: targetPrice,
        action: direction === 'LONG' ? 'BUY' : 'SELL',
      });
      onClose();
    }
  };

  // =========================================================================
  // KEYBOARD SHORTCUTS CONTROLLER
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // 1. ESC: Close Search Dropdown or Close Modal
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isSearching) {
          setIsSearching(false);
        } else {
          onClose();
        }
        return;
      }

      const activeTag = document.activeElement?.tagName;
      const isInputFocused = activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA';

      // 2. ENTER: Apply to Order Ticket
      if (e.key === 'Enter') {
        if (!isSearching && isValidSetup && finalQuantity > 0) {
          e.preventDefault();
          handleApplyOrder();
        }
        return;
      }

      // If typing in any input field, ignore letter/number shortcuts
      if (isInputFocused) return;

      // 3. Direction Toggle: 'L' for LONG, 'S' for SHORT
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleToggleDirection('LONG');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleDirection('SHORT');
      } 
      // 4. Quick Risk Tolerance: '1' -> 1%, '2' -> 2%, '3' -> 3%
      else if (e.key === '1') {
        e.preventDefault();
        setRiskPercent(1.0);
      } else if (e.key === '2') {
        e.preventDefault();
        setRiskPercent(2.0);
      } else if (e.key === '3') {
        e.preventDefault();
        setRiskPercent(3.0);
      } 
      // 5. 'W': Sync with Wallet Balance
      else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setCapital(defaultCapital);
      } 
      // 6. '/': Focus Asset Search Bar
      else if (e.key === '/' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsSearching(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // 7. 'O': Auto-Optimize Sizing & Volatility Levels
      else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        handleAutoOptimize();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen, 
    isSearching, 
    isValidSetup, 
    finalQuantity, 
    onClose, 
    handleApplyOrder, 
    direction, 
    entryPrice, 
    defaultCapital,
    selectedSymbol
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] flex flex-col max-h-[96vh] sm:max-h-[94vh] overflow-hidden"
        onClick={() => {
          if (isSearching) setIsSearching(false);
        }}
      >
        
        {/* Newspaper Masthead Header */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b-2 border-[#111111] bg-[#111111] text-[#F6F4EE] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
            <div className="p-1.5 bg-[#FAF8F3] text-[#111111] shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-headline uppercase font-black text-xs sm:text-base tracking-wide flex items-center gap-2 truncate">
                <span className="truncate">PRECISION RISK & POSITION SIZER</span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 text-[9px] font-mono font-normal">
                  INSTITUTIONAL
                </span>
              </h3>
              <p className="text-[9px] sm:text-[10px] font-mono text-neutral-300 truncate">
                Turnover Taxes (NSE & US) • True Net R:R • Dual-Constraint Sizing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close Risk Calculator [Esc]"
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 group shrink-0 min-w-[32px] min-h-[32px] justify-center"
          >
            <span className="text-[10px] font-mono text-neutral-400 group-hover:text-white hidden sm:inline">[Esc]</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Workspace Body */}
        <div className="p-3 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto font-mono text-xs flex-1">
          
          {/* Quick Universe Equities Ribbon */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
            <span className="text-[9px] font-bold uppercase text-neutral-500 whitespace-nowrap shrink-0">
              Quick Universe:
            </span>
            {[
              { sym: 'RELIANCE.NS', label: 'RELIANCE', flag: '🇮🇳' },
              { sym: 'TCS.NS', label: 'TCS', flag: '🇮🇳' },
              { sym: 'HDFCBANK.NS', label: 'HDFCBANK', flag: '🇮🇳' },
              { sym: 'TATAMOTORS.NS', label: 'TATAMOTORS', flag: '🇮🇳' },
              { sym: 'NVDA', label: 'NVDA', flag: '🇺🇸' },
              { sym: 'AAPL', label: 'AAPL', flag: '🇺🇸' },
              { sym: 'TSLA', label: 'TSLA', flag: '🇺🇸' },
              { sym: 'MSFT', label: 'MSFT', flag: '🇺🇸' },
            ].map((preset) => (
              <button
                key={preset.sym}
                type="button"
                onClick={() => handleSelectStock(preset.sym)}
                title={`Select ${preset.label} and auto-optimize sizing`}
                className={`px-2 py-0.5 border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSymbol === preset.sym
                    ? 'bg-[#111111] text-white border-[#111111] shadow-[1px_1px_0px_#111111]'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#111111] hover:bg-neutral-100'
                }`}
              >
                <span>{preset.flag} {preset.label}</span>
              </button>
            ))}
          </div>

          {/* Dynamic Auto-Optimization Feedback Banner */}
          {justOptimizedMsg && (
            <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-500 text-emerald-900 text-[10px] font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                <span>{justOptimizedMsg}</span>
              </span>
              <span className="text-[9px] text-emerald-700 font-normal">Active Sizing</span>
            </div>
          )}

          {/* Top Asset & Search Bar */}
          <div className="p-3 bg-white border border-[#111111] shadow-[2px_2px_0px_#111111] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative z-30">
            
            {/* Interactive Search Asset Input */}
            <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-neutral-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery || (isSearching ? '' : `${selectedSymbol} — ${STOCK_DIRECTORY[selectedSymbol]?.name || selectedSymbol}`)}
                  onFocus={() => setIsSearching(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!isSearching) setIsSearching(true);
                  }}
                  placeholder="Search Any Asset (Press '/' to search)..."
                  title="Search stock by ticker symbol or company name [/]"
                  className="w-full bg-[#FAF8F3] border border-[#111111] px-2.5 py-1.5 text-xs font-bold outline-none placeholder:font-normal placeholder:text-neutral-400"
                />
                <kbd 
                  className="hidden md:inline-block px-1.5 py-0.5 bg-neutral-100 border border-neutral-300 text-[9px] text-neutral-500 font-bold"
                  title="Shortcut: Press '/' key to search"
                >
                  /
                </kbd>
              </div>

              {/* Live Search Autocomplete Results Dropdown */}
              {isSearching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] max-h-60 overflow-y-auto z-50 divide-y divide-neutral-200 animate-in fade-in duration-100">
                  <div className="px-3 py-1.5 bg-[#FAF8F3] text-[10px] text-neutral-500 font-bold uppercase flex justify-between items-center">
                    <span>{searchLoading ? 'Searching Global Markets...' : 'Global Market Results'}</span>
                    <span className="text-[9px] text-neutral-400">Esc to close</span>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-neutral-500 text-xs">
                      No matching equities found. Enter full symbol (e.g. INFY.NS or NVDA).
                    </div>
                  ) : (
                    searchResults.map((item) => {
                      const isItemIndia = item.market === 'NSE' || item.symbol.endsWith('.NS') || item.symbol.endsWith('.BO');
                      return (
                        <button
                          key={item.symbol}
                          type="button"
                          onClick={() => handleSelectStock(item.symbol, item.basePrice || item.price)}
                          className="w-full px-3 py-2 text-left hover:bg-neutral-100 transition-colors flex items-center justify-between gap-2 cursor-pointer font-mono"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <strong className="text-[#111111] text-xs font-bold">{item.symbol}</strong>
                              <span className="px-1 py-0.2 bg-[#EFECE3] border border-[#111111] text-[9px] font-bold">
                                {isItemIndia ? 'NSE (₹)' : 'US ($)'}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-600 truncate max-w-[240px]">
                              {item.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-xs tabular-nums text-[#111111]">
                              {isItemIndia ? '₹' : '$'}{Number(item.basePrice || item.price || 100).toFixed(2)}
                            </span>
                            <span className="block text-[9px] text-neutral-400">{item.sector || 'Equities'}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Market Badge & Direction Switcher */}
            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <span className="px-2 py-1 bg-[#FAF8F3] border border-[#111111] text-[10px] font-bold uppercase whitespace-nowrap">
                {isIndia ? '🇮🇳 NSE Equity' : '🇺🇸 US Equity'}
              </span>

              {/* Long / Short Toggle with Tooltips */}
              <div className="inline-flex border border-[#111111] bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleDirection('LONG')}
                  title="Switch to Long / Buy Position [L]"
                  className={`px-3 py-1 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                    direction === 'LONG'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>LONG</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${direction === 'LONG' ? 'bg-emerald-800 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                    L
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDirection('SHORT')}
                  title="Switch to Short / Sell Position [S]"
                  className={`px-3 py-1 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                    direction === 'SHORT'
                      ? 'bg-rose-700 text-white'
                      : 'text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>SHORT</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${direction === 'SHORT' ? 'bg-rose-800 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                    S
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Core Input Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            
            {/* Account Capital */}
            <div className="p-3 bg-white border border-[#111111]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-neutral-500">
                  Account Capital ({currencySymbol})
                </label>
                <button
                  type="button"
                  onClick={() => setCapital(defaultCapital)}
                  title="Sync with active virtual wallet cash balance [W]"
                  className="text-[9px] text-blue-700 underline hover:text-blue-900 cursor-pointer flex items-center gap-0.5"
                >
                  <span>Sync Wallet</span>
                  <kbd className="px-1 py-0.2 bg-neutral-100 border text-[8px] rounded">W</kbd>
                </button>
              </div>
              <input
                type="number"
                min="1000"
                step="1000"
                value={capital}
                onChange={(e) => setCapital(Math.max(100, Number(e.target.value) || 0))}
                className="w-full bg-[#FAF8F3] border border-[#111111] px-2.5 py-1.5 font-bold text-sm outline-none"
              />
              <span className="text-[9px] text-neutral-400 block mt-1">
                Active cash buffer in wallet
              </span>
            </div>

            {/* Risk Tolerance (% of Capital) */}
            <div className="p-3 bg-white border border-[#111111]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-neutral-500">
                  Risk Budget ({riskPercent}%)
                </label>
                <span className="font-bold text-rose-700 text-xs tabular-nums">
                  {currencySymbol}{riskAmount.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1 mb-1.5">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    title={`Set ${pct}% Risk Budget per trade ${[1, 2, 3].includes(pct) ? `[${pct}]` : ''}`}
                    className={`py-1 text-[10px] font-bold border transition-colors cursor-pointer ${
                      riskPercent === pct
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-[#FAF8F3] border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-neutral-400 block">
                Standard: 1%–2% rule (Keys: [1], [2], [3])
              </span>
            </div>

            {/* Capital Allocation Cap */}
            <div className="p-3 bg-white border border-[#111111]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-neutral-500">
                  Max Position Cap ({maxAllocationPercent}%)
                </label>
                <span className="font-bold text-neutral-800 text-xs tabular-nums">
                  Max: {currencySymbol}{((capital * maxAllocationPercent) / 100).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {[15, 25, 35, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setMaxAllocationPercent(pct)}
                    title={`Cap position outlay at maximum ${pct}% of total capital`}
                    className={`py-1 text-[10px] font-bold border transition-colors cursor-pointer ${
                      maxAllocationPercent === pct
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-[#FAF8F3] border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-neutral-400 block">
                Prevents over-allocation on tight stops
              </span>
            </div>

            {/* Entry Price */}
            <div className="p-3 bg-white border border-[#111111]">
              <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                Planned Entry Price ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Math.max(0.01, Number(e.target.value) || 0))}
                className="w-full bg-[#FAF8F3] border border-[#111111] px-2.5 py-1.5 font-bold text-sm outline-none"
              />
              <span className="text-[9px] text-neutral-400 block mt-1">
                Base market or limit order fill
              </span>
            </div>

            {/* Stop Loss Level */}
            <div className="p-3 bg-white border border-rose-600 bg-rose-50/20">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-rose-900 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                  <span>Stop-Loss Level ({currencySymbol})</span>
                </label>
                <span className="text-[10px] font-bold text-rose-700">
                  Δ {currencySymbol}{perShareRisk} ({entryPrice > 0 ? ((perShareRisk / entryPrice) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(Number(e.target.value))}
                className="w-full bg-white border-2 border-rose-600 text-rose-800 px-2.5 py-1.5 font-bold text-sm outline-none"
              />
              <div className="flex gap-1 mt-1.5">
                {[1, 1.5, 2, 3, 5].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetStopLossPct(pct)}
                    title={`Set Stop-Loss at ${pct}% from entry price`}
                    className="flex-1 py-0.5 text-[9px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    -{pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Take-Profit Target */}
            <div className="p-3 bg-white border border-emerald-600 bg-emerald-50/20">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-emerald-900 flex items-center gap-1">
                  <Target className="w-3 h-3 text-emerald-600" />
                  <span>Take-Profit Target ({currencySymbol})</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-700">
                  Δ {currencySymbol}{perShareReward} ({entryPrice > 0 ? ((perShareReward / entryPrice) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className="w-full bg-white border-2 border-emerald-600 text-emerald-800 px-2.5 py-1.5 font-bold text-sm outline-none"
              />
              <div className="flex gap-1 mt-1.5">
                {[1.5, 2.0, 2.5, 3.0, 4.0].map((rr) => (
                  <button
                    key={rr}
                    type="button"
                    onClick={() => handleSetTargetRR(rr)}
                    title={`Set Target at 1:${rr} Risk:Reward ratio`}
                    className="flex-1 py-0.5 text-[9px] font-bold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    1:{rr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Notice if levels are invalid */}
          {!isValidSetup && (
            <div className="p-3 bg-rose-100 border-2 border-rose-700 text-rose-900 text-xs flex items-center gap-2 font-bold animate-in fade-in duration-100">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Visual Risk-Reward & Break-Even Trajectory Gauge */}
          {isValidSetup && (
            <div className="p-3.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-neutral-500 uppercase flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Trade Structure & Break-Even Gauge:</span>
                </span>
                <span className="text-neutral-700">
                  Break-Even Price: <strong className="text-blue-800">{currencySymbol}{breakEvenPrice.toFixed(2)}</strong> (+{currencySymbol}{breakEvenSpread} fee buffer)
                </span>
              </div>

              {/* Graphical Bar */}
              <div className="relative w-full h-4 bg-neutral-200 border border-[#111111] flex overflow-hidden">
                {/* Risk Zone (Stop) */}
                <div 
                  className="bg-rose-600 h-full transition-all duration-300 flex items-center justify-center text-[9px] text-white font-bold"
                  style={{ width: `${Math.min(50, Math.max(15, (perShareRisk / (perShareRisk + perShareReward || 1)) * 100))}%` }}
                >
                  RISK (1.0x)
                </div>
                {/* Reward Zone (Target) */}
                <div 
                  className="bg-emerald-600 h-full flex-1 transition-all duration-300 flex items-center justify-center text-[9px] text-white font-bold"
                >
                  REWARD ({grossRewardRatio}x)
                </div>
              </div>

              {/* Labels below bar */}
              <div className="flex justify-between text-[10px] text-neutral-600">
                <span className="text-rose-700 font-bold">
                  Stop: {currencySymbol}{stopLossPrice.toFixed(2)}
                </span>
                <span className="font-bold text-[#111111]">
                  Entry: {currencySymbol}{entryPrice.toFixed(2)}
                </span>
                <span className="text-emerald-700 font-bold">
                  Target: {currencySymbol}{targetPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Precision Sizing & Financial Outcomes Results Card */}
          {isValidSetup && (
            <div className="bg-white border-2 border-[#111111] p-4 space-y-4 shadow-[4px_4px_0px_#111111]">
              
              {/* Primary Sizing Output & Volatility Adaptive Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[#111111]">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                      Institutional Optimal Position Sizing:
                    </span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 border border-emerald-500 text-emerald-900 text-[9px] font-bold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span>Auto-Tuned to {selectedSymbol}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-serif font-black text-[#111111] tabular-nums">
                      {finalQuantity} <span className="text-xs font-sans font-bold text-neutral-600 uppercase">Shares</span>
                    </span>
                    <span className="text-xs text-neutral-500 font-mono break-all sm:break-normal">
                      (@ {currencySymbol}{entryPrice.toFixed(2)} = <strong className="text-neutral-900">{currencySymbol}{totalPositionCost.toLocaleString()}</strong>)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAutoOptimize()}
                      title={`Re-calculate optimal Stop-Loss & Target using learned ${stockProfile.atrPct}% ATR [O]`}
                      className="px-2 py-1 bg-[#111111] hover:bg-neutral-800 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-[1px_1px_0px_#111111]"
                    >
                      <Zap className="w-3 h-3 text-yellow-300" />
                      <span>Auto-Calibrate</span>
                      <kbd className="px-1 py-0.2 bg-neutral-700 text-neutral-200 text-[8px] rounded font-mono">O</kbd>
                    </button>
                    <span className={`text-sm sm:text-base font-bold tabular-nums ${portfolioAllocationPct > 40 ? 'text-amber-700' : 'text-[#111111]'}`}>
                      {portfolioAllocationPct}% Capital
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isCapitalConstrained ? (
                      <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-800 text-amber-900 text-[9px] font-bold uppercase flex items-center gap-1">
                        <span>⚠️ Allocation-Capped (Max {maxAllocationPercent}%)</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-700 text-emerald-800 text-[9px] font-bold uppercase flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Exact 1-Risk Unit Sized</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Asset Volatility & Quantitative Sizing Derivation Panel */}
              <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300 text-[11px] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                    <span className="font-bold text-neutral-800 uppercase text-[10px]">
                      Learned Risk Profile:
                    </span>
                    <span className={`px-1.5 py-0.2 text-[9px] font-bold border ${stockProfile.regimeBadgeClass}`}>
                      {stockProfile.regimeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-neutral-600">
                      Est. Daily ATR: <strong className="text-neutral-900">{currencySymbol}{stockProfile.atrValue}</strong> ({stockProfile.atrPct}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormulaDocs(!showFormulaDocs)}
                      className="text-blue-700 hover:text-blue-900 underline text-[10px] font-bold cursor-pointer"
                    >
                      {showFormulaDocs ? 'Hide Formulas [-]' : 'Formulas & Assumptions [+]'}
                    </button>
                  </div>
                </div>

                {/* Configurable Model Controls: ATR Multiplier & Kelly Win-Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-white border border-neutral-200 text-[10px]">
                  <div>
                    <span className="text-neutral-600 font-bold uppercase block text-[9px] mb-1">
                      ATR Stop Distance Multiplier:
                    </span>
                    <div className="flex items-center gap-1">
                      {[1.0, 1.5, 2.0, 2.5, 3.0].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setAtrMultiplier(m);
                            handleAutoOptimize(m);
                          }}
                          className={`px-2 py-0.5 font-bold border text-[10px] cursor-pointer transition-colors ${
                            atrMultiplier === m
                              ? 'bg-[#111111] text-white border-[#111111]'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          {m}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-neutral-600 font-bold uppercase block text-[9px] mb-1">
                      Kelly Strategy Win Rate (Historical/Expected):
                    </span>
                    <div className="flex items-center gap-1">
                      {[40, 50, 55, 60, 65].map((wr) => (
                        <button
                          key={wr}
                          type="button"
                          onClick={() => setStrategyWinRate(wr)}
                          className={`px-2 py-0.5 font-bold border text-[10px] cursor-pointer transition-colors ${
                            strategyWinRate === wr
                              ? 'bg-emerald-800 text-white border-emerald-950'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          {wr}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white p-2 border border-neutral-200">
                    <span className="text-neutral-500 uppercase block font-bold text-[9px]">1. Risk Budget Sizing:</span>
                    <span className="font-bold text-neutral-800 tabular-nums">
                      {quantityByRisk} shs
                    </span>
                    <span className="text-neutral-400 block text-[9px]">
                      {currencySymbol}{riskAmount} budget ÷ Δ{currencySymbol}{perShareRisk} stop
                    </span>
                  </div>

                  <div className="bg-white p-2 border border-neutral-200">
                    <span className="text-neutral-500 uppercase block font-bold text-[9px]">2. Capital Cap Ceiling:</span>
                    <span className="font-bold text-neutral-800 tabular-nums">
                      {quantityByCapital} shs
                    </span>
                    <span className="text-neutral-400 block text-[9px]">
                      {maxAllocationPercent}% cap = {currencySymbol}{((capital * maxAllocationPercent) / 100).toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 border-2 border-[#111111] shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#111111] uppercase block font-bold text-[9px] tracking-wide">3. Half-Kelly Advisory:</span>
                      <span className="px-1.5 py-0.2 bg-amber-100 border border-amber-500 text-amber-950 font-bold text-[8px] uppercase">
                        Assumes {strategyWinRate}% WR
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="font-bold text-emerald-800 text-sm tabular-nums block">
                        {halfKellyFractionPct > 0 ? `~${halfKellyFractionPct}% Account Risk` : '0% (No Positive Edge)'}
                      </span>
                    </div>
                    <span className="text-neutral-600 block text-[9px] font-sans mt-0.5">
                      Based on assumed <strong>{strategyWinRate}%</strong> win rate • b = {grossRewardRatio}x
                    </span>
                  </div>
                </div>
              </div>

              {/* 4-Column Mathematical Outcomes Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                
                {/* 1. Net Potential Profit */}
                <div className="p-2.5 bg-emerald-50/50 border border-emerald-300">
                  <span className="text-[10px] text-emerald-800 block uppercase font-bold">
                    Net Profit (Target)
                  </span>
                  <span className="text-base font-bold text-emerald-700 tabular-nums block">
                    +{currencySymbol}{netPotentialProfit.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    Gross: +{currencySymbol}{grossPotentialProfit.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-400 block">
                    Est. Fees: -{currencySymbol}{winFees}
                  </span>
                </div>

                {/* 2. Net Potential Loss */}
                <div className="p-2.5 bg-rose-50/50 border border-rose-300">
                  <span className="text-[10px] text-rose-800 block uppercase font-bold">
                    Net Loss (Stop)
                  </span>
                  <span className="text-base font-bold text-rose-700 tabular-nums block">
                    -{currencySymbol}{netPotentialLoss.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    Gross: -{currencySymbol}{grossPotentialLoss.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-400 block">
                    Est. Fees: +{currencySymbol}{lossFees}
                  </span>
                </div>

                {/* 3. Net Realized R:R */}
                <div className="p-2.5 bg-[#FAF8F3] border border-[#111111]">
                  <span className="text-[10px] text-neutral-600 block uppercase font-bold">
                    True Net R:R (After Fees)
                  </span>
                  <span className={`text-base font-bold tabular-nums block ${netRealizedRR >= 1.8 ? 'text-emerald-700' : 'text-neutral-900'}`}>
                    1 : {netRealizedRR}
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    Gross R:R: 1 : {grossRewardRatio}
                  </span>
                  <span className="text-[9px] text-neutral-400 block">
                    {netRealizedRR >= 1.5 ? 'Positive Edge' : 'Fee Friction'}
                  </span>
                </div>

                {/* 4. Drawdown Resilience */}
                <div className="p-2.5 bg-[#FAF8F3] border border-[#111111]">
                  <span className="text-[10px] text-neutral-600 block uppercase font-bold">
                    Drawdown Buffer
                  </span>
                  <span className="text-base font-bold text-neutral-900 tabular-nums block">
                    {lossConsecutiveBefore10PctDrawdown} Losses
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    To -10% Drawdown
                  </span>
                  <span className="text-[9px] text-neutral-400 block">
                    At {riskPercent}% risk/trade
                  </span>
                </div>
              </div>

              {/* Regulatory Taxes / Fee Detail Banner */}
              <div className="p-2.5 bg-stone-100 border border-neutral-300 text-[11px] space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-bold text-neutral-800">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                    <span>Statutory Exchange & Regulatory Deductions ({isIndia ? 'NSE / SEBI Taxes' : 'US SEC / FINRA Fees'}):</span>
                  </span>
                  <span className="text-neutral-900 shrink-0">
                    Est. Roundtrip: {currencySymbol}{winFees}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-600 leading-relaxed font-sans">
                  {isIndia ? (
                    <>
                      Includes Securities Transaction Tax (STT 0.1%), Exchange Turnover charges (0.00345%), SEBI Turnover fees, State Stamp Duty (0.015%), and GST (18%). Realized P&L is net of these government charges.
                    </>
                  ) : (
                    <>
                      Includes SEC Section 31 Regulatory transaction fee ($0.0000278), FINRA Trading Activity Fee (TAF $0.000166/share), and clearing pass-through.
                    </>
                  )}
                </p>
              </div>

              {/* Model Assumptions & Formula Documentation (Collapsible) */}
              {showFormulaDocs && (
                <div className="p-3 bg-[#FAF8F3] border-2 border-[#111111] space-y-2 text-[11px] font-mono shadow-[2px_2px_0px_#111111] animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[#111111] pb-1">
                    <span className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-blue-700" />
                      <span>Model Assumptions & Mathematical Formulas</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormulaDocs(false)}
                      className="text-stone-500 hover:text-stone-900 font-bold"
                    >
                      [Close ✕]
                    </button>
                  </div>

                  <div className="space-y-2 text-stone-700 font-sans text-[11px] leading-relaxed">
                    <div>
                      <strong className="text-stone-900 font-mono block text-[11px]">1. Learned ATR Volatility Model:</strong>
                      <p>
                        <strong>Source Data:</strong> Real-time quote, verified 52-week High/Low span, and asset market-beta regime.
                      </p>
                      <p className="font-mono text-[10px] bg-white p-1.5 border border-stone-300 mt-0.5">
                        ATR% = min(2.8%, max(1.5%, 52W_Range / 24)) • ATR_Value = Price × ATR%<br />
                        Stop_Buffer = max(Price × 0.5%, ATR_Value × Multiplier)
                      </p>
                      <span className="text-[10px] text-stone-500 block mt-0.5">
                        High-beta momentum stocks (NVDA, TSLA) use 3.2% ATR; defensive blue chips (HDFCBANK, TCS, KO) use 1.4% ATR.
                      </span>
                    </div>

                    <div>
                      <strong className="text-stone-900 font-mono block text-[11px]">2. Half-Kelly Position Sizing:</strong>
                      <p>
                        <strong>Source Data:</strong> Per-share risk, per-share reward, and user-specified strategy historical win rate ({strategyWinRate}%).
                      </p>
                      <p className="font-mono text-[10px] bg-white p-1.5 border border-stone-300 mt-0.5">
                        b = Reward / Risk • p = Win_Rate • q = 1 - p<br />
                        Kelly_Fraction (K) = (p × b - q) / b • Half-Kelly = K / 2
                      </p>
                      <span className="text-[10px] text-stone-500 block mt-0.5">
                        Half-Kelly cuts portfolio drawdown volatility by 50% while capturing ~75% of maximum geometric growth. When p × b &lt; q, Kelly is 0% (warning of negative mathematical edge).
                      </span>
                    </div>

                    <div>
                      <strong className="text-stone-900 font-mono block text-[11px]">3. Fixed Capital & Risk Budget Invariants:</strong>
                      <p className="font-mono text-[10px] bg-white p-1.5 border border-stone-300 mt-0.5">
                        Shares_by_Risk = floor(Risk_Budget / Per_Share_Risk)<br />
                        Shares_by_Capital = floor((Capital × Max_Allocation%) / Entry_Price)<br />
                        Final_Shares = min(Shares_by_Risk, Shares_by_Capital)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Assessment Verdict Box */}
              <div className={`p-3 border flex items-start gap-2.5 ${
                riskVerdict.level === 'OPTIMAL' 
                  ? 'bg-emerald-50/70 border-emerald-400' 
                  : riskVerdict.level === 'CAUTION'
                  ? 'bg-amber-50/70 border-amber-400'
                  : 'bg-rose-50/70 border-rose-400'
              }`}>
                <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${riskVerdict.color}`} />
                <div>
                  <span className={`font-bold uppercase text-[11px] block ${riskVerdict.color}`}>
                    Risk Audit: {riskVerdict.level}
                  </span>
                  <p className="text-[11px] text-neutral-700 font-sans leading-relaxed mt-0.5">
                    {riskVerdict.text}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2 shrink-0">
            <span className="text-[10px] text-neutral-500 font-mono text-center sm:text-left">
              Quantitative Position Sizing • Formatted for NSE & US Order Execution
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                title="Cancel & Close Modal [Esc]"
                className="flex-1 sm:flex-none px-4 py-2 border-2 border-[#111111] text-xs font-mono font-bold hover:bg-neutral-200 transition-colors cursor-pointer min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-1"
              >
                <span>Cancel</span>
                <kbd className="px-1 py-0.2 bg-neutral-200 text-neutral-700 text-[8px] rounded">Esc</kbd>
              </button>
              <button
                type="button"
                onClick={handleApplyOrder}
                disabled={!isValidSetup || finalQuantity <= 0}
                title="Execute & Apply Parameters to Order Ticket [Enter]"
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 bg-[#111111] text-[#F6F4EE] text-xs font-mono font-bold hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer min-h-[44px] sm:min-h-[40px] shadow-[2px_2px_0px_#111111]"
              >
                <span>Apply ({finalQuantity} Shs)</span>
                <kbd className="px-1.5 py-0.5 bg-neutral-700 text-white text-[9px] rounded font-mono hidden sm:inline-block">Enter ↵</kbd>
              </button>
            </div>
          </div>
        </div>

        {/* Global Keyboard Shortcut Helper Ribbon */}
        <div className="hidden sm:flex px-4 py-2 bg-[#EFECE4] border-t-2 border-[#111111] flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-neutral-600 shrink-0">
          <div className="flex items-center gap-1 font-bold text-neutral-800">
            <Command className="w-3 h-3 text-neutral-700" />
            <span className="uppercase tracking-wider">Keyboard Shortcuts:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[9px]">
            <span title="Press Esc to close modal">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">Esc</kbd> Close
            </span>
            <span title="Press L to switch to LONG">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">L</kbd> Long
            </span>
            <span title="Press S to switch to SHORT">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">S</kbd> Short
            </span>
            <span title="Press 1, 2, or 3 to set Risk %">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">1 / 2 / 3</kbd> Risk %
            </span>
            <span title="Press W to sync wallet balance">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">W</kbd> Sync Wallet
            </span>
            <span title="Press / to focus asset search">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">/</kbd> Search Asset
            </span>
            <span title="Press O to auto-calibrate stop loss & target for current stock">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">O</kbd> Auto-Calibrate
            </span>
            <span title="Press Enter to send parameters to order ticket">
              <kbd className="px-1 py-0.2 bg-white border border-neutral-400 font-bold rounded">Enter ↵</kbd> Apply Order
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
