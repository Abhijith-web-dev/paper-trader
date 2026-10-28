import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  AreaSeries,
  LineSeries, 
  HistogramSeries, 
  ColorType, 
  CrosshairMode,
  LineStyle 
} from 'lightweight-charts';
import { getStockHistoricalCandles, getStockQuote, STOCK_DIRECTORY } from '../lib/yahooFinance';
import { subscribeToMarketStream } from '../lib/omniFeed';
import { getQuoteFreshness } from '../lib/quoteFreshness';
import { calculateSMA, calculateEMA, calculateBollingerBands } from '../lib/indicators';
import { 
  formatExchangeLocalTime, 
  getExchangeTimezoneMeta, 
  validateCandle,
  getTimeframeWindowDescription 
} from '../lib/intradayAggregator';
import { 
  BarChart3, 
  LineChart, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Radio, 
  Layers,
  Activity,
  Maximize2,
  Minimize2,
  Clock,
  AlertCircle
} from 'lucide-react';

/**
 * Format timestamp or date string for HUD using exchange timezone
 */
function formatHudTime(rawTime, tzMeta, isIntraday = true) {
  if (!rawTime) return '';
  if (typeof rawTime === 'number') {
    return formatExchangeLocalTime(rawTime, tzMeta, isIntraday ? 'datetime' : 'time');
  }
  return String(rawTime);
}

/**
 * Native First-Party Real-Time Financial Chart
 * 100% Client-Side • Zero Third-Party Iframes • Zero Backend • Zero Cost
 * Powered by Lightweight Charts v5 Canvas Engine
 */
