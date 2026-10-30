import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTradingTools } from '../context/TradingToolsContext';
import { STOCK_DIRECTORY, getInstantInitialQuotes } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import { getNSEMarketStatus, getUSMarketStatus } from '../lib/marketHours';
import MarketStatusBadge from '../components/MarketStatusBadge';
import AdsterraAdBanner from '../components/AdsterraAdBanner';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Sparkles, 
  Globe2, 
  ShieldCheck, 
  Clock, 
  BookOpen, 
  Sun, 
  Moon, 
  Sunset,
  Lock,
  Zap,
  BarChart3,
  Database,
  ArrowRight,
  Terminal,
  Filter,
  BarChart2,
  Calculator,
  ExternalLink,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Code,
  User,
  Sliders,
  Play,
  Pause
} from 'lucide-react';

export default function HomePage() {
  const { currentUser, userProfile, geoData } = useAuth();
  const navigate = useNavigate();

  // If user is logged in, redirect directly to Dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const [greeting, setGreeting] = useState('');
  const [greetingIcon, setGreetingIcon] = useState(null);
  
  // Real-time market status & exchange clocks
  const [nseStatus, setNseStatus] = useState(() => getNSEMarketStatus());
  const [usStatus, setUsStatus] = useState(() => getUSMarketStatus());
  
  // Real-time ticker stream quotes
  const [quotes, setQuotes] = useState(() => getInstantInitialQuotes());

  // Interactive Tab State for Feature Showcase
  const [activeFeatureTab, setActiveFeatureTab] = useState('terminal');

  // Interactive Mini Position Sizer State (Playground)
  const [sizerMarket, setSizerMarket] = useState('NSE');
  const [sizerStock, setSizerStock] = useState('RELIANCE.NS');
  const [sizerCapital, setSizerCapital] = useState(1000000);
  const [sizerRiskPct, setSizerRiskPct] = useState(1.5);
  const [sizerStopLossPct, setSizerStopLossPct] = useState(2.0);

  // Interactive Strategy Backtest Showcase State
  const [selectedStrategy, setSelectedStrategy] = useState('ema');

  // Interactive Quiz State
  const [quizAnswers, setQuizAnswers] = useState({});
  const [revealedQuiz, setRevealedQuiz] = useState({});

  // Sandbox mode toggle
  const [allowSandbox, setAllowSandbox] = useState(() => {
    try {
      return localStorage.getItem('paper_trading_sandbox_after_hours') === 'true';
    } catch {
      return false;
    }
  });

  // Set front page body flag to suppress intrusive middle/vignette ads on front page
  useEffect(() => {
    document.body.classList.add('is-front-page');
    return () => {
      document.body.classList.remove('is-front-page');
    };
  }, []);

  // Calculate dynamic greeting & market clocks every 1 second
  useEffect(() => {
    const updateTime = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) {
        setGreeting('Good Morning');
        setGreetingIcon(<Sun className="w-5 h-5 text-amber-700 inline mr-2" />);
      } else if (hour >= 12 && hour < 17) {
        setGreeting('Good Afternoon');
        setGreetingIcon(<Sun className="w-5 h-5 text-amber-800 inline mr-2" />);
      } else if (hour >= 17 && hour < 21) {
        setGreeting('Good Evening');
        setGreetingIcon(<Sunset className="w-5 h-5 text-orange-700 inline mr-2" />);
      } else {
        setGreeting('Good Night');
        setGreetingIcon(<Moon className="w-5 h-5 text-indigo-700 inline mr-2" />);
      }

      setNseStatus(getNSEMarketStatus());
      setUsStatus(getUSMarketStatus());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to live price stream for ticker bar
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      setQuotes((prev) => ({ ...prev, ...prices }));
    });
    return () => unsubscribe();
  }, []);

  const traderName = currentUser?.displayName || userProfile?.profile?.fullName || (currentUser ? currentUser.email.split('@')[0] : 'Aspiring Trader');
  const inrCash = userProfile?.wallets?.inr?.cashBalance ?? 1000000;
  const inrInvested = userProfile?.wallets?.inr?.investedValue ?? 0;
  const usdCash = userProfile?.wallets?.usd?.cashBalance ?? 100000;
  const usdInvested = userProfile?.wallets?.usd?.investedValue ?? 0;

  // All stocks in universe for comprehensive digital dot-matrix marquee
  const allStockSymbols = useMemo(() => {
    return Object.keys(STOCK_DIRECTORY);
  }, []);

  // Marquee pause state (allows touch toggle on mobile or click on desktop)
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);

  // Helper to render authentic digital dot matrix ticker item
  const renderTickerItem = (sym, key) => {
    const stock = STOCK_DIRECTORY[sym] || {};
    const q = quotes[sym] || stock;
    const isNSE = sym.endsWith('.NS');
    const curr = isNSE ? '₹' : '$';
    const price = q.price ?? stock.basePrice ?? 100;
    
    // Calculate profit or loss
    const changePct = q.changePercent !== undefined ? Number(q.changePercent) : 0;
    const changeAmt = q.change !== undefined 
      ? Number(q.change) 
      : (q.price && stock.basePrice ? Number((q.price - stock.basePrice).toFixed(2)) : 0);
    
    const isProfit = changePct > 0 || changeAmt > 0;
    const isLoss = changePct < 0 || changeAmt < 0;

    return (
      <Link
        key={key}
        to={`/stock/${encodeURIComponent(sym)}`}
        className="inline-flex items-center gap-2.5 px-3 py-1 bg-black/60 border border-neutral-800/90 hover:border-amber-400 hover:bg-neutral-900/90 transition-all group shrink-0"
        title={`Open ${stock.name || sym} Live Candlestick Desk`}
      >
        <span className="text-[10px] px-1 py-0.2 text-neutral-400 bg-neutral-900 border border-neutral-700/80 font-mono uppercase tracking-tighter">
          {isNSE ? 'NSE' : 'US'}
        </span>
        
        <span className="font-bold text-neutral-100 group-hover:text-amber-300 transition-colors tracking-widest">
          {stock.ticker || sym.replace('.NS', '')}
        </span>

        <span className="text-amber-300 font-semibold tracking-wider">
          {curr}{typeof price === 'number' ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price}
        </span>

        {isProfit ? (
          <span className="led-glow-green font-bold text-emerald-400 flex items-center gap-1">
            <span className="text-sm">▲</span>
            <span>+{curr}{Math.abs(changeAmt).toFixed(2)}</span>
            <span className="text-[13px] opacity-90">({changePct >= 0 ? `+${changePct.toFixed(2)}` : changePct.toFixed(2)}%)</span>
          </span>
        ) : isLoss ? (
          <span className="led-glow-red font-bold text-rose-400 flex items-center gap-1">
            <span className="text-sm">▼</span>
            <span>-{curr}{Math.abs(changeAmt).toFixed(2)}</span>
            <span className="text-[13px] opacity-90">({changePct.toFixed(2)}%)</span>
          </span>
        ) : (
          <span className="led-glow-amber text-amber-400 flex items-center gap-1">
            <span>▪</span>
            <span>0.00 (0.00%)</span>
          </span>
        )}

        <span className="text-neutral-600 font-mono text-sm ml-1 opacity-70">::</span>
      </Link>
    );
  };

  // Featured stock cards for home showcase
  const featuredCards = [
    { symbol: 'RELIANCE.NS', market: 'NSE', tag: 'Energy & Digital Titan' },
    { symbol: 'NVDA', market: 'US', tag: 'Semiconductors & AI Leader' },
    { symbol: 'TCS.NS', market: 'NSE', tag: 'Global IT Benchmark' },
    { symbol: 'AAPL', market: 'US', tag: 'Consumer Tech Sovereign' },
    { symbol: 'HDFCBANK.NS', market: 'NSE', tag: 'Banking Pillar' },
    { symbol: 'TSLA', market: 'US', tag: 'EV & Clean Tech' },
  ];

  const handleToggleSandbox = (val) => {
    setAllowSandbox(val);
    localStorage.setItem('paper_trading_sandbox_after_hours', val ? 'true' : 'false');
  };

  // Mini Position Sizer Calculations
  const currentSizerPrice = useMemo(() => {
    const q = quotes[sizerStock] || STOCK_DIRECTORY[sizerStock] || {};
    return q.price || q.basePrice || (sizerMarket === 'NSE' ? 2500 : 180);
  }, [quotes, sizerStock, sizerMarket]);

  const sizerCalculations = useMemo(() => {
    const riskAmount = (sizerCapital * sizerRiskPct) / 100;
    const perShareRisk = (currentSizerPrice * sizerStopLossPct) / 100;
    const safeQty = perShareRisk > 0 ? Math.floor(riskAmount / perShareRisk) : 0;
    const totalExposure = safeQty * currentSizerPrice;
    const exposurePct = sizerCapital > 0 ? ((totalExposure / sizerCapital) * 100).toFixed(1) : 0;
    const targetGain = riskAmount * 2; // 1:2 R:R
    return {
      riskAmount: Math.round(riskAmount),
      perShareRisk: perShareRisk.toFixed(2),
      safeQty,
      totalExposure: Math.round(totalExposure),
      exposurePct,
      targetGain: Math.round(targetGain),
    };
  }, [sizerCapital, sizerRiskPct, sizerStopLossPct, currentSizerPrice]);

  // Backtest showcase strategies data
  const strategiesData = {
    ema: {
      name: 'EMA 20/50 Golden Cross',
      type: 'Trend Following',
      desc: 'Enters long when the 20-period Exponential Moving Average crosses above the 50-period EMA, confirmed by positive momentum. Closes when the 20 EMA drops back below.',
      winRate: '61.4%',
      profitFactor: '1.92',
      maxDrawdown: '-8.4%',
      tradesAnalyzed: '142 Trades (3-Yr Backtest)',
      suitability: 'Best for Trending Bullish Markets (e.g., Nifty 50, NASDAQ-100)',
    },
    rsi: {
      name: 'RSI 14 Mean Reversion',
      type: 'Counter-Trend Pullback',
      desc: 'Buys high-quality blue chips when 14-period RSI dips below 32 (oversold condition in established uptrend). Exits when RSI rises back to 65 or triggers 2% trailing stop.',
      winRate: '68.2%',
      profitFactor: '2.14',
      maxDrawdown: '-6.1%',
      tradesAnalyzed: '98 Trades (3-Yr Backtest)',
      suitability: 'Excellent for Range-Bound Quality Equities (TCS, HDFC Bank, Apple)',
    },
    supertrend: {
      name: 'SuperTrend (10, 3) Volatility Trend',
      type: 'Volatility Breakout',
      desc: 'Uses Average True Range (ATR) multipliers to ride institutional trends. Flips position direction on green band breaks, maintaining strict mathematical stop levels.',
      winRate: '57.8%',
      profitFactor: '2.35',
      maxDrawdown: '-11.2%',
      tradesAnalyzed: '115 Trades (3-Yr Backtest)',
      suitability: 'High-Beta Growth Stocks (Nvidia, Tesla, Tata Motors)',
    },
  };

  // Educational Quiz Questions
  const quizItems = [
    {
      id: 'q1',
      question: 'What is the maximum account risk professional desk traders risk on any single trade?',
      options: [
        { label: 'A', text: '1% to 2% of liquid account balance', isCorrect: true },
        { label: 'B', text: '20% to 30% for quick gains', isCorrect: false },
        { label: 'C', text: '50% all-in on high conviction', isCorrect: false },
      ],
      explanation: 'The 1% to 2% Rule protects you from catastrophic drawdowns. Even 8 consecutive losses will only reduce your capital by ~12%, allowing you to survive and compound.',
    },
    {
      id: 'q2',
      question: 'Why does our simulator enforce real exchange hours (15:30 IST / 16:00 ET)?',
      options: [
        { label: 'A', text: 'To mimic actual market psychological discipline and prevent fake off-market habits', isCorrect: true },
        { label: 'B', text: 'Because servers are turned off after hours', isCorrect: false },
        { label: 'C', text: 'To stop users from making profit', isCorrect: false },
      ],
      explanation: 'Simulating outside official market hours builds reckless habits. Enforcing real operating schedules prepares you mentally for actual stock market reality.',
    },
    {
      id: 'q3',
      question: 'What is the primary purpose of keeping a Post-Mortem Trade Journal?',
      options: [
        { label: 'A', text: 'To identify cognitive biases, FOMO entries, and refine your edge over time', isCorrect: true },
        { label: 'B', text: 'To show off profits on social media', isCorrect: false },
        { label: 'C', text: 'To calculate tax refunds', isCorrect: false },
      ],
      explanation: 'Great traders are disciplined analysts of their own mistakes. An unalterable journal reveals whether losses came from bad luck or undisciplined rule-breaking.',
    },
  ];

  const handleSelectQuiz = (qId, optionIdx, isCorrect) => {
    setQuizAnswers((prev) => ({ ...prev, [qId]: optionIdx }));
    setRevealedQuiz((prev) => ({ ...prev, [qId]: true }));
  };

  if (currentUser) {
    return null;
  }

  return (
    <div className="front-page-container max-w-7xl mx-auto px-2.5 py-4 sm:px-6 lg:px-8 text-[#111111]">
      {/* Newspaper Top Sub-Header Bar */}
      <div className="hidden sm:flex border-b border-[#111111] pb-2 mb-4 font-mono text-[11px] flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider">EDITION: FINANCIAL DISPATCH</span>
          <span className="text-stone-400">•</span>
          <span>NO. 2026-X</span>
          <span className="text-stone-400">•</span>
          <span className="uppercase font-semibold text-emerald-800">GLOBAL MARKETS SIMULATOR</span>
        </div>
        
        {/* Creator Attribution Bar */}
        <div className="flex items-center gap-3">
          <span>LOCATION: <strong className="uppercase">{geoData?.countryName || 'India'}</strong></span>
          <span className="text-stone-400">•</span>
          <span className="bg-[#111111] text-[#F6F4EE] px-1.5 py-0.5 font-bold uppercase text-[10px]">
            100% VIRTUAL CAPITAL
          </span>
          <span className="text-stone-400">•</span>
          <a
            href="https://abhijith-dev-io.web.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-700 hover:text-emerald-800 font-bold underline inline-flex items-center gap-1"
            title="Portfolio of Abhijith S"
          >
            <span>Engineered by Abhijith S</span>
            <ExternalLink className="w-3 h-3 text-stone-500" />
          </a>
        </div>
      </div>

      {/* ============================================================== */}
      {/* DIGITAL DOT MATRIX LED MARQUEE TICKER TAPE                     */}
      {/* ============================================================== */}
      <div className="border-2 border-[#111111] bg-[#07080a] text-white mb-5 shadow-[4px_4px_0px_#111111] overflow-hidden">
        {/* Ticker Chassis Top Bezel Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#101217] border-b border-neutral-800 font-mono text-[11px] select-none">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold uppercase tracking-wider text-neutral-200">
              GLOBAL TICKER FEED
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-[10px] text-amber-400 font-dot-matrix uppercase tracking-widest hidden sm:inline">
              DALAL STREET & WALL STREET DOT-MATRIX DISPLAY
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-[10px] text-neutral-400">
            <span className="hidden md:inline font-mono text-[10px] text-neutral-400">
              {allStockSymbols.length} Equities Streaming • Hover to Freeze
            </span>
            <button
              type="button"
              onClick={() => setIsMarqueePaused(!isMarqueePaused)}
              className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title={isMarqueePaused ? 'Resume Marquee Tape' : 'Pause Marquee Tape'}
            >
              {isMarqueePaused ? (
                <>
                  <Play className="w-2.5 h-2.5 text-emerald-400" />
                  <span>RESUME</span>
                </>
              ) : (
                <>
                  <Pause className="w-2.5 h-2.5 text-amber-400" />
                  <span>PAUSE</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* The LED Marquee Ticker Track */}
        <div 
          className="relative overflow-hidden py-2.5 px-1 led-ticker-chassis group cursor-pointer"
          onMouseEnter={() => setIsMarqueePaused(true)}
          onMouseLeave={() => setIsMarqueePaused(false)}
        >
          {/* Subtle Left & Right Shadow Fade Masks */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-14 bg-gradient-to-r from-[#08090b] to-transparent z-10"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-14 bg-gradient-to-l from-[#08090b] to-transparent z-10"></div>

          {/* Marquee Runner Track (Double rendered for seamless -50% loop) */}
          <div 
            className="animate-ticker-marquee flex items-center gap-3 font-dot-matrix text-lg sm:text-xl tracking-wider select-none whitespace-nowrap"
            style={isMarqueePaused ? { animationPlayState: 'paused' } : undefined}
          >
            {/* First Set of All Stocks */}
            {allStockSymbols.map((sym, idx) => renderTickerItem(sym, `set1-${idx}`))}
            {/* Duplicate Set for Continuous Seamless Loop */}
            {allStockSymbols.map((sym, idx) => renderTickerItem(sym, `set2-${idx}`))}
          </div>
        </div>
      </div>

      {/* Official Exchange Holiday Gazette Dispatch Banner */}
      {(nseStatus.isHoliday || usStatus.isHoliday) && (
        <div className="mb-6 p-3 sm:p-4 bg-amber-50 border-2 border-amber-900 text-amber-950 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 border border-amber-800 text-amber-950 shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-amber-900" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-amber-950">
                  OFFICIAL GAZETTE: GOVERNMENT TRADING HOLIDAY TODAY
                </span>
                <span className="px-1.5 py-0.5 bg-amber-900 text-amber-100 font-bold text-[10px] uppercase">
                  FLOOR CLOSED
                </span>
              </div>
              <p className="text-[11px] text-amber-900/90 font-news mt-0.5 leading-relaxed">
                {nseStatus.isHoliday && (
                  <span>
                    National Stock Exchange (NSE India) is closed today for <strong>{nseStatus.holidayName}</strong>. Regular trading resumes at 09:15 AM IST next working session.
                  </span>
                )}
                {nseStatus.isHoliday && usStatus.isHoliday && <span> • </span>}
                {usStatus.isHoliday && (
                  <span>
                    US Exchanges (NYSE/NASDAQ) are observing <strong>{usStatus.holidayName}</strong> federal holiday.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <Link
              to="/dashboard"
              className="px-3 py-1.5 bg-amber-900 hover:bg-amber-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <span>View Holiday Calendar →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Front Page Broadsheet Grid */}
      <div className="border-t-4 border-double border-[#111111] pt-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Lead Story (Left 8 Cols on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs text-[#111111]/70 uppercase tracking-widest mb-2 flex-wrap">
                <span className="bg-emerald-900 text-white px-1.5 py-0.5 text-[10px] font-bold">EDUCATIONAL FLIGHT SIMULATOR</span>
                <span>•</span>
                <span>LEARN BEFORE COMMITTING REAL CAPITAL</span>
              </div>

              {/* Condensed Big Headline matching authentic broadsheet */}
              <h1 className="font-headline uppercase font-black text-3xl sm:text-5xl md:text-6xl tracking-tight leading-none text-[#111111]">
                MASTER THE MARKETS WITH REAL CAPITAL DISCIPLINE
              </h1>

              {/* Sub-Headline Bar */}
              <div className="border-y border-[#111111] py-2 my-4">
                <p className="font-news text-base sm:text-xl text-[#111111] italic leading-snug">
                  {greetingIcon}
                  {greeting}, <strong className="font-bold not-italic">{traderName}</strong>. Over 90% of retail investors lose money in real exchanges due to lack of risk discipline. This site is built to train your execution, position sizing, and technical acumen with zero financial risk.
                </p>
              </div>
            </div>

            {/* Broadsheet 2-Column Article Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[#111111] font-news text-base leading-relaxed">
              <div>
                <p className="first-letter:text-5xl first-letter:font-serif first-letter:font-black first-letter:float-left first-letter:mr-3 first-letter:leading-none text-justify">
                  The stock market is a masterclass in psychological discipline, volatility tolerance, and mathematical risk management. Entering the stock market with hard-earned savings without rigorous prior practice is the fastest route to financial ruin.
                </p>
                <p className="mt-3 text-justify">
                  The Paper Trading Financial Gazette equips aspiring investors with live quotations, genuine TradingView candlestick depth, mathematical Kelly position sizing, and algorithmic backtesting—all operating on zero-risk virtual capital.
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-justify">
                  Unlike traditional arcade simulators, our engine enforces official exchange trading hours (09:15–15:30 IST in Bombay and 09:30–16:00 ET in New York) to instill the authentic circadian rhythm and psychological patience needed for real market mastery.
                </p>

                {/* Quick CTA Desk Button */}
                <div className="p-4 bg-white border-2 border-[#111111] font-mono text-xs shadow-sm">
                  <div className="font-bold text-sm uppercase mb-1 flex items-center justify-between">
                    <span>ENTER SIMULATOR DESK</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.5 font-bold">FREE LEARNING</span>
                  </div>
                  <p className="text-[#111111]/70 text-[11px] mb-3">
                    Claim your ₹10,00,000 INR & $100,000 USD virtual capital ledger to begin practice.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Link
                      to="/signup"
                      className="py-2.5 bg-[#111111] text-[#F6F4EE] hover:bg-stone-800 font-bold text-center block uppercase tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                    >
                      <span>Create Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      to="/guide"
                      className="py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-[#111111] font-bold text-center block uppercase tracking-wider transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                    >
                      <GraduationCap className="w-4 h-4 text-emerald-800" />
                      <span>Academy Guide</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Clocks Newspaper Card Plates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#D8D2C4]">
              {/* Mumbai Plate */}
              <div className="newspaper-photo-plate p-4">
                <div className="flex items-center justify-between border-b border-[#111111] pb-2 mb-2 font-mono">
                  <span className="font-bold text-xs uppercase flex items-center gap-1.5">
                    <span>🇮🇳 NSE / BSE MUMBAI</span>
                  </span>
                  <MarketStatusBadge market="NSE" size="sm" showTime={false} />
                </div>
                <div className="font-mono text-xs space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-stone-500 uppercase">Live Exchange Clock:</span>
                    <span className="text-xl font-bold tracking-tight text-[#111111] bg-[#FAF8F3] px-2 py-0.5 border border-[#111111]/30">
                      {nseStatus.exchangeTime}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-[#D8D2C4] text-[11px]">
                    <div>
                      <span className="text-stone-500 block text-[9px] uppercase">Market Open:</span>
                      <strong className="text-emerald-800">{nseStatus.openTimeStr}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[9px] uppercase">Market Close:</span>
                      <strong className="text-red-800">{nseStatus.closeTimeStr}</strong>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[#D8D2C4] text-[11px] leading-tight">
                    {nseStatus.isHoliday ? (
                      <span className="text-amber-900 font-bold block">
                        🏛️ Closed Today: {nseStatus.holidayName}
                      </span>
                    ) : nseStatus.isOpen ? (
                      <span className="text-emerald-800 font-bold block">
                        ● Trading Live • Closes in {nseStatus.closingCountdown}
                      </span>
                    ) : (
                      <span className="text-stone-700 font-medium block">
                        {nseStatus.nextEventDesc}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-dashed border-[#D8D2C4] flex items-center justify-between text-[10px] font-mono">
                  <span>CURRENCY: INR (₹)</span>
                  <Link to="/signup" className="font-bold underline hover:text-emerald-800">
                    Trade NSE Practice →
                  </Link>
                </div>
              </div>

              {/* New York Plate */}
              <div className="newspaper-photo-plate p-4">
                <div className="flex items-center justify-between border-b border-[#111111] pb-2 mb-2 font-mono">
                  <span className="font-bold text-xs uppercase flex items-center gap-1.5">
                    <span>🇺🇸 NASDAQ / NYSE NY</span>
                  </span>
                  <MarketStatusBadge market="US" size="sm" showTime={false} />
                </div>
                <div className="font-mono text-xs space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-stone-500 uppercase">Live Exchange Clock:</span>
                    <span className="text-xl font-bold tracking-tight text-[#111111] bg-[#FAF8F3] px-2 py-0.5 border border-[#111111]/30">
                      {usStatus.exchangeTime}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-[#D8D2C4] text-[11px]">
                    <div>
                      <span className="text-stone-500 block text-[9px] uppercase">Market Open:</span>
                      <strong className="text-emerald-800">{usStatus.openTimeStr}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[9px] uppercase">Market Close:</span>
                      <strong className="text-red-800">{usStatus.closeTimeStr}</strong>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[#D8D2C4] text-[11px] leading-tight">
                    {usStatus.isHoliday ? (
                      <span className="text-amber-900 font-bold block">
                        🏛️ Closed Today: {usStatus.holidayName}
                      </span>
                    ) : usStatus.isOpen ? (
                      <span className="text-emerald-800 font-bold block">
                        ● Trading Live • Closes in {usStatus.closingCountdown}
                      </span>
                    ) : (
                      <span className="text-stone-700 font-medium block">
                        {usStatus.nextEventDesc}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-dashed border-[#D8D2C4] flex items-center justify-between text-[10px] font-mono">
                  <span>CURRENCY: USD ($)</span>
                  <Link to="/signup" className="font-bold underline hover:text-sky-800">
                    Trade US Practice →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Author Feature, Regulatory Notice & Ledgers (Right 4 Cols) */}
          <div className="lg:col-span-4 space-y-6 lg:border-l lg:border-[#D8D2C4] lg:pl-8">
            
            {/* PRODUCER & ENGINEER SPOTLIGHT CARD - Abhijith S */}
            <div className="p-5 bg-white border-2 border-[#111111] shadow-[6px_6px_0px_#111111] space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-[#111111] pb-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-emerald-400">
                  DEVELOPER & ARCHITECT
                </span>
                <span className="text-[10px] text-stone-500">PROD 2026</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[#111111] text-[#F6F4EE] flex items-center justify-center font-bold text-lg font-serif border border-[#111111] shrink-0">
                  AS
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#111111]">Abhijith S</h2>
                  <p className="text-[11px] text-stone-600 font-news">Full-Stack Architect & Financial Systems Designer</p>
                  <a
                    href="https://abhijith-dev-io.web.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline mt-1"
                  >
                    <span>View Portfolio: abhijith-dev-io.web.app</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <p className="font-news text-xs text-[#111111]/85 leading-relaxed pt-2 border-t border-stone-200">
                "Our mission is simple: provide retail traders with institutional-grade tools—real-time feeds, position sizers, and strategy backtesting—so anyone can master the stock market with discipline before ever risking hard-earned capital."
              </p>

              <div className="pt-2">
                <a
                  href="https://abhijith-dev-io.web.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 text-center text-xs font-bold block uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Explore Creator's Portfolio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* INVERTED BLACK CALLOUT BOX */}
            <div className="newspaper-black-box p-5 space-y-4">
              <div className="border-b border-white/20 pb-2">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-widest block">
                  REGULATORY & EDUCATIONAL CHARTER
                </span>
                <h2 className="font-headline uppercase text-2xl tracking-wide text-white leading-tight mt-1">
                  MARKET DISCIPLINE POLICY
                </h2>
              </div>

              <p className="text-xs font-news text-white/90 leading-relaxed">
                Orders are strictly locked during closed exchange sessions to train authentic psychological discipline. No simulated fills outside official hours unless Sandbox Mode is engaged.
              </p>

              <div className="space-y-2 pt-2 border-t border-white/10 font-mono text-xs">
                <div className="flex items-center justify-between text-white/80">
                  <span>NSE (India):</span>
                  <span className="font-bold text-white">{nseStatus.isOpen ? 'OPEN' : 'CLOSED'}</span>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span>US (New York):</span>
                  <span className="font-bold text-white">{usStatus.isOpen ? 'OPEN' : 'CLOSED'}</span>
                </div>
              </div>

              {/* Sandbox Toggle Inside Black Box */}
              <div className="pt-3 border-t border-white/20">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-mono text-white hover:text-amber-300">
                  <input
                    type="checkbox"
                    aria-label="Sandbox Mode (Bypass after-hours lock)"
                    checked={allowSandbox}
                    onChange={(e) => handleToggleSandbox(e.target.checked)}
                    className="w-4 h-4 rounded text-black cursor-pointer"
                  />
                  <span className="font-bold">Sandbox Mode (Bypass after-hours lock)</span>
                </label>
              </div>
            </div>

            {/* Virtual Capital Starter Ledgers */}
            <div className="border-2 border-[#111111] bg-white p-5 space-y-4 font-mono">
              <div className="border-b border-[#111111] pb-2 flex items-center justify-between">
                <span className="font-bold text-xs uppercase">DEFAULT VIRTUAL LEDGERS</span>
                <span className="text-[10px] text-stone-500 uppercase">100% SIMULATED</span>
              </div>

              {/* Indian Ledger */}
              <div className="p-3 bg-[#F6F4EE] border border-[#111111]">
                <div className="flex items-center justify-between text-[11px] text-[#111111]/70 mb-1">
                  <span>INDIAN EQUITY (INR)</span>
                  <span className="font-bold text-emerald-900">₹ Starter Balance</span>
                </div>
                <div className="text-xl font-bold text-[#111111]">
                  ₹10,00,000
                </div>
                <div className="text-[10px] text-[#111111]/60 mt-1">
                  Covers NSE/BSE top 50 blue chips with real live quotes.
                </div>
              </div>

              {/* US Ledger */}
              <div className="p-3 bg-[#F6F4EE] border border-[#111111]">
                <div className="flex items-center justify-between text-[11px] text-[#111111]/70 mb-1">
                  <span>FOREIGN US EQUITY (USD)</span>
                  <span className="font-bold text-sky-900">$ Starter Balance</span>
                </div>
                <div className="text-xl font-bold text-[#111111]">
                  $100,000
                </div>
                <div className="text-[10px] text-[#111111]/60 mt-1">
                  Trade Apple, Nvidia, Microsoft, Tesla without forex risk.
                </div>
              </div>

              <Link
                to="/signup"
                className="w-full py-2 bg-white hover:bg-[#111111] hover:text-[#F6F4EE] text-[#111111] border border-[#111111] font-bold text-center block uppercase tracking-wider text-xs transition-colors min-h-[44px] flex items-center justify-center"
              >
                Claim Ledger & Start Practicing →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE TEACHING SECTION 1: THE 5 INSTITUTIONAL MODULES    */}
      {/* ============================================================== */}
      <div className="border-t-4 border-double border-[#111111] pt-8 mb-10">
        <div className="border-b-2 border-[#111111] pb-3 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
          <div>
            <span className="font-mono text-xs uppercase text-emerald-800 font-bold block">
              PEDAGOGICAL ARCHITECTURE
            </span>
            <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
              INTERACTIVE CURRICULUM: 5 PILLARS OF TRADING MASTERY
            </h2>
          </div>
          <span className="font-mono text-xs text-neutral-700 font-medium">
            Click any module below to inspect pedagogical tools
          </span>
        </div>

        {/* Interactive Tabs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6 font-mono text-xs">
          {[
            { id: 'terminal', name: '1. Trading Desk', icon: <Terminal className="w-4 h-4" /> },
            { id: 'screener', name: '2. Stock Screener', icon: <Filter className="w-4 h-4" /> },
            { id: 'sizer', name: '3. Position Sizer', icon: <Calculator className="w-4 h-4" /> },
            { id: 'backtest', name: '4. Strategy Backtest', icon: <BarChart2 className="w-4 h-4" /> },
            { id: 'journal', name: '5. Trade Journal', icon: <BookOpen className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFeatureTab(tab.id)}
              className={`p-3 border-2 border-[#111111] font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer text-left ${
                activeFeatureTab === tab.id
                  ? 'bg-[#111111] text-[#F6F4EE] shadow-[4px_4px_0px_#111111]'
                  : 'bg-white text-[#111111] hover:bg-neutral-100'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Cards */}
        <div className="newspaper-photo-plate p-6 bg-white border-2 border-[#111111] shadow-[6px_6px_0px_#111111]">
          {activeFeatureTab === 'terminal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-neutral-100 border border-neutral-400 font-mono text-[10px] font-bold uppercase">
                  <span>PILLAR 01: REALISTIC EXECUTION ENVIRONMENT</span>
                </div>
                <h3 className="font-headline uppercase text-2xl sm:text-3xl font-black text-[#111111]">
                  Institutional TradingView Candlesticks & Live OmniFeed
                </h3>
                <p className="font-news text-base text-[#111111]/85 leading-relaxed">
                  Toy simulators with delayed 15-minute lines teach terrible timing. Our terminal integrates authentic multi-timeframe TradingView candlestick charts, real-time tick streaming, and instant simulated order routing for Indian (NSE) and US (NASDAQ) tickers.
                </p>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-700 uppercase block font-semibold">Execution Latency</span>
                    <strong className="text-emerald-800 text-sm">0ms Local Instant</strong>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-700 uppercase block font-semibold">Active Tickers</span>
                    <strong className="text-black text-sm">50+ Heavyweights</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#F6F4EE] font-mono text-xs font-bold hover:bg-neutral-800 uppercase"
                  >
                    <span>Launch Practice Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5 bg-neutral-900 text-neutral-200 p-4 font-mono text-xs rounded border border-black space-y-2.5 shadow-inner">
                <div className="flex justify-between items-center border-b border-neutral-700 pb-2 text-[11px]">
                  <span className="text-amber-400 font-bold">RELIANCE.NS • NSE EQ</span>
                  <span className="text-emerald-400 font-bold">₹2,945.30 (+1.42%)</span>
                </div>
                <div className="h-28 bg-neutral-950 border border-neutral-800 flex items-center justify-center text-center p-2 text-neutral-400 text-[11px]">
                  [TradingView Candlestick Engine Active]
                  <br />
                  EMA(20) • EMA(50) • RSI(14) • ATR Volatility
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
                  <div>Day Range: ₹2,910 - ₹2,955</div>
                  <div className="text-right">Vol: 6.2M Shares</div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'screener' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-neutral-100 border border-neutral-400 font-mono text-[10px] font-bold uppercase">
                  <span>PILLAR 02: SYSTEMATIC STOCK SELECTION</span>
                </div>
                <h3 className="font-headline uppercase text-2xl sm:text-3xl font-black text-[#111111]">
                  Multi-Factor Technical & Valuation Screener
                </h3>
                <p className="font-news text-base text-[#111111]/85 leading-relaxed">
                  Avoid emotional "tip-based" buying. Use our multi-factor screener to filter equities by 52-Week Breakouts, Oversold Pullbacks (RSI ≤ 35), High Volume surges, and fundamental P/E valuations. Find trade setups before market open.
                </p>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Screening Logic</span>
                    <strong className="text-blue-800 text-sm">52-Wk, RSI, P/E, Vol</strong>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Instant Autocomplete</span>
                    <strong className="text-emerald-800 text-sm">Full Symbol Search</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    to="/screener"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#F6F4EE] font-mono text-xs font-bold hover:bg-neutral-800 uppercase"
                  >
                    <span>Open Live Screener</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5 bg-neutral-50 border-2 border-[#111111] p-4 font-mono text-xs space-y-2">
                <div className="font-bold border-b border-neutral-300 pb-1 flex justify-between">
                  <span>PRE-BUILT SYSTEMATIC FILTERS</span>
                  <span className="text-emerald-700">4 Active</span>
                </div>
                <div className="p-2 bg-white border border-neutral-300 flex justify-between items-center">
                  <span>🔥 52-Week High Breakouts</span>
                  <span className="font-bold text-emerald-800">12 Found</span>
                </div>
                <div className="p-2 bg-white border border-neutral-300 flex justify-between items-center">
                  <span>📉 RSI Oversold Pullbacks (&le; 35)</span>
                  <span className="font-bold text-amber-800">5 Found</span>
                </div>
                <div className="p-2 bg-white border border-neutral-300 flex justify-between items-center">
                  <span>💎 Low P/E Valuation Giants (&le; 22)</span>
                  <span className="font-bold text-blue-800">8 Found</span>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'sizer' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-neutral-100 border border-neutral-400 font-mono text-[10px] font-bold uppercase">
                  <span>PILLAR 03: MATHEMATICAL CAPITAL PRESERVATION</span>
                </div>
                <h3 className="font-headline uppercase text-2xl sm:text-3xl font-black text-[#111111]">
                  Institutional Optimal Position Sizing (Kelly & 1% Rule)
                </h3>
                <p className="font-news text-base text-[#111111]/85 leading-relaxed">
                  Amateurs calculate how much money they can make; professionals calculate how much money they could lose. Our mathematical position calculator automatically configures the exact share quantity you should trade based on stop-loss distance, portfolio size, and regulatory STT tax deductions.
                </p>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Max Recommended Risk</span>
                    <strong className="text-purple-800 text-sm">1.0% to 2.0% Per Trade</strong>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Regulatory Friction</span>
                    <strong className="text-black text-sm">STT & Turnover Computed</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <a
                    href="#interactive-playground"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#F6F4EE] font-mono text-xs font-bold hover:bg-neutral-800 uppercase"
                  >
                    <span>Test Interactive Sizer Below ↓</span>
                  </a>
                </div>
              </div>
              <div className="lg:col-span-5 bg-white border-2 border-[#111111] p-4 font-mono text-xs space-y-3">
                <div className="font-bold border-b border-neutral-300 pb-1 flex justify-between text-xs">
                  <span>CAPITAL PRESERVATION LOGIC</span>
                  <span className="text-purple-800 font-bold">1% CAP</span>
                </div>
                <div className="text-[11px] space-y-1.5 text-neutral-700">
                  <div className="flex justify-between">
                    <span>Portfolio Size:</span>
                    <strong>₹10,00,000</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Allowed Risk (1.5%):</span>
                    <strong className="text-red-700">₹15,000</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Stop-Loss Buffer (2.0%):</span>
                    <strong>₹58.90 / share</strong>
                  </div>
                  <div className="flex justify-between border-t border-neutral-300 pt-1 font-bold text-black">
                    <span>Safe Quantity to Buy:</span>
                    <span className="text-emerald-800 text-sm">254 Shares</span>
                  </div>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-400 text-emerald-950 text-[10px] leading-tight">
                  ✓ Guarantees that even 10 consecutive losses cannot destroy your portfolio.
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'backtest' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-neutral-100 border border-neutral-400 font-mono text-[10px] font-bold uppercase">
                  <span>PILLAR 04: QUANTITATIVE EVIDENCE OVER HOPE</span>
                </div>
                <h3 className="font-headline uppercase text-2xl sm:text-3xl font-black text-[#111111]">
                  Algorithmic Strategy Backtesting Engine
                </h3>
                <p className="font-news text-base text-[#111111]/85 leading-relaxed">
                  Never risk real funds on a strategy you haven't quantitatively tested. Our built-in backtester evaluates EMA crossovers, RSI mean-reversions, and Bollinger breakouts across 3 years of daily candlestick data, delivering real win rates, profit factors, and maximum drawdown metrics.
                </p>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Benchmark Metrics</span>
                    <strong className="text-emerald-800 text-sm">Win Rate & Profit Factor</strong>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Symbol Coverage</span>
                    <strong className="text-black text-sm">Instant Ticker Search</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    to="/backtest"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#F6F4EE] font-mono text-xs font-bold hover:bg-neutral-800 uppercase"
                  >
                    <span>Run Backtest Lab</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5 bg-neutral-900 text-white p-4 font-mono text-xs rounded border border-black space-y-2.5">
                <div className="flex justify-between items-center border-b border-neutral-700 pb-2 text-[11px]">
                  <span className="text-amber-400 font-bold">STRATEGY: EMA 20/50</span>
                  <span className="text-emerald-400 font-bold">61.4% Win Rate</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-neutral-800 rounded">
                    <div className="text-[10px] text-neutral-400">Profit Factor</div>
                    <div className="text-base font-bold text-emerald-400">1.92</div>
                  </div>
                  <div className="p-2 bg-neutral-800 rounded">
                    <div className="text-[10px] text-neutral-400">Max Drawdown</div>
                    <div className="text-base font-bold text-red-400">-8.4%</div>
                  </div>
                </div>
                <div className="text-[10px] text-neutral-400 leading-tight">
                  Tested on 142 historical signals. Strategy proves positive mathematical expectancy.
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'journal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-neutral-100 border border-neutral-400 font-mono text-[10px] font-bold uppercase">
                  <span>PILLAR 05: EMOTIONAL ACCOUNTABILITY</span>
                </div>
                <h3 className="font-headline uppercase text-2xl sm:text-3xl font-black text-[#111111]">
                  Unalterable Post-Mortem Trade Journal
                </h3>
                <p className="font-news text-base text-[#111111]/85 leading-relaxed">
                  Trading is 80% psychology. Our local-first IndexedDB journal forces you to tag each trade's psychological trigger (FOMO, Plan Execution, Revenge Trade) and conduct post-trade post-mortems so you never repeat the same error twice.
                </p>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Data Architecture</span>
                    <strong className="text-emerald-800 text-sm">IndexedDB Local Private</strong>
                  </div>
                  <div className="p-2.5 bg-[#FAF8F3] border border-neutral-300">
                    <span className="text-[10px] text-neutral-500 uppercase block">Psychological Tags</span>
                    <strong className="text-black text-sm">FOMO / Revenge / Discipline</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#F6F4EE] font-mono text-xs font-bold hover:bg-neutral-800 uppercase"
                  >
                    <span>Start Your Trade Journal</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:col-span-5 bg-white border-2 border-[#111111] p-4 font-mono text-xs space-y-2.5">
                <div className="font-bold border-b border-neutral-300 pb-1 flex justify-between text-xs">
                  <span>POST-MORTEM ENTRY SAMPLE</span>
                  <span className="text-neutral-500 text-[10px]">LOCAL LEDGER</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between font-bold">
                    <span>TCS.NS • LONG</span>
                    <span className="text-emerald-800">+₹18,400 Profit</span>
                  </div>
                  <div className="text-[10px] text-neutral-500">Tag: Followed 20 EMA Bounce Plan (Discipline)</div>
                  <p className="font-news text-xs text-neutral-800 italic bg-neutral-50 p-2 border border-neutral-200">
                    "Waited patiently for 10:15 AM candle confirmation. Did not chase early spike. Strict stop-loss held without emotional intervention."
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE TEACHING SECTION 2: LIVE MINI POSITION SIZER LAB   */}
      {/* ============================================================== */}
      <div id="interactive-playground" className="border-t-4 border-double border-[#111111] pt-8 mb-10 scroll-mt-6">
        <div className="border-b-2 border-[#111111] pb-3 mb-6">
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-purple-900 font-bold">
            <Sliders className="w-4 h-4 text-purple-800" />
            <span>INTERACTIVE HANDS-ON LAB</span>
          </div>
          <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
            LIVE OPTIMAL POSITION SIZING PLAYGROUND
          </h2>
          <p className="font-news text-sm sm:text-base text-[#111111]/80 mt-1">
            Test the 1% Capital Preservation Rule yourself in real time without signing in. See how adjusting account size and risk tolerance calculates safe position sizes to prevent portfolio blowup.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Deck */}
          <div className="lg:col-span-7 newspaper-photo-plate p-5 sm:p-6 bg-white border-2 border-[#111111] space-y-5 font-mono text-xs">
            <div className="border-b border-neutral-300 pb-2 flex justify-between items-center">
              <span className="font-bold uppercase tracking-wider text-sm">1. Sizer Parameters</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSizerMarket('NSE'); setSizerStock('RELIANCE.NS'); setSizerCapital(1000000); }}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase border border-[#111111] ${
                    sizerMarket === 'NSE' ? 'bg-[#111111] text-[#F6F4EE]' : 'bg-neutral-100'
                  }`}
                >
                  🇮🇳 NSE (₹ INR)
                </button>
                <button
                  type="button"
                  onClick={() => { setSizerMarket('US'); setSizerStock('NVDA'); setSizerCapital(100000); }}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase border border-[#111111] ${
                    sizerMarket === 'US' ? 'bg-[#111111] text-[#F6F4EE]' : 'bg-neutral-100'
                  }`}
                >
                  🇺🇸 US ($ USD)
                </button>
              </div>
            </div>

            {/* Select Stock */}
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase mb-1">
                Choose Simulated Equity:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(sizerMarket === 'NSE' 
                  ? ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS']
                  : ['NVDA', 'AAPL', 'MSFT']
                ).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setSizerStock(sym)}
                    className={`p-2 text-center border font-bold text-xs uppercase transition-all ${
                      sizerStock === sym
                        ? 'border-2 border-[#111111] bg-neutral-200'
                        : 'border-neutral-300 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    {sym.replace('.NS', '')}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] text-neutral-500 flex justify-between">
                <span>Selected Stock Live Price:</span>
                <strong className="text-black">
                  {sizerMarket === 'NSE' ? '₹' : '$'}{currentSizerPrice.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Account Capital */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="account-capital-slider" className="text-[11px] font-bold text-neutral-800 uppercase">
                  Simulated Account Capital:
                </label>
                <strong className="text-sm font-bold text-black">
                  {sizerMarket === 'NSE' ? '₹' : '$'}{sizerCapital.toLocaleString()}
                </strong>
              </div>
              <input
                id="account-capital-slider"
                type="range"
                aria-label="Simulated Account Capital"
                min={sizerMarket === 'NSE' ? 100000 : 10000}
                max={sizerMarket === 'NSE' ? 5000000 : 500000}
                step={sizerMarket === 'NSE' ? 50000 : 5000}
                value={sizerCapital}
                onChange={(e) => setSizerCapital(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#111111]"
              />
              <div className="flex justify-between text-[10px] text-neutral-700 font-bold mt-0.5">
                <span>Min: {sizerMarket === 'NSE' ? '₹1L' : '$10K'}</span>
                <span>Max: {sizerMarket === 'NSE' ? '₹50L' : '$500K'}</span>
              </div>
            </div>

            {/* Risk Percentage Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase">
                  Account Risk Budget Per Trade (%):
                </label>
                <strong className={`text-sm font-bold ${sizerRiskPct <= 2 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {sizerRiskPct}% {sizerRiskPct <= 2 ? '(Safe Disciplined)' : '(Aggressive Warning)'}
                </strong>
              </div>
              <div className="flex gap-2">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setSizerRiskPct(pct)}
                    className={`flex-1 py-1.5 font-bold text-xs border ${
                      sizerRiskPct === pct
                        ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                        : 'bg-neutral-100 text-[#111111] border-neutral-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Stop Loss Distance */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-neutral-600 uppercase">
                  Technical Stop-Loss Buffer:
                </label>
                <strong className="text-sm font-bold text-black">
                  {sizerStopLossPct}% ({sizerMarket === 'NSE' ? '₹' : '$'}{sizerCalculations.perShareRisk} / share)
                </strong>
              </div>
              <div className="flex gap-2">
                {[1.0, 1.5, 2.0, 3.0, 5.0].map((sl) => (
                  <button
                    key={sl}
                    type="button"
                    onClick={() => setSizerStopLossPct(sl)}
                    className={`flex-1 py-1.5 font-bold text-xs border ${
                      sizerStopLossPct === sl
                        ? 'bg-[#111111] text-[#F6F4EE] border-[#111111]'
                        : 'bg-neutral-100 text-[#111111] border-neutral-300'
                    }`}
                  >
                    {sl}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Output Plate */}
          <div className="lg:col-span-5 bg-white border-2 border-[#111111] p-5 sm:p-6 shadow-[6px_6px_0px_#111111] flex flex-col justify-between font-mono text-xs">
            <div>
              <div className="border-b-2 border-[#111111] pb-2 mb-4 flex justify-between items-center">
                <span className="font-bold uppercase text-sm">2. Sizing Output</span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-900 font-bold text-[10px] uppercase">
                  ZERO SPECULATION
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-[#FAF8F3] border border-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase block">Maximum Allowable Loss</span>
                  <div className="text-2xl font-black text-red-800">
                    {sizerMarket === 'NSE' ? '₹' : '$'}{sizerCalculations.riskAmount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    Exactly {sizerRiskPct}% of your total capital.
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 border-2 border-emerald-800">
                  <span className="text-[10px] text-emerald-900 font-bold uppercase block">
                    Calculated Optimal Share Quantity
                  </span>
                  <div className="text-3xl font-black text-emerald-900">
                    {sizerCalculations.safeQty.toLocaleString()} Shares
                  </div>
                  <span className="text-[10px] text-emerald-800">
                    Total Exposure: {sizerMarket === 'NSE' ? '₹' : '$'}{sizerCalculations.totalExposure.toLocaleString()} ({sizerCalculations.exposurePct}% of portfolio)
                  </span>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-400 text-blue-950 text-[11px] space-y-1">
                  <div className="font-bold flex justify-between">
                    <span>Target 1:2 Risk-to-Reward:</span>
                    <span className="text-emerald-800">+{sizerMarket === 'NSE' ? '₹' : '$'}{sizerCalculations.targetGain.toLocaleString()}</span>
                  </div>
                  <p className="font-news text-xs leading-relaxed text-blue-900/90 pt-1">
                    If this trade stops out, you lose exactly {sizerMarket === 'NSE' ? '₹' : '$'}{sizerCalculations.riskAmount.toLocaleString()}. Your remaining 98.5% capital stays untouched to take the next high-probability setup.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-neutral-300">
              <Link
                to="/signup"
                className="w-full py-2.5 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 text-center font-bold uppercase tracking-wider block transition-colors"
              >
                Apply Optimal Sizing in Real Simulator →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE TEACHING SECTION 3: QUANT STRATEGY SHOWCASE LAB    */}
      {/* ============================================================== */}
      <div className="border-t-4 border-double border-[#111111] pt-8 mb-10">
        <div className="border-b-2 border-[#111111] pb-3 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
          <div>
            <span className="font-mono text-xs uppercase text-blue-800 font-bold block">
              EMPIRICAL BACKTEST LAB
            </span>
            <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
              HISTORICAL STRATEGY COMPARISON
            </h2>
          </div>
          <Link to="/backtest" className="font-mono text-xs font-bold underline hover:text-blue-800 uppercase flex items-center gap-1">
            <span>Explore Full Backtester Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(strategiesData).map(([key, strat]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedStrategy(key)}
              className={`p-4 border-2 border-[#111111] text-left transition-all cursor-pointer font-mono ${
                selectedStrategy === key
                  ? 'bg-[#111111] text-[#F6F4EE] shadow-[5px_5px_0px_#111111]'
                  : 'bg-white text-[#111111] hover:bg-neutral-100'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1">
                {strat.type}
              </div>
              <h3 className="font-headline uppercase text-xl font-black leading-tight mb-2">
                {strat.name}
              </h3>
              <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-neutral-400/40">
                <span>Win Rate:</span>
                <span className={selectedStrategy === key ? 'text-amber-300' : 'text-emerald-800'}>
                  {strat.winRate}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Strategy Deep-Dive Box */}
        {strategiesData[selectedStrategy] && (
          <div className="newspaper-photo-plate p-6 bg-white border-2 border-[#111111] font-mono text-xs space-y-4 shadow-[6px_6px_0px_#111111]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-300 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  {strategiesData[selectedStrategy].type}
                </span>
                <h3 className="font-headline uppercase text-2xl font-black text-[#111111]">
                  {strategiesData[selectedStrategy].name}
                </h3>
              </div>
              <span className="px-2 py-1 bg-neutral-100 border border-neutral-400 font-bold text-[11px] self-start sm:self-auto">
                {strategiesData[selectedStrategy].tradesAnalyzed}
              </span>
            </div>

            <p className="font-news text-base text-[#111111]/85 leading-relaxed">
              {strategiesData[selectedStrategy].desc}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-[#FAF8F3] border border-neutral-300">
                <span className="text-[10px] text-neutral-500 uppercase block">Historical Win Rate</span>
                <div className="text-xl font-bold text-emerald-800">{strategiesData[selectedStrategy].winRate}</div>
              </div>
              <div className="p-3 bg-[#FAF8F3] border border-neutral-300">
                <span className="text-[10px] text-neutral-500 uppercase block">Profit Factor</span>
                <div className="text-xl font-bold text-black">{strategiesData[selectedStrategy].profitFactor}</div>
              </div>
              <div className="p-3 bg-[#FAF8F3] border border-neutral-300">
                <span className="text-[10px] text-neutral-500 uppercase block">Maximum Drawdown</span>
                <div className="text-xl font-bold text-red-800">{strategiesData[selectedStrategy].maxDrawdown}</div>
              </div>
              <div className="p-3 bg-[#FAF8F3] border border-neutral-300">
                <span className="text-[10px] text-neutral-500 uppercase block">Market Condition</span>
                <div className="text-[11px] font-bold text-neutral-800 mt-1 leading-tight">{strategiesData[selectedStrategy].suitability}</div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="text-neutral-500 text-[11px]">
                💡 Tip: Never enter any real trade without checking its historical expectancy.
              </span>
              <Link
                to="/backtest"
                className="px-4 py-2 bg-[#111111] text-[#F6F4EE] font-bold uppercase hover:bg-neutral-800 transition-colors"
              >
                Backtest With Custom Stocks →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE TEACHING SECTION 4: MARKET MASTERY SELF-TEST QUIZ */}
      {/* ============================================================== */}
      <div className="border-t-4 border-double border-[#111111] pt-8 mb-10">
        <div className="border-b-2 border-[#111111] pb-3 mb-6">
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-emerald-800 font-bold">
            <GraduationCap className="w-4 h-4 text-emerald-700" />
            <span>INTERACTIVE KNOWLEDGE BENCHMARK</span>
          </div>
          <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
            TEST YOUR MARKET FOUNDATIONS
          </h2>
          <p className="font-news text-sm sm:text-base text-[#111111]/80 mt-1">
            Answer these 3 fundamental questions to evaluate if you are ready to trade simulated or real markets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          {quizItems.map((q, idx) => {
            const isAnswered = revealedQuiz[q.id];
            const chosenOption = quizAnswers[q.id];
            return (
              <div
                key={q.id}
                className="p-5 bg-white border-2 border-[#111111] shadow-[5px_5px_0px_#111111] flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-center border-b border-neutral-300 pb-2 mb-3">
                    <span className="font-bold text-neutral-500 text-[10px] uppercase">
                      QUESTION 0{idx + 1}
                    </span>
                    {isAnswered && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold ${
                        q.options[chosenOption]?.isCorrect
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-400'
                          : 'bg-red-100 text-red-800 border border-red-400'
                      }`}>
                        {q.options[chosenOption]?.isCorrect ? 'CORRECT' : 'INCORRECT'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-[#111111] mb-3 leading-snug">
                    {q.question}
                  </h3>

                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = chosenOption === optIdx;
                      let btnStyle = 'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50';
                      if (isAnswered) {
                        if (opt.isCorrect) {
                          btnStyle = 'bg-emerald-100 border-emerald-700 text-emerald-950 font-bold';
                        } else if (isSelected && !opt.isCorrect) {
                          btnStyle = 'bg-red-100 border-red-700 text-red-950';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectQuiz(q.id, optIdx, opt.isCorrect)}
                          className={`w-full text-left p-2.5 border text-xs transition-all flex items-start gap-2 cursor-pointer ${btnStyle}`}
                        >
                          <span className="font-bold shrink-0">{opt.label}.</span>
                          <span className="leading-snug">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isAnswered && (
                  <div className="p-3 bg-neutral-100 border-t border-neutral-300 text-[11px] leading-relaxed font-news text-neutral-800">
                    <strong>Pedagogical Insight:</strong> {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* FEATURED GLOBAL EQUITIES DISPATCH                              */}
      {/* ============================================================== */}
      <div className="border-t-4 border-double border-[#111111] pt-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b-2 border-[#111111] pb-3 mb-6">
          <div>
            <span className="font-mono text-xs uppercase text-[#111111]/70 font-semibold block">
              MARKET QUOTATIONS
            </span>
            <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
              FEATURED EQUITIES & PRICE DISPATCH
            </h2>
          </div>
          <Link
            to="/signup"
            className="font-mono text-xs font-bold text-[#111111] hover:underline flex items-center gap-1 uppercase"
          >
            <span>Complete Exchange Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuredCards.map((item) => {
            const sym = item.symbol;
            const stock = STOCK_DIRECTORY[sym] || {};
            const q = quotes[sym] || stock;
            const isPos = (q.change || 0) >= 0;
            const curr = item.market === 'NSE' ? '₹' : '$';

            return (
              <Link
                key={sym}
                to={`/stock/${encodeURIComponent(sym)}`}
                className="newspaper-photo-plate p-5 hover:translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start mb-2 border-b border-[#D8D2C4] pb-2 font-mono">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] uppercase">
                      {item.tag}
                    </span>
                    <MarketStatusBadge market={item.market} size="sm" showTime={false} interactive={false} />
                  </div>

                  <h3 className="font-headline uppercase text-2xl text-[#111111] font-bold group-hover:underline">
                    {stock.name || sym}
                  </h3>
                  <div className="font-mono text-xs text-[#111111]/70 mt-0.5">
                    {stock.ticker || sym} • {stock.sector}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#111111] flex justify-between items-end font-mono">
                  <div>
                    <span className="text-[10px] text-[#111111]/60 block uppercase">Last Price</span>
                    <span className="font-bold text-2xl text-[#111111]">
                      {curr}{q.price?.toLocaleString() || stock.basePrice}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#111111]/60 block uppercase">24h Change</span>
                    <span className={`text-sm font-bold flex items-center justify-end gap-0.5 ${isPos ? 'text-emerald-800' : 'text-red-800'}`}>
                      {isPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {isPos ? '+' : ''}{q.changePercent || 0}%
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Adsterra Sponsored Financial Dispatch (Placement ID: 6161748) */}
      <AdsterraAdBanner placementId="6161748" />

      {/* ============================================================== */}
      {/* 4-COLUMN BROADSHEET FEATURE PILLARS BANNER                     */}
      {/* ============================================================== */}
      <div className="border-t-2 border-[#111111] pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-news mb-8">
        <div className="border-b sm:border-b-0 sm:border-r border-[#D8D2C4] pb-4 sm:pb-0 sm:pr-4">
          <div className="font-mono text-xs font-bold uppercase text-[#111111] flex items-center gap-1.5 mb-2">
            <Lock className="w-4 h-4 text-[#111111]" />
            <span>Market Discipline</span>
          </div>
          <p className="text-xs text-[#111111]/80 leading-relaxed text-justify">
            Enforces strict real exchange schedules (NSE: 9:15-15:30 IST, US: 9:30-16:00 ET) to instill realistic trading discipline.
          </p>
        </div>

        <div className="border-b sm:border-b-0 sm:border-r border-[#D8D2C4] pb-4 sm:pb-0 sm:pr-4">
          <div className="font-mono text-xs font-bold uppercase text-[#111111] flex items-center gap-1.5 mb-2">
            <Database className="w-4 h-4 text-[#111111]" />
            <span>Local-First Zero Lag</span>
          </div>
          <p className="text-xs text-[#111111]/80 leading-relaxed text-justify">
            Transactions commit locally into the browser in 0ms with zero network failures, backed by manual and automatic cloud sync.
          </p>
        </div>

        <div className="border-b sm:border-b-0 sm:border-r border-[#D8D2C4] pb-4 sm:pb-0 sm:pr-4">
          <div className="font-mono text-xs font-bold uppercase text-[#111111] flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-4 h-4 text-[#111111]" />
            <span>TradingView Charts</span>
          </div>
          <p className="text-xs text-[#111111]/80 leading-relaxed text-justify">
            Dedicated `/stock/:symbol` routes feature institutional candlestick graphing, live quote feeds, and simulated order depth books.
          </p>
        </div>

        <div>
          <div className="font-mono text-xs font-bold uppercase text-[#111111] flex items-center gap-1.5 mb-2">
            <Globe2 className="w-4 h-4 text-[#111111]" />
            <span>Dual Ledgers</span>
          </div>
          <p className="text-xs text-[#111111]/80 leading-relaxed text-justify">
            Distinct starter balances of ₹10,00,000 INR and $100,000 USD virtual capital preserve pure geographic separation.
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FINAL PRODUCTION DISPATCH & DEVELOPER SIGN-OFF BANNER          */}
      {/* ============================================================== */}
      <div className="border-2 border-[#111111] bg-[#FAF8F3] p-6 text-center font-mono space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs uppercase font-bold text-emerald-900">
          <GraduationCap className="w-4 h-4" />
          <span>LEARNING BEFORE SPECULATION • NO REAL MONEY REQUIRED</span>
        </div>
        <h2 className="font-headline uppercase text-2xl sm:text-3xl font-black text-[#111111]">
          READY TO MASTER MARKET EXECUTION SAFELY?
        </h2>
        <p className="font-news text-sm text-[#111111]/80 max-w-2xl mx-auto leading-relaxed">
          Open your simulated account today with ₹10,00,000 INR and $100,000 USD virtual ledger. Test trading setups, backtest strategies, and preserve your capital until your statistical edge is verified.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-3 pt-2">
          <Link
            to="/signup"
            className="px-6 py-3 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Create Free Simulated Account
          </Link>
          <a
            href="https://abhijith-dev-io.web.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-white border border-[#111111] hover:bg-neutral-100 font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
          >
            <span>Engineered by Abhijith S</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}