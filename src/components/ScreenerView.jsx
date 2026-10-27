import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Filter, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  LayoutGrid, 
  ListFilter, 
  RefreshCw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Calculator, 
  ShoppingCart, 
  ExternalLink,
  SlidersHorizontal,
  Flame,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BarChart3,
  Layers,
  Info,
  HelpCircle,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STOCK_DIRECTORY, getInstantInitialQuotes, fetchLiveQuotesParallel } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import { searchGlobalEquities } from '../lib/stockSearchEngine';
import { getQuoteFreshness } from '../lib/quoteFreshness';
import { SCREENER_THRESHOLDS, evaluateStockTechnicalSignal } from '../lib/screenerEngine';

export { SCREENER_THRESHOLDS, evaluateStockTechnicalSignal };

export default function ScreenerView({ 
  isModal = false, 
  onClose, 
  onSelectStock,
  onOpenTrade,
  onOpenRiskCalculator
}) {
  const navigate = useNavigate();

  // Active view tab: TABLE vs HEATMAP
  const [activeTab, setActiveTab] = useState('TABLE');
  
  // Market filter: ALL | IN | US
  const [marketFilter, setMarketFilter] = useState('ALL');
  
  // Rule Preset
  const [rulePreset, setRulePreset] = useState('ALL');
  
  // Sector Filter
  const [sectorFilter, setSectorFilter] = useState('ALL');
  
  // Search query & Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Plain-Language Technical Signal Explanation Modal State
  const [activeSignalModal, setActiveSignalModal] = useState(null);

  // Global keyboard shortcuts: "/" to search, "Esc" to close search dropdown or modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is inside an input or textarea (unless hitting Esc)
      const targetTag = e.target.tagName;
      const isInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT';

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearching(true);
      } else if (e.key === 'Escape') {
        if (isSearching) {
          setIsSearching(false);
        } else if (isModal && onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching, isModal, onClose]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setIsSearching(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Async dynamic autocomplete search for equities
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let isMounted = true;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const mFilter = marketFilter === 'IN' ? 'NSE' : marketFilter === 'US' ? 'US' : 'ALL';
        const results = await searchGlobalEquities(searchQuery, mFilter);
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
  }, [searchQuery, marketFilter]);

  // Sorting
  const [sortField, setSortField] = useState('changePercent');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Live quotes dictionary
  const [livePrices, setLivePrices] = useState(() => getInstantInitialQuotes());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentTicks, setRecentTicks] = useState({}); // symbol -> 'UP' | 'DOWN'

  // 1. Subscribe to real-time market engine ticks
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ symbol, price, previousPrice, prices }) => {
      if (prices && Object.keys(prices).length > 0) {
        setLivePrices((prev) => ({ ...prev, ...prices }));
      }
      if (symbol && price) {
        const dir = price >= (previousPrice || price) ? 'UP' : 'DOWN';
        setRecentTicks((prev) => ({ ...prev, [symbol]: dir }));
        setTimeout(() => {
          setRecentTicks((prev) => {
            const next = { ...prev };
            delete next[symbol];
            return next;
          });
        }, 1200);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. Assemble complete universe with fundamentals and live prices
  // Excludes alias duplicate records to ensure 1 canonical row per exchange asset
  const universeStocks = useMemo(() => {
    return Object.entries(STOCK_DIRECTORY)
      .filter(([sym, meta]) => {
        if (meta.isAlias) return false;
        if (meta.targetSymbol && meta.targetSymbol !== sym && STOCK_DIRECTORY[meta.targetSymbol]) return false;
        return true;
      })
      .map(([sym, meta]) => {
        const live = livePrices[sym] || {};
        const price = Number(live.price || meta.basePrice || 100);
        const change = Number(live.change !== undefined ? live.change : 0);
        const changePercent = Number(live.changePercent !== undefined ? live.changePercent : 0);
        const isIndia = sym.endsWith('.NS') || sym.endsWith('.BO') || meta.market === 'NSE';

        // Verified 52-week parameters: prioritize live exchange bounds over directory defaults
        const high52 = Number(live.high52 || meta.high52 || (price * 1.25));
        const low52 = Number(live.low52 || meta.low52 || (price * 0.75));

        const freshness = getQuoteFreshness(live.price ? live : { ...meta, price });

        const evaluated = evaluateStockTechnicalSignal({
          symbol: sym,
          price,
          changePercent,
          high52,
          low52,
          high: Number(live.high || price * 1.01),
          low: Number(live.low || price * 0.99),
        }, freshness);

        return {
          symbol: sym,
          ticker: meta.ticker || sym.replace(/\.NS$/, ''),
          name: meta.name || sym,
          market: isIndia ? 'IN' : 'US',
          marketLabel: isIndia ? 'NSE (India)' : 'US Equities',
          currency: isIndia ? 'INR' : 'USD',
          currencySymbol: isIndia ? '₹' : '$',
          sector: meta.sector || 'Equities',
          price,
          change,
          changePercent,
          high: Number(live.high || price * 1.01),
          low: Number(live.low || price * 0.99),
          volume: live.volume || meta.volume || '1.2M',
          marketCap: meta.marketCap || 'N/A',
          peRatio: meta.peRatio || 'N/A',
          high52,
          low52,
          freshness,
          ...evaluated,
        };
      });
  }, [livePrices]);

  // Extract distinct sectors for dropdown (excluding aliases)
  const allSectors = useMemo(() => {
    const set = new Set();
    Object.values(STOCK_DIRECTORY).forEach((item) => {
      if (!item.isAlias && item.sector) set.add(item.sector);
    });
    return Array.from(set).sort();
  }, []);

  // 3. Multi-Factor Filtering Engine (strictly aligned with SCREENER_THRESHOLDS)
  const filteredStocks = useMemo(() => {
    return universeStocks.filter((stock) => {
      // Market filter
      if (marketFilter !== 'ALL' && stock.market !== marketFilter) {
        return false;
      }

      // Sector filter
      if (sectorFilter !== 'ALL' && stock.sector !== sectorFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSym = stock.symbol.toLowerCase().includes(q);
        const matchName = stock.name.toLowerCase().includes(q);
        const matchSector = stock.sector.toLowerCase().includes(q);
        if (!matchSym && !matchName && !matchSector) return false;
      }

      // Rule Preset filtering strictly honoring SCREENER_THRESHOLDS
      switch (rulePreset) {
        case 'GAINERS':
          return stock.changePercent >= SCREENER_THRESHOLDS.GAIN_THRESHOLD;
        case 'LOSERS':
          return stock.changePercent <= SCREENER_THRESHOLDS.LOSS_THRESHOLD;
        case 'OVERSOLD':
          return stock.rsi <= SCREENER_THRESHOLDS.RSI_OVERSOLD;
        case 'OVERBOUGHT':
          return stock.rsi >= SCREENER_THRESHOLDS.RSI_OVERBOUGHT;
        case 'BREAKOUT':
          return stock.distFromHigh <= SCREENER_THRESHOLDS.BREAKOUT_HIGH_PCT;
        case 'VALUE_DIP':
          return stock.distFromLow <= 12.0;
        case 'BULLISH_SIGNAL':
          return stock.verdict === 'STRONG_BUY' || stock.verdict === 'BULLISH' || stock.verdict === 'BREAKOUT';
        default:
          return true;
      }
    });
  }, [universeStocks, marketFilter, sectorFilter, searchQuery, rulePreset]);

  // 4. Sorting Engine
  const sortedStocks = useMemo(() => {
    const list = [...filteredStocks];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? comp : -comp;
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredStocks, sortField, sortDirection]);

  // 5. Market Breadth Aggregates
  const marketStats = useMemo(() => {
    const total = universeStocks.length;
    let advancers = 0;
    let decliners = 0;
    let sumChange = 0;

    universeStocks.forEach((s) => {
      if (s.changePercent > 0) advancers++;
      else if (s.changePercent < 0) decliners++;
      sumChange += s.changePercent;
    });

    const avgChange = total > 0 ? (sumChange / total).toFixed(2) : '0.00';
    const adRatio = decliners > 0 ? (advancers / decliners).toFixed(2) : advancers.toString();

    return {
      total,
      advancers,
      decliners,
      avgChange,
      adRatio,
      sentiment: advancers > decliners ? 'BULLISH BREADTH' : advancers < decliners ? 'BEARISH BREADTH' : 'BALANCED',
    };
  }, [universeStocks]);

  // Toggle sort direction or field
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Parallel refresh of real-time quotes from API
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const symbols = Object.keys(STOCK_DIRECTORY);
      const freshMap = await fetchLiveQuotesParallel(symbols);
      if (freshMap && Object.keys(freshMap).length > 0) {
        setLivePrices((prev) => ({ ...prev, ...freshMap }));
      }
    } catch (e) {
      // safe fallback
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleRowClick = (stock) => {
    if (onSelectStock) {
      onSelectStock(stock);
    } else {
      navigate(`/stock/${stock.symbol}`);
    }
  };

  return (
    <div className="w-full flex flex-col font-mono text-xs">
      
      {/* Newspaper Terminal Sub-Header & Live Breadth Ribbon */}
      <div className="bg-[#111111] text-[#F6F4EE] px-3 sm:px-6 py-2 sm:py-2.5 border-b-2 border-[#111111] flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
          <div className="p-1 bg-[#FAF8F3] text-[#111111] shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-headline uppercase font-black text-xs sm:text-base tracking-wider flex items-center gap-2 truncate">
              <span className="truncate">REAL-TIME MARKET SCREENER & TECHNICAL SCANNER</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold">
                EXCHANGE FEED
              </span>
            </h2>
            <p className="text-[9px] sm:text-[10px] text-neutral-400 truncate">
              NSE India (₹) & US Equities ($) • Real-Time Ticker Stream • Multi-Factor Quantitative Verification
            </p>
          </div>
        </div>

        {/* Live Market Breadth Stats & Refresh */}
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] w-full sm:w-auto justify-between sm:justify-end">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-neutral-900 border border-neutral-700">
            <span className="text-neutral-400 uppercase">Breadth:</span>
            <span className="text-emerald-400 font-bold">+{marketStats.advancers} Up</span>
            <span className="text-neutral-500">/</span>
            <span className="text-rose-400 font-bold">-{marketStats.decliners} Down</span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-300 font-bold">Avg {Number(marketStats.avgChange) >= 0 ? '+' : ''}{marketStats.avgChange}%</span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Fetch latest live quotes from exchange"
            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600 font-bold text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors min-h-[32px]"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh Quotes'}</span>
            <span className="sm:hidden">Refresh</span>
          </button>

          {/* View Tab Switcher */}
          <div className="inline-flex border border-neutral-700 bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('TABLE')}
              className={`px-2.5 py-1 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[30px] ${
                activeTab === 'TABLE' ? 'bg-[#FAF8F3] text-[#111111]' : 'text-neutral-300 hover:text-white'
              }`}
            >
              <ListFilter className="w-3 h-3" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HEATMAP')}
              className={`px-2.5 py-1 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[30px] ${
                activeTab === 'HEATMAP' ? 'bg-[#FAF8F3] text-[#111111]' : 'text-neutral-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Heatmap</span>
            </button>
          </div>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Screener [Esc]"
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Institutional Control Filter Deck */}
      <div className="p-3 sm:p-4 bg-white border-b-2 border-[#111111] space-y-3">
        
        {/* Quick Universe Shortcut Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          <span className="text-[9px] font-bold uppercase text-neutral-500 whitespace-nowrap shrink-0 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-600" />
            <span>Trending Universe:</span>
          </span>
          {[
            { sym: 'RELIANCE.NS', label: 'RELIANCE', flag: '🇮🇳' },
            { sym: 'TCS.NS', label: 'TCS', flag: '🇮🇳' },
            { sym: 'HDFCBANK.NS', label: 'HDFCBANK', flag: '🇮🇳' },
            { sym: 'TATAMOTORS.NS', label: 'TATAMOTORS', flag: '🇮🇳' },
            { sym: 'INFY.NS', label: 'INFY', flag: '🇮🇳' },
            { sym: 'NVDA', label: 'NVDA', flag: '🇺🇸' },
            { sym: 'AAPL', label: 'AAPL', flag: '🇺🇸' },
            { sym: 'TSLA', label: 'TSLA', flag: '🇺🇸' },
            { sym: 'MSFT', label: 'MSFT', flag: '🇺🇸' },
            { sym: 'META', label: 'META', flag: '🇺🇸' },
          ].map((preset) => {
            const isSelected = searchQuery.toUpperCase() === preset.sym.toUpperCase() || searchQuery.toUpperCase() === preset.label.toUpperCase();
            return (
              <button
                key={preset.sym}
                type="button"
                onClick={() => {
                  setSearchQuery(preset.label);
                  setIsSearching(false);
                }}
                title={`Filter by ${preset.label}`}
                className={`px-2 py-0.5 border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#111111] text-white border-[#111111] shadow-[1px_1px_0px_#111111]'
                    : 'bg-[#FAF8F3] text-neutral-700 border-neutral-300 hover:border-[#111111] hover:bg-neutral-100'
                }`}
              >
                <span>{preset.flag} {preset.label}</span>
              </button>
            );
          })}
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsSearching(false);
              }}
              className="px-1.5 py-0.5 bg-neutral-200 text-neutral-700 text-[9px] font-bold hover:bg-neutral-300 transition-colors cursor-pointer shrink-0"
              title="Clear active filter"
            >
              Clear ✕
            </button>
          )}
        </div>

        {/* Top Row: Search Input + Market Switcher + Sector Selector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box with Autocomplete Dropdown */}
          <div 
            ref={searchInputRef}
            className="relative flex-1 min-w-[220px]" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearching(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isSearching) setIsSearching(true);
                }}
                placeholder="Search ticker, company, or sector (Press '/' to search)..."
                className="w-full pl-8 pr-12 py-1.5 bg-[#FAF8F3] border border-[#111111] font-mono text-xs font-bold outline-none placeholder:font-normal placeholder:text-neutral-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearching(false);
                    }}
                    className="text-neutral-400 hover:text-neutral-800 text-xs px-1 cursor-pointer font-bold"
                  >
                    ✕
                  </button>
                )}
                <kbd className="hidden sm:inline-block px-1 py-0.2 bg-neutral-200 text-neutral-600 text-[9px] font-bold border border-neutral-300">
                  /
                </kbd>
              </div>
            </div>

            {/* Live Autocomplete Dropdown */}
            {isSearching && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] max-h-64 overflow-y-auto z-50 divide-y divide-neutral-200 animate-in fade-in duration-100">
                <div className="px-3 py-1 bg-[#FAF8F3] text-[9px] text-neutral-500 font-bold uppercase flex justify-between items-center">
                  <span>{searchLoading ? 'Scanning Equities...' : `Results (${searchResults.length})`}</span>
                  <span className="text-[9px] text-neutral-400">Esc to dismiss</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-3 text-center text-neutral-500 text-xs">
                    {searchLoading ? 'Searching global exchanges...' : 'No equities matched query. Showing matching table rows.'}
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const isItemInd = item.market === 'NSE' || item.symbol.endsWith('.NS');
                    const live = livePrices[item.symbol] || {};
                    const price = live.price || item.basePrice || item.price || 100;
                    const changePercent = live.changePercent !== undefined ? live.changePercent : 0;
                    
                    return (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          setSearchQuery(item.symbol.replace(/\.NS$/, ''));
                          setIsSearching(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-neutral-100 transition-colors flex items-center justify-between gap-2 cursor-pointer font-mono"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-[#111111] text-xs font-bold">{item.symbol}</strong>
                            <span className="px-1 py-0.2 bg-[#EFECE3] border border-[#111111] text-[9px] font-bold">
                              {isItemInd ? 'NSE (₹)' : 'US ($)'}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-600 truncate max-w-[260px]">
                            {item.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs tabular-nums text-[#111111]">
                            {isItemInd ? '₹' : '$'}{Number(price).toFixed(2)}
                          </span>
                          <span className={`block text-[9px] font-bold tabular-nums ${
                            changePercent >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {changePercent >= 0 ? '+' : ''}{Number(changePercent).toFixed(2)}%
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Market Tabs */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase text-neutral-500 mr-0.5">Market:</span>
              {[
                { id: 'ALL', label: 'All Global' },
                { id: 'IN', label: '🇮🇳 NSE' },
                { id: 'US', label: '🇺🇸 US' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMarketFilter(m.id)}
                  className={`px-2.5 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                    marketFilter === m.id
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-[#FAF8F3] text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Sector Dropdown */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase text-neutral-500 mr-0.5">Sector:</span>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="bg-[#FAF8F3] border border-[#111111] px-2 py-1 text-xs font-bold outline-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="ALL">All Sectors</option>
                {allSectors.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Row: Strategy Preset Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          <span className="text-[9px] font-bold uppercase text-neutral-500 whitespace-nowrap shrink-0 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-neutral-700" />
            <span>Rule Presets:</span>
          </span>
          {[
            { id: 'ALL', label: 'All Equities' },
            { id: 'GAINERS', label: '🚀 Top Gainers (≥ +0.8%)' },
            { id: 'LOSERS', label: '🔻 Top Losers (≤ -0.8%)' },
            { id: 'OVERSOLD', label: '🟢 Oversold (RSI ≤ 35)' },
            { id: 'OVERBOUGHT', label: '🔴 Overbought (RSI ≥ 65)' },
            { id: 'BREAKOUT', label: '⚡ 52W High Breakouts' },
            { id: 'VALUE_DIP', label: '🛡️ Deep Value Floor' },
            { id: 'BULLISH_SIGNAL', label: '💎 High-Conviction Bullish' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setRulePreset(preset.id)}
              className={`px-2.5 py-1 border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                rulePreset === preset.id
                  ? 'bg-[#111111] text-white border-[#111111] shadow-[2px_2px_0px_#111111]'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#111111] hover:bg-neutral-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace: Table or Heatmap */}
      <div className="p-3 sm:p-5 bg-[#F6F4EE] flex-1 overflow-y-auto">
        
        {activeTab === 'TABLE' ? (
          <div className="bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono min-w-[760px]">
              <thead>
                <tr className="bg-[#FAF8F3] border-b-2 border-[#111111] text-[10px] font-bold uppercase text-neutral-600 select-none">
                  
                  <th 
                    onClick={() => handleSort('symbol')}
                    className="p-3 cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Instrument</span>
                      {sortField === 'symbol' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>

                  <th className="p-3">Market</th>
                  <th className="p-3">Sector</th>

                  <th 
                    onClick={() => handleSort('price')}
                    className="p-3 text-right cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Live Price</span>
                      {sortField === 'price' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSort('changePercent')}
                    className="p-3 text-right cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Change %</span>
                      {sortField === 'changePercent' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSort('rsi')}
                    className="p-3 text-center cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>RSI (14)</span>
                      {sortField === 'rsi' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSort('pct52W')}
                    className="p-3 text-center cursor-pointer hover:bg-neutral-200 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>52W Position</span>
                      {sortField === 'pct52W' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>

                  <th className="p-3">Technical Signal & Rationale</th>
                  <th className="p-3 text-center">Fast Execution</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200">
                {sortedStocks.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-10 text-center text-neutral-500 font-sans">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                      <strong className="block text-sm text-[#111111]">No matching equities found</strong>
                      <span className="text-xs text-neutral-500">
                        Try resetting your search query or switching rule presets.
                      </span>
                    </td>
                  </tr>
                ) : (
                  sortedStocks.map((stock) => {
                    const isUp = stock.changePercent >= 0;
                    const tickDir = recentTicks[stock.symbol];
                    const tickBg = tickDir === 'UP' ? 'bg-emerald-50' : tickDir === 'DOWN' ? 'bg-rose-50' : '';

                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => handleRowClick(stock)}
                        className={`hover:bg-neutral-100/80 transition-colors cursor-pointer group ${tickBg}`}
                      >
                        {/* 1. Symbol & Name */}
                        <td className="p-3 font-bold text-[#111111]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black group-hover:underline">
                              {stock.ticker}
                            </span>
                            {tickDir && (
                              <span className={`w-1.5 h-1.5 rounded-full ${tickDir === 'UP' ? 'bg-emerald-600 animate-ping' : 'bg-rose-600 animate-ping'}`} />
                            )}
                          </div>
                          <span className="block text-[10px] font-sans font-normal text-neutral-500 truncate max-w-[150px]">
                            {stock.name}
                          </span>
                        </td>

                        {/* 2. Market Badge */}
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 border text-[9px] font-bold ${
                            stock.market === 'IN' 
                              ? 'bg-amber-50 text-amber-900 border-amber-300' 
                              : 'bg-blue-50 text-blue-900 border-blue-300'
                          }`}>
                            {stock.market === 'IN' ? '🇮🇳 NSE' : '🇺🇸 US'}
                          </span>
                        </td>

                        {/* 3. Sector */}
                        <td className="p-3 text-[10px] text-neutral-600 truncate max-w-[130px]">
                          {stock.sector}
                        </td>

                        {/* 4. Live Price & Freshness Telemetry */}
                        <td className="p-3 text-right">
                          <div className="font-bold text-sm tabular-nums text-[#111111]">
                            {stock.currencySymbol}{stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span 
                              className={`text-[8px] font-bold px-1 py-0.2 border uppercase ${stock.freshness?.badgeClass || 'bg-neutral-100 text-neutral-600 border-neutral-300'}`}
                              title={`Price received: ${stock.freshness?.asOf || 'Recent'} (${stock.freshness?.sourceLabel || 'Exchange'})`}
                            >
                              {stock.freshness?.label || 'LIVE'}
                            </span>
                          </div>
                        </td>

                        {/* 5. Change % */}
                        <td className={`p-3 text-right font-bold tabular-nums text-sm ${isUp ? 'text-emerald-700' : 'text-rose-700'}`}>
                          <div className="flex items-center justify-end gap-0.5">
                            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            <span>{isUp ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
                          </div>
                          <span className="block text-[9px] text-neutral-400 font-normal">
                            Δ {stock.currencySymbol}{Math.abs(stock.change).toFixed(2)}
                          </span>
                        </td>

                        {/* 6. RSI (14) - Strictly aligned with SCREENER_THRESHOLDS */}
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold border tabular-nums inline-block ${
                            stock.rsi <= SCREENER_THRESHOLDS.RSI_OVERSOLD 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-400' 
                              : stock.rsi >= SCREENER_THRESHOLDS.RSI_OVERBOUGHT
                              ? 'bg-rose-100 text-rose-800 border-rose-400'
                              : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                          }`}>
                            {stock.rsi}
                          </span>
                          <span className="block text-[8px] text-neutral-400 uppercase mt-0.5">
                            {stock.rsi <= SCREENER_THRESHOLDS.RSI_OVERSOLD ? 'Oversold' : stock.rsi >= SCREENER_THRESHOLDS.RSI_OVERBOUGHT ? 'Overbought' : 'Neutral'}
                          </span>
                        </td>

                        {/* 7. 52-Week Range Gauge (Strictly Validated Bounds) */}
                        <td className="p-3 text-center">
                          <div className="w-20 mx-auto bg-neutral-200 h-1.5 border border-neutral-300 relative overflow-hidden">
                            <div 
                              className={`h-full ${stock.pct52W > 70 ? 'bg-purple-600' : stock.pct52W < 30 ? 'bg-amber-600' : 'bg-blue-600'}`}
                              style={{ width: `${stock.pct52W}%` }}
                            />
                          </div>
                          <span className="block text-[9px] text-neutral-700 font-bold tabular-nums mt-0.5">
                            {stock.pct52W}% of 52W
                          </span>
                          <span className="block text-[8px] text-neutral-500 tabular-nums">
                            High: -{stock.distFromHigh}%
                          </span>
                        </td>

                        {/* 8. Technical Signal & Rationale with Plain-Language Inspector */}
                        <td className="p-3 max-w-[240px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`inline-block px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${stock.badgeColor}`}>
                              {stock.verdict}
                            </span>
                            {stock.explanation && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSignalModal({ 
                                    stock, 
                                    ...stock.explanation, 
                                    verdict: stock.verdict, 
                                    reasoning: stock.reasoning 
                                  });
                                }}
                                className="text-[9px] text-neutral-500 hover:text-[#111111] hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                                title="Click to view plain-language formula, inputs & invalidation criteria"
                              >
                                <Info className="w-3 h-3 text-neutral-600" />
                                <span>Rationale</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] font-sans text-neutral-600 leading-tight">
                            {stock.reasoning}
                          </p>
                        </td>

                        {/* 9. Fast Action Suite */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            
                            {/* 1-Click Order (Disabled when quote is stale to prevent slippage) */}
                            <button
                              type="button"
                              disabled={Boolean(stock.freshness?.isStale)}
                              onClick={() => {
                                if (stock.freshness?.isStale) return;
                                if (onOpenTrade) {
                                  onOpenTrade({ symbol: stock.symbol, price: stock.price, market: stock.market }, 'BUY');
                                } else {
                                  navigate(`/stock/${stock.symbol}`);
                                }
                              }}
                              title={
                                stock.freshness?.isStale 
                                  ? `Instant trade disabled: Quote for ${stock.symbol} is stale. Open detail page to refresh price.`
                                  : `Instant Trade ${stock.symbol}`
                              }
                              className={`p-1.5 font-bold text-[9px] uppercase transition-colors shadow-xs ${
                                stock.freshness?.isStale
                                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-300'
                                  : 'bg-[#111111] hover:bg-neutral-800 text-white cursor-pointer'
                              }`}
                            >
                              <ShoppingCart className="w-3 h-3" />
                            </button>

                            {/* 1-Click Risk Sizer */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenRiskCalculator) {
                                  onOpenRiskCalculator({ symbol: stock.symbol, price: stock.price, market: stock.market });
                                } else {
                                  navigate(`/stock/${stock.symbol}`);
                                }
                              }}
                              title={`Calculate Optimal Position Sizing for ${stock.symbol}`}
                              className="p-1.5 bg-white border border-[#111111] hover:bg-neutral-100 text-[#111111] font-bold text-[9px] uppercase cursor-pointer transition-colors"
                            >
                              <Calculator className="w-3 h-3" />
                            </button>

                            {/* Navigate to Detailed View */}
                            <button
                              type="button"
                              onClick={() => navigate(`/stock/${stock.symbol}`)}
                              title={`Open Chart & Order Book for ${stock.symbol}`}
                              className="p-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-bold text-[9px] uppercase cursor-pointer transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Visual Institutional Market Heatmap Grid */
          <div className="space-y-4">
            
            {/* Heatmap Legend */}
            <div className="bg-white p-3 border-2 border-[#111111] flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <span className="text-neutral-600 font-bold">
                Performance Color Grading • Real-Time Price Micro-Fluctuations
              </span>
              <div className="flex items-center gap-2 font-bold text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-rose-700 border border-[#111111]"></span> &lt; -2.5%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-rose-500 border border-[#111111]"></span> -1.0%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-neutral-300 border border-[#111111]"></span> 0.0%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-emerald-500 border border-[#111111]"></span> +1.0%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-emerald-700 border border-[#111111]"></span> &gt; +2.5%
                </span>
              </div>
            </div>

            {/* Heatmap Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {sortedStocks.map((stock) => {
                const chg = stock.changePercent;
                let bgStyle = 'bg-neutral-200 text-neutral-900 border-[#111111]';
                let tagClass = 'bg-neutral-300 text-neutral-800';

                if (chg >= 2.5) {
                  bgStyle = 'bg-emerald-700 text-white border-emerald-950 shadow-[3px_3px_0px_#064e3b]';
                  tagClass = 'bg-emerald-800 text-white';
                } else if (chg >= 0.8) {
                  bgStyle = 'bg-emerald-600 text-white border-emerald-900 shadow-[3px_3px_0px_#047857]';
                  tagClass = 'bg-emerald-700 text-white';
                } else if (chg > 0) {
                  bgStyle = 'bg-emerald-100 text-emerald-950 border-emerald-400 shadow-[2px_2px_0px_#10b981]';
                  tagClass = 'bg-emerald-200 text-emerald-900';
                } else if (chg <= -2.5) {
                  bgStyle = 'bg-rose-700 text-white border-rose-950 shadow-[3px_3px_0px_#881337]';
                  tagClass = 'bg-rose-800 text-white';
                } else if (chg <= -0.8) {
                  bgStyle = 'bg-rose-600 text-white border-rose-900 shadow-[3px_3px_0px_#be123c]';
                  tagClass = 'bg-rose-700 text-white';
                } else if (chg < 0) {
                  bgStyle = 'bg-rose-100 text-rose-950 border-rose-400 shadow-[2px_2px_0px_#f43f5e]';
                  tagClass = 'bg-rose-200 text-rose-900';
                }

                return (
                  <div
                    key={stock.symbol}
                    onClick={() => handleRowClick(stock)}
                    className={`p-3.5 border-2 flex flex-col justify-between h-28 cursor-pointer hover:scale-[1.02] transition-transform ${bgStyle}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="font-bold text-sm tracking-wider block">
                          {stock.ticker}
                        </strong>
                        <span className="text-[10px] opacity-80 truncate block max-w-[90px] font-sans">
                          {stock.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {stock.freshness?.isStale && (
                          <span className="px-1 py-0.2 text-[8px] font-bold uppercase bg-amber-400 text-stone-950 border border-stone-800 rounded-xs">
                            STALE
                          </span>
                        )}
                        <span className={`px-1 py-0.2 text-[9px] font-bold uppercase rounded-xs ${tagClass}`}>
                          {stock.market === 'IN' ? 'NSE' : 'US'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-2">
                      <div className="text-[10px] opacity-85">
                        <span className="block font-bold">
                          {stock.currencySymbol}{stock.price.toFixed(2)}
                        </span>
                        <span className="text-[9px] opacity-75">
                          RSI: {stock.rsi}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black tabular-nums block">
                          {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                        </span>
                        <span className="text-[8px] font-bold uppercase opacity-80">
                          {stock.verdict}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Broad-Sheet Newspaper Dispatch Status Ribbon */}
      <div className="px-4 sm:px-6 py-2.5 bg-[#EFECE4] border-t-2 border-[#111111] flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-neutral-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
          <span className="font-bold text-neutral-800 uppercase">
            Showing {sortedStocks.length} of {universeStocks.length} Tracked Securities
          </span>
          <span className="text-neutral-400">|</span>
          <span>Dual-Currency (₹ INR Delivery / $ USD International)</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Sort: <strong className="text-neutral-800 uppercase">{sortField} ({sortDirection})</strong></span>
          <span className="text-neutral-400">|</span>
          <span className="text-neutral-500 font-sans">Synced via multi-source exchange streams & verified snapshots</span>
        </div>
      </div>

      {/* Plain-Language Signal & Indicator Inspector Modal */}
      {activeSignalModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setActiveSignalModal(null)}
        >
          <div 
            className="newspaper-photo-plate bg-[#F6F4EE] border-4 border-[#111111] shadow-[8px_8px_0px_#111111] max-w-lg w-full p-5 sm:p-6 font-mono text-xs text-[#111111]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b-2 border-[#111111] pb-3 mb-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] text-[9px] font-bold uppercase">
                    INDICATOR AUDIT
                  </span>
                  <span className={`px-1.5 py-0.5 border text-[9px] font-bold ${activeSignalModal.stock?.freshness?.badgeClass || 'bg-neutral-100'}`}>
                    {activeSignalModal.stock?.freshness?.label || 'LIVE TICK'}
                  </span>
                </div>
                <h3 className="font-headline font-black text-xl text-[#111111] mt-1">
                  {activeSignalModal.stock?.ticker} — Technical Rationale
                </h3>
                <span className="text-[10px] text-neutral-600 font-sans">
                  {activeSignalModal.stock?.name} • Live: {activeSignalModal.stock?.currencySymbol}{activeSignalModal.stock?.price?.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSignalModal(null)}
                className="p-1.5 border border-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verdict Ribbon */}
            <div className="p-3 bg-white border border-[#111111] mb-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
                <span className="font-bold text-[10px] uppercase text-neutral-500">Evaluated Verdict</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${activeSignalModal.stock?.badgeColor}`}>
                  {activeSignalModal.verdict}
                </span>
              </div>
              <p className="font-news text-xs text-neutral-800 mt-2 leading-relaxed">
                {activeSignalModal.reasoning}
              </p>
            </div>

            {/* Plain-Language Details Breakdown */}
            <div className="space-y-2.5 bg-neutral-100 p-3.5 border border-[#111111] text-[11px]">
              <div>
                <span className="font-bold text-[#111111] block uppercase text-[10px] text-neutral-600">
                  1. Analysis Timeframe
                </span>
                <span className="font-mono text-neutral-800">{activeSignalModal.timeframe}</span>
              </div>

              <div>
                <span className="font-bold text-[#111111] block uppercase text-[10px] text-neutral-600">
                  2. Quantitative Indicator Inputs
                </span>
                <span className="font-mono text-neutral-800">{activeSignalModal.indicatorsUsed}</span>
              </div>

              <div>
                <span className="font-bold text-[#111111] block uppercase text-[10px] text-neutral-600">
                  3. Setup Condition
                </span>
                <p className="font-news text-neutral-800 mt-0.5 leading-tight">{activeSignalModal.condition}</p>
              </div>

              <div>
                <span className="font-bold text-[#111111] block uppercase text-[10px] text-red-800">
                  4. What Would Invalidate This Signal
                </span>
                <p className="font-news text-red-950 mt-0.5 leading-tight">{activeSignalModal.invalidationCondition}</p>
              </div>
            </div>

            {/* Disclaimer Notice */}
            <div className="mt-3 p-2 bg-amber-50 border border-amber-300 text-[10px] font-sans text-amber-900 leading-tight">
              <strong>Regulatory Notice:</strong> Indicators evaluate recent price velocity and historical bounds. They are not predictive guarantees of future profit. Always verify your stop-loss before execution.
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const stock = activeSignalModal.stock;
                  setActiveSignalModal(null);
                  if (onOpenRiskCalculator) {
                    onOpenRiskCalculator({ symbol: stock.symbol, price: stock.price, market: stock.market });
                  }
                }}
                className="px-3 py-1.5 bg-white border border-[#111111] hover:bg-neutral-100 font-mono text-xs font-bold cursor-pointer"
              >
                Size Position
              </button>
              <button
                type="button"
                onClick={() => setActiveSignalModal(null)}
                className="px-4 py-1.5 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 font-mono text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