export default function StockChart({ 
  symbol = 'AAPL', 
  currencySymbol = '₹', 
  livePrice,
  activeIndicators: parentIndicators,
  onToggleIndicator: parentOnToggle,
  onQuoteSync = null,
}) {
  const chartWrapperRef = useRef(null);
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const areaSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const smaSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const candlesRef = useRef([]);

  // Stable reference for onQuoteSync to prevent re-fetch and render loops
  const onQuoteSyncRef = useRef(onQuoteSync);
  useEffect(() => {
    onQuoteSyncRef.current = onQuoteSync;
  }, [onQuoteSync]);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chart Configuration State
  const [timeframe, setTimeframe] = useState('1m'); // Default to 1m intraday per-minute view
  const isIntraday = ['1m', '3m', '5m', '1D', '1W'].includes(timeframe);
  const [windowMeta, setWindowMeta] = useState(() => getTimeframeWindowDescription('1m'));
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'area'
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tzMeta, setTzMeta] = useState(() => getExchangeTimezoneMeta(symbol));
  const [unavailableInfo, setUnavailableInfo] = useState(null);
  const [isMarketClosed, setIsMarketClosed] = useState(false);
  const [lastCompletedClose, setLastCompletedClose] = useState(null);
  const [lastBarTime, setLastBarTime] = useState(null);
  const [internalIndicators, setInternalIndicators] = useState({
    volume: true,
    sma: false,
    ema: false,
    bb: false,
  });

  // Effective indicators: parent prop if provided, else internal state
  const activeIndicators = parentIndicators || internalIndicators;

  // Crosshair HUD Data
  const [hoveredData, setHoveredData] = useState(null);
  const [quoteData, setQuoteData] = useState(null);

  // Fullscreen Mode Toggle Handler
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen) {
        setIsFullscreen(true);
        if (chartWrapperRef.current && document.fullscreenEnabled && !document.fullscreenElement) {
          await chartWrapperRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        setIsFullscreen(false);
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
      }
    } catch {
      // Graceful fallback to CSS overlay
    }
  }, [isFullscreen]);

  // Sync state if user exits via browser ESC or native controls
  useEffect(() => {
    const handleNativeFsChange = () => {
      const isNativeFs = Boolean(document.fullscreenElement);
      if (!isNativeFs && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleNativeFsChange);
    document.addEventListener('webkitfullscreenchange', handleNativeFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleNativeFsChange);
      document.removeEventListener('webkitfullscreenchange', handleNativeFsChange);
    };
  }, [isFullscreen]);

  // Keyboard shortcut listener: 'F' toggles Fullscreen, 'Escape' exits Fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName;
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // Prevent background scrolling when in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isFullscreen]);

  // Keep candlesRef updated
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Basic Symbol metadata
  const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '').toUpperCase();
  const isIndian = symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO');
  const market = isIndian ? 'NSE' : 'NASDAQ';
  const stockMeta = STOCK_DIRECTORY[symbol] || { name: cleanSymbol, currency: isIndian ? 'INR' : 'USD' };

  // 1. Fetch initial historical candles on symbol or timeframe change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadCandles() {
      try {
        const quote = await getStockQuote(symbol);
        if (isMounted && quote) {
          setQuoteData(quote);
        }

        const data = await getStockHistoricalCandles(symbol, timeframe);
        if (isMounted) {
          const resolvedWindowMeta = data?.windowMeta || getTimeframeWindowDescription(timeframe);
          setWindowMeta(resolvedWindowMeta);

          if (data?.isUnavailable || !data || (Array.isArray(data) && data.length === 0)) {
            setCandles([]);
            setUnavailableInfo({
              isUnavailable: true,
              reason: data?.reason || `Intraday exchange data currently unavailable for ${symbol} on interval ${timeframe}.`,
            });
            setTzMeta(data?.timezone || getExchangeTimezoneMeta(symbol, data?.meta));
            setLoading(false);
            return;
          }

          setUnavailableInfo(null);
          const resolvedTz = data?.timezone || getExchangeTimezoneMeta(symbol, data?.meta);
          setTzMeta(resolvedTz);
          setIsMarketClosed(Boolean(data?.isMarketClosed));

          const rawCandles = Array.isArray(data) ? data : data?.candles || [];
          
          // Ensure candles are sorted strictly by ascending time with no duplicates
          const seenTimes = new Set();
          const validCandles = [];
          for (const c of rawCandles) {
            const { isValid, candle } = validateCandle(c);
            if (isValid && candle && !seenTimes.has(candle.time)) {
              seenTimes.add(candle.time);
              validCandles.push(candle);
            }
          }

          validCandles.sort((a, b) => {
            if (typeof a.time === 'number' && typeof b.time === 'number') {
              return a.time - b.time;
            }
            return String(a.time).localeCompare(String(b.time));
          });

          const lastCandle = validCandles[validCandles.length - 1];
          if (lastCandle) {
            setLastCompletedClose(data?.lastCompletedClose ?? lastCandle.close);
            setLastBarTime(data?.lastBarTime ?? lastCandle.time);
          }

          // Sync normalized quote to parent (StockDetailPage / StockDetailsPanel)
          if (data && (data.quote || data.currentPrice)) {
            const synQuote = data.quote || {
              symbol,
              price: data.currentPrice,
              high: data.dayHigh,
              low: data.dayLow,
              previousClose: data.previousClose,
              change: data.change ?? (data.currentPrice - data.previousClose),
              changePercent: data.changePercent ?? (((data.currentPrice - data.previousClose) / (data.previousClose || 1)) * 100),
              timestamp: data.timestamp || Date.now(),
              source: 'normalized_exchange_feed',
            };
            setQuoteData(synQuote);
            if (onQuoteSyncRef.current) {
              onQuoteSyncRef.current(synQuote);
            }

            // Invariant: during active open session, last candle reflects normalized current price
            if (isIntraday && !data.isMarketClosed && validCandles.length > 0) {
              const last = validCandles[validCandles.length - 1];
              last.close = synQuote.price;
              last.high = Math.max(last.high, synQuote.price);
              last.low = Math.min(last.low, synQuote.price);
            }
          }

          setCandles(validCandles);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Error fetching chart candles:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadCandles();

    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe, isIntraday]);

  // 2. Subscribe to real-time price stream from OmniFeed
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      const live = prices[symbol];
      if (live && live.price) {
        const newPrice = Number(live.price);
        setQuoteData((prev) => {
          const updatedHigh = Math.max(prev?.high || newPrice, newPrice);
          const updatedLow = Math.min(prev?.low || newPrice, newPrice);
          return {
            ...prev,
            ...live,
            price: newPrice,
            high: updatedHigh,
            low: updatedLow,
            timestamp: live.timestamp || Date.now(),
          };
        });

        // Only update active ongoing candle on the chart during active open market sessions
        if (!isMarketClosed) {
          const currentCandles = candlesRef.current;
          if (candleSeriesRef.current && currentCandles.length > 0) {
            const last = currentCandles[currentCandles.length - 1];
            const updatedLast = {
              time: last.time,
              open: last.open,
              high: Math.max(last.high, newPrice),
              low: Math.min(last.low, newPrice),
              close: newPrice,
              volume: (last.volume || 1000) + 10,
            };

            try {
              if (chartType === 'candles' && candleSeriesRef.current) {
                candleSeriesRef.current.update(updatedLast);
              } else if (chartType === 'area' && areaSeriesRef.current) {
                areaSeriesRef.current.update({ time: last.time, value: newPrice });
              }
            } catch {
              // Safe fallback if series was disposed
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [symbol, chartType, isMarketClosed]);

  // 3. Initialize & Build Lightweight Charts Canvas Instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Teardown previous chart instance cleanly
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.remove();
      } catch {}
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const computedHeight = isFullscreen
      ? (container.clientHeight || Math.max(480, window.innerHeight - 150))
      : 480;

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: computedHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#1C1917',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#F3EFE6', style: LineStyle.Solid },
        horzLines: { color: '#F3EFE6', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#1C1917',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1C1917',
        },
        horzLine: {
          color: '#1C1917',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1C1917',
        },
      },
      rightPriceScale: {
        borderColor: '#1C1917',
        scaleMargins: {
          top: 0.12,
          bottom: activeIndicators.volume ? 0.22 : 0.08,
        },
      },
      timeScale: {
        borderColor: '#1C1917',
        timeVisible: isIntraday,
        secondsVisible: false,
        barSpacing: ['1m', '3m', '5m'].includes(timeframe) ? 13 : 8,
        minBarSpacing: 5,
        rightOffset: ['1m', '3m', '5m'].includes(timeframe) ? 6 : 2,
        tickMarkFormatter: (time) => {
          if (typeof time === 'number') {
            return formatExchangeLocalTime(time, tzMeta, 'tick');
          }
          if (typeof time === 'object' && time !== null) {
            return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
          }
          return String(time);
        },
      },
      localization: {
        timeFormatter: (time) => {
          if (typeof time === 'number') {
            return formatExchangeLocalTime(time, tzMeta, 'datetime');
          }
          return String(time);
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartInstanceRef.current = chart;

    if (candles.length > 0) {
      // Candlestick Series
      if (chartType === 'candles') {
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#059669',
          downColor: '#DC2626',
          borderVisible: false,
          wickUpColor: '#059669',
          wickDownColor: '#DC2626',
        });
        candlestickSeries.setData(candles);
        candleSeriesRef.current = candlestickSeries;
        areaSeriesRef.current = null;
      } else {
        // Mountain / Area Line Series
        const areaSeries = chart.addSeries(AreaSeries, {
          topColor: 'rgba(5, 150, 105, 0.28)',
          bottomColor: 'rgba(5, 150, 105, 0.01)',
          lineColor: '#059669',
          lineWidth: 2,
        });
        const areaData = candles.map((c) => ({ time: c.time, value: c.close }));
        areaSeries.setData(areaData);
        areaSeriesRef.current = areaSeries;
        candleSeriesRef.current = null;
      }

      // Volume Histogram Series
      if (activeIndicators.volume) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
        const volumeData = candles.map((c) => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(5, 150, 105, 0.35)' : 'rgba(220, 38, 38, 0.35)',
        }));
        volumeSeries.setData(volumeData);
        volumeSeriesRef.current = volumeSeries;
      } else {
        volumeSeriesRef.current = null;
      }

      // SMA 20 Overlay Series
      if (activeIndicators.sma) {
        const smaData = calculateSMA(candles, 20);
        if (smaData.length > 0) {
          const smaSeries = chart.addSeries(LineSeries, {
            color: '#D97706',
            lineWidth: 2,
            title: 'SMA 20',
          });
          smaSeries.setData(smaData);
          smaSeriesRef.current = smaSeries;
        }
      } else {
        smaSeriesRef.current = null;
      }

      // EMA 50 Overlay Series
      if (activeIndicators.ema) {
        const emaData = calculateEMA(candles, 50);
        if (emaData.length > 0) {
          const emaSeries = chart.addSeries(LineSeries, {
            color: '#2563EB',
            lineWidth: 2,
            title: 'EMA 50',
          });
          emaSeries.setData(emaData);
          emaSeriesRef.current = emaSeries;
        }
      } else {
        emaSeriesRef.current = null;
      }

      // Bollinger Bands Overlay Series
      if (activeIndicators.bb) {
        const bbData = calculateBollingerBands(candles, 20, 2);
        if (bbData.upper && bbData.upper.length > 0) {
          const bbUpper = chart.addSeries(LineSeries, {
            color: '#8B5CF6',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            title: 'BB Upper',
          });
          bbUpper.setData(bbData.upper);
          bbUpperSeriesRef.current = bbUpper;

          const bbLower = chart.addSeries(LineSeries, {
            color: '#8B5CF6',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            title: 'BB Lower',
          });
          bbLower.setData(bbData.lower);
          bbLowerSeriesRef.current = bbLower;
        }
      } else {
        bbUpperSeriesRef.current = null;
        bbLowerSeriesRef.current = null;
      }

      // Fit content neatly inside viewport
      chart.timeScale().fitContent();
    }

    // Subscribe to crosshair movement to update HUD bar
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredData(null);
        return;
      }

      const activeSeries = candleSeriesRef.current || areaSeriesRef.current;
      if (activeSeries && param.seriesData.has(activeSeries)) {
        const barData = param.seriesData.get(activeSeries);
        if (barData) {
          setHoveredData({
            time: param.time,
            open: barData.open ?? barData.value,
            high: barData.high ?? barData.value,
            low: barData.low ?? barData.value,
            close: barData.close ?? barData.value,
            volume: volumeSeriesRef.current && param.seriesData.has(volumeSeriesRef.current) 
              ? param.seriesData.get(volumeSeriesRef.current)?.value 
              : null,
          });
        }
      }
    });

    // Resize Observer for fluid responsiveness
    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = isFullscreen
          ? (chartContainerRef.current.clientHeight || Math.max(480, window.innerHeight - 150))
          : 480;
        chartInstanceRef.current.applyOptions({
          width,
          height,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch {}
        chartInstanceRef.current = null;
      }
    };
  }, [candles, chartType, activeIndicators, timeframe, isIntraday, isFullscreen, tzMeta]);

  // Dynamic resize and fit when fullscreen mode toggles
  useEffect(() => {
    const applyDimensions = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = isFullscreen
          ? (chartContainerRef.current.clientHeight || Math.max(480, window.innerHeight - 150))
          : 480;
        chartInstanceRef.current.applyOptions({
          width,
          height,
        });
        chartInstanceRef.current.timeScale().fitContent();
      }
    };

    const t1 = setTimeout(applyDimensions, 40);
    const t2 = setTimeout(applyDimensions, 180);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFullscreen]);

  // Toolbar Handlers
  const handleZoomIn = useCallback(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().zoomIn(1.5);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().zoomOut(1.5);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  }, []);

  const toggleIndicator = (name) => {
    if (typeof parentOnToggle === 'function') {
      parentOnToggle(name);
    } else {
      setInternalIndicators((prev) => ({ ...prev, [name]: !prev[name] }));
    }
  };

  // Derive Current Display Price
  const currentPrice = livePrice != null 
    ? livePrice 
    : (quoteData?.price || candles[candles.length - 1]?.close || 100);
  const changeAbs = quoteData?.change || 0;
  const changePct = quoteData?.changePercent || 0;
  const isPositive = changeAbs >= 0;

  // Active HUD Values: Hovered candle data or latest quote snapshot
  const activeHud = hoveredData || (candles.length > 0 ? candles[candles.length - 1] : null);

  // Quote freshness telemetry
  const quoteFreshness = useMemo(() => {
    return getQuoteFreshness(quoteData || { price: currentPrice, timestamp: Date.now() });
  }, [quoteData, currentPrice]);

  return (
    <div 
      ref={chartWrapperRef}
      className={
        isFullscreen 
          ? "fixed inset-0 z-[9999] flex flex-col bg-white w-screen h-screen select-none overflow-hidden m-0 p-0" 
          : "w-full flex flex-col bg-white border border-[#111111] shadow-sm select-none"
      }
    >
      {/* 1. Masthead Header Bar */}
      <div className="px-3 py-2.5 sm:px-4 bg-[#FAF8F3] border-b border-[#111111] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline font-black text-base sm:text-lg text-[#111111] tracking-tight">
                {cleanSymbol}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#111111] text-white">
                {market}
              </span>
              {isFullscreen && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-400 text-black border border-amber-500 animate-pulse">
                  FULLSCREEN FOCUS
                </span>
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono font-black text-base sm:text-lg text-[#111111]">
                  {currencySymbol}{Number(currentPrice).toFixed(2)}
                </span>
                <span className={`font-mono font-bold text-xs flex items-center ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isPositive ? '+' : ''}{Number(changeAbs).toFixed(2)} ({isPositive ? '+' : ''}{Number(changePct).toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="text-[11px] text-stone-500 font-sans truncate max-w-[280px] sm:max-w-md">
              {stockMeta.name || cleanSymbol} • First-Party Real-Time Canvas
            </div>
          </div>
        </div>

        {/* Real-Time Status Pill & Fullscreen Toggle Button */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 border text-[10px] font-bold px-2 py-1 uppercase tracking-wider ${quoteFreshness.badgeClass}`}>
            <Radio className={`w-3 h-3 ${quoteFreshness.isStale ? 'text-amber-600' : 'text-emerald-600 animate-pulse'}`} />
            <span className="hidden sm:inline">{quoteFreshness.label} • AS OF {quoteFreshness.asOf}</span>
            <span className="sm:hidden">{quoteFreshness.label}</span>
          </div>

          {/* Fullscreen Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`px-2.5 py-1 text-xs font-bold font-mono border flex items-center gap-1.5 transition-all cursor-pointer ${
              isFullscreen 
                ? 'bg-amber-400 hover:bg-amber-300 text-[#111111] border-amber-600 shadow-sm' 
                : 'bg-[#111111] hover:bg-neutral-800 text-[#F6F4EE] border-[#111111]'
            }`}
            title={isFullscreen ? "Exit Fullscreen Mode [ESC or F]" : "Fullscreen Chart Only [F]"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">EXIT FULLSCREEN</span>
                <span className="sm:hidden">EXIT</span>
                <kbd className="px-1 py-0.2 bg-black/20 text-black text-[9px] rounded font-mono">ESC</kbd>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">FULLSCREEN</span>
                <span className="sm:hidden">EXPAND</span>
                <kbd className="hidden md:inline px-1 py-0.2 bg-white/20 text-white text-[9px] rounded font-mono">F</kbd>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Interactive Navigation & Indicator Toolbar */}
      <div className="px-3 py-1.5 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: '1m', label: '1m', badge: '60m', title: '1-Minute Candles (Respective Last 60 Minutes)' },
            { id: '3m', label: '3m', badge: '3h', title: '3-Minute Candles (Respective Last 180 Minutes / 3 Hours)' },
            { id: '5m', label: '5m', badge: '5h', title: '5-Minute Candles (Respective Last 300 Minutes / 5 Hours)' },
            { id: '1D', label: '1D', badge: 'Day', title: 'Full Regular Trading Session (5-Minute Bars)' },
            { id: '1W', label: '1W', badge: '5D', title: '1-Week Hourly Overview' },
            { id: '1M', label: '1M', badge: '1M', title: '1-Month Daily Overview' },
            { id: '3M', label: '3M', badge: '3M', title: '3-Month Daily Overview' },
            { id: '1Y', label: '1Y', badge: '1Y', title: '1-Year Daily Overview' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setTimeframe(btn.id)}
              title={btn.title}
              className={`px-2 py-0.5 font-mono text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                timeframe === btn.id
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-[#FAF8F3] text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <span>{btn.label}</span>
              {['1m', '3m', '5m'].includes(btn.id) && (
                <span className={`text-[9px] px-1 py-0.2 rounded-xs font-semibold ${
                  timeframe === btn.id ? 'bg-stone-700 text-amber-300' : 'bg-stone-200 text-stone-600'
                }`}>
                  {btn.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Chart Style & Indicators */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Chart Type Toggle */}
          <div className="flex items-center border border-stone-300 overflow-hidden">
            <button
              onClick={() => setChartType('candles')}
              className={`px-2 py-0.5 flex items-center gap-1 text-[11px] font-medium transition-colors ${
                chartType === 'candles' ? 'bg-[#111111] text-white font-bold' : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
              title="Japanese Candlesticks"
            >
              <BarChart3 className="w-3 h-3" />
              <span>Candles</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-0.5 flex items-center gap-1 text-[11px] font-medium transition-colors ${
                chartType === 'area' ? 'bg-[#111111] text-white font-bold' : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
              title="Mountain / Area Line"
            >
              <LineChart className="w-3 h-3" />
              <span>Line</span>
            </button>
          </div>

          {/* Indicator Toggles */}
          <button
            onClick={() => toggleIndicator('volume')}
            className={`px-2 py-0.5 font-mono text-[11px] border transition-colors ${
              activeIndicators.volume
                ? 'bg-stone-800 text-white border-stone-800 font-bold'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
            }`}
          >
            VOL
          </button>
          <button
            onClick={() => toggleIndicator('sma')}
            className={`px-2 py-0.5 font-mono text-[11px] border transition-colors ${
              activeIndicators.sma
                ? 'bg-amber-600 text-white border-amber-600 font-bold'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
            }`}
            title="Simple Moving Average (20-period)"
          >
            SMA 20
          </button>
          <button
            onClick={() => toggleIndicator('ema')}
            className={`px-2 py-0.5 font-mono text-[11px] border transition-colors ${
              activeIndicators.ema
                ? 'bg-blue-600 text-white border-blue-600 font-bold'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
            }`}
            title="Exponential Moving Average (50-period)"
          >
            EMA 50
          </button>
          <button
            onClick={() => toggleIndicator('bb')}
            className={`px-2 py-0.5 font-mono text-[11px] border transition-colors ${
              activeIndicators.bb
                ? 'bg-purple-600 text-white border-purple-600 font-bold'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
            }`}
            title="Bollinger Bands (20, 2)"
          >
            BB
          </button>

          {/* Zoom & Fit Actions */}
          <div className="flex items-center gap-1 border-l border-stone-300 pl-1.5 ml-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 text-stone-700 hover:bg-stone-100 border border-stone-300"
              title="Zoom In (or use Mouse Wheel)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 text-stone-700 hover:bg-stone-100 border border-stone-300"
              title="Zoom Out (or use Mouse Wheel)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1 text-stone-700 hover:bg-stone-100 border border-stone-300 flex items-center gap-0.5 text-[10px] font-mono px-1.5"
              title="Reset Zoom to Fit All Data"
            >
              <RotateCcw className="w-3 h-3" />
              <span>FIT</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`p-1 border flex items-center gap-1 text-[10px] font-mono px-1.5 cursor-pointer transition-colors ${
                isFullscreen
                  ? 'bg-amber-400 text-black border-amber-600 hover:bg-amber-300 font-bold'
                  : 'text-stone-700 hover:bg-stone-100 border-stone-300'
              }`}
              title={isFullscreen ? "Exit Fullscreen [ESC or F]" : "Fullscreen Chart [F]"}
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span className="hidden sm:inline">{isFullscreen ? 'EXIT' : 'FULL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Live Crosshair Dynamic Metrics HUD Bar */}
      <div className="px-3 py-1.5 bg-[#FAF8F3] border-b border-stone-200 flex flex-wrap items-center justify-between text-[11px] font-mono text-stone-600 shrink-0 gap-2">
        {activeHud ? (
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <span className="text-stone-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-500 shrink-0" />
              <span>BAR:</span>
              <strong className="text-stone-900">{formatHudTime(activeHud.time, tzMeta, isIntraday)}</strong>
            </span>
            <span>
              O: <strong className="text-stone-900">{currencySymbol}{Number(activeHud.open ?? activeHud.close).toFixed(2)}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-700">{currencySymbol}{Number(activeHud.high ?? activeHud.close).toFixed(2)}</strong>
            </span>
            <span>
              L: <strong className="text-rose-700">{currencySymbol}{Number(activeHud.low ?? activeHud.close).toFixed(2)}</strong>
            </span>
            <span>
              C: <strong className="text-stone-900">{currencySymbol}{Number(activeHud.close).toFixed(2)}</strong>
            </span>
            {activeHud.volume != null && activeHud.volume > 0 && (
              <span className="hidden sm:inline">
                VOL: <strong className="text-stone-800">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(activeHud.volume)}</strong>
              </span>
            )}

            {/* Separate Last Bar Close & Current Live Quote when differing */}
            {lastCompletedClose != null && currentPrice != null && Math.abs(lastCompletedClose - currentPrice) >= 0.01 && (
              <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 bg-stone-100 border border-stone-300 text-[10px]">
                <span className="text-stone-500">BAR CLOSE:</span>
                <strong className="text-stone-900">{currencySymbol}{Number(lastCompletedClose).toFixed(2)}</strong>
                <span className="text-stone-300">|</span>
                <span className="text-stone-500">LIVE CMP:</span>
                <strong className="text-emerald-700">{currencySymbol}{Number(currentPrice).toFixed(2)}</strong>
              </span>
            )}

            {/* Window Span Identifier */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-900 text-white border border-neutral-900 text-[9px] uppercase font-bold tracking-wider">
              <span className="text-stone-400">WINDOW:</span>
              <strong className="text-amber-300">{windowMeta?.fullLabel || `${timeframe} VIEW`}</strong>
            </span>

            {/* Exchange Timezone Identifier */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-stone-300 text-[9px] uppercase font-bold tracking-wider text-stone-700">
              <span>TZ:</span>
              <strong className="text-stone-900">{tzMeta.timezone}</strong>
            </span>

            {/* Market Session Active/Closed Status */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider border ${
              isMarketClosed 
                ? 'bg-stone-100 border-stone-300 text-stone-700' 
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isMarketClosed ? 'bg-stone-400' : 'bg-emerald-600 animate-pulse'}`} />
              <span>{isMarketClosed ? 'MARKET CLOSED' : 'SESSION OPEN'}</span>
            </span>

            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider border ${quoteFreshness.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${quoteFreshness.isStale ? 'bg-amber-500' : 'bg-emerald-600 animate-pulse'}`} />
              <span>{quoteFreshness.label} ({quoteFreshness.asOf})</span>
            </span>
          </div>
        ) : (
          <div>Hover over chart to inspect candle coordinates</div>
        )}
        <div className="text-[10px] text-stone-400 font-sans hidden md:block">
          Click & Drag to Scroll • Wheel to Zoom • First-Party Canvas
        </div>
      </div>

      {/* 4. Canvas Chart Viewport (Responsive & Fullscreen Flexible Height) */}
      <div className={`w-full relative bg-white ${isFullscreen ? 'flex-1 min-h-0 h-full' : 'min-h-[380px] sm:min-h-[460px]'}`}>
        {loading && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mb-2" />
            <div className="text-xs font-mono font-bold text-[#111111]">SYNCHRONIZING CANVAS TICKS...</div>
          </div>
        )}

        {unavailableInfo && !loading && (
          <div className="absolute inset-0 bg-[#FAF8F3]/95 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center z-10 border border-[#111111] m-4">
            <div className="w-10 h-10 bg-amber-100 border-2 border-amber-600 text-amber-800 flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="font-headline font-black text-sm sm:text-base text-[#111111] uppercase tracking-wide">
              Intraday Data Unavailable ({timeframe})
            </h3>
            <p className="font-mono text-xs text-stone-600 max-w-md mt-1.5 mb-4 leading-relaxed">
              The exchange feed currently does not have {timeframe} interval records for {cleanSymbol}. Live order execution and ledger balances remain fully functional.
            </p>
            <button
              onClick={() => setTimeframe('1D')}
              className="px-3.5 py-1.5 bg-[#111111] text-[#F6F4EE] font-mono text-xs font-bold hover:bg-neutral-800 transition-colors border border-[#111111] flex items-center gap-1.5"
            >
              <span>Switch to 1D Overview</span>
            </button>
          </div>
        )}

        <div 
          ref={chartContainerRef} 
          className={`w-full ${isFullscreen ? 'h-full' : 'h-[380px] sm:h-[460px]'}`} 
        />
      </div>

      {/* 5. Footer Masthead Status Strip */}
      <div className="px-3 py-1.5 bg-[#FAF8F3] border-t border-[#111111] flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-600 font-sans shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-mono font-semibold">
            <Activity className="w-3 h-3 text-emerald-700" />
            <span>NATIVE 60FPS HARDWARE ACCELERATED RENDERER</span>
          </span>
          <span className="hidden sm:inline text-stone-300">|</span>
          <span className="hidden sm:inline text-stone-500 font-mono">
            EXCHANGE: {tzMeta.marketName} • TZ: {tzMeta.label} • TICK TIMEFRAME: {timeframe} ({windowMeta?.window || 'Last 60m'})
          </span>
        </div>
        <div className="flex items-center gap-2 text-stone-500 font-mono">
          {isFullscreen && (
            <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 border border-amber-300 text-[9px] uppercase tracking-wider">
              PRESS [ESC] OR CLICK EXIT TO LEAVE FULLSCREEN
            </span>
          )}
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
            <span>ZERO THIRD-PARTY EXTENSIONS • 100% PRIVATE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
