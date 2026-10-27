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
import { calculateSMA, calculateEMA, calculateBollingerBands } from '../lib/indicators';
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
  Activity
} from 'lucide-react';

/**
 * Format timestamp or date string for HUD
 */
function formatHudTime(rawTime) {
  if (!rawTime) return '';
  if (typeof rawTime === 'number') {
    const d = new Date(rawTime * 1000);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
  onToggleIndicator: parentOnToggle
}) {
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

  // Chart Configuration State
  const [timeframe, setTimeframe] = useState('1D'); // '1D' | '1W' | '1M' | '3M' | '1Y'
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'area'
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
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
          const rawCandles = Array.isArray(data) ? data : data?.candles || [];
          
          // Ensure candles are sorted strictly by ascending time with no duplicates
          const seenTimes = new Set();
          const validCandles = [];
          for (const c of rawCandles) {
            if (c && c.time != null && !seenTimes.has(c.time)) {
              seenTimes.add(c.time);
              validCandles.push({
                time: c.time,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume || 0),
              });
            }
          }

          validCandles.sort((a, b) => {
            if (typeof a.time === 'number' && typeof b.time === 'number') {
              return a.time - b.time;
            }
            return String(a.time).localeCompare(String(b.time));
          });

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
  }, [symbol, timeframe]);

  // 2. Subscribe to real-time price stream from OmniFeed
  useEffect(() => {
    const unsubscribe = subscribeToMarketStream(({ prices }) => {
      const live = prices[symbol];
      if (live && live.price) {
        setQuoteData((prev) => ({ ...prev, ...live }));

        // Dynamically update latest candle on the chart without stale closure
        const currentCandles = candlesRef.current;
        if (candleSeriesRef.current && currentCandles.length > 0) {
          const last = currentCandles[currentCandles.length - 1];
          const newClose = Number(live.price);
          const updatedLast = {
            time: last.time,
            open: last.open,
            high: Math.max(last.high, newClose),
            low: Math.min(last.low, newClose),
            close: newClose,
            volume: last.volume || 1000,
          };

          try {
            if (chartType === 'candles' && candleSeriesRef.current) {
              candleSeriesRef.current.update(updatedLast);
            } else if (chartType === 'area' && areaSeriesRef.current) {
              areaSeriesRef.current.update({ time: last.time, value: newClose });
            }
          } catch {
            // Safe fallback if series was disposed
          }
        }
      }
    });

    return () => unsubscribe();
  }, [symbol, chartType]);

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
    const isIntraday = timeframe === '1D' || timeframe === '1W';

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: 480,
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
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
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
  }, [candles, chartType, activeIndicators, timeframe]);

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

  return (
    <div className="w-full flex flex-col bg-white border border-[#111111] shadow-sm select-none">
      {/* 1. Masthead Header Bar */}
      <div className="px-3 py-2.5 sm:px-4 bg-[#FAF8F3] border-b border-[#111111] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline font-black text-base sm:text-lg text-[#111111] tracking-tight">
                {cleanSymbol}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#111111] text-white">
                {market}
              </span>
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

        {/* Real-Time Status Pill */}
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wider">
          <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
          <span>Real-Time Engine • 0ms Native Feed</span>
        </div>
      </div>

      {/* 2. Interactive Navigation & Indicator Toolbar */}
      <div className="px-3 py-1.5 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1">
          {['1D', '1W', '1M', '3M', '1Y'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 font-mono text-[11px] font-bold border transition-colors ${
                timeframe === tf
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-[#FAF8F3] text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              {tf}
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
          </div>
        </div>
      </div>

      {/* 3. Live Crosshair Dynamic Metrics HUD Bar */}
      <div className="px-3 py-1 bg-[#FAF8F3] border-b border-stone-200 flex flex-wrap items-center justify-between text-[11px] font-mono text-stone-600">
        {activeHud ? (
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="text-stone-400">
              TIME: <strong className="text-stone-800">{formatHudTime(activeHud.time)}</strong>
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
          </div>
        ) : (
          <div>Hover over chart to inspect candle coordinates</div>
        )}
        <div className="text-[10px] text-stone-400 font-sans hidden md:block">
          Click & Drag to Scroll • Wheel to Zoom • First-Party Canvas
        </div>
      </div>

      {/* 4. Canvas Chart Viewport */}
      <div className="w-full relative min-h-[460px] bg-white">
        {loading && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mb-2" />
            <div className="text-xs font-mono font-bold text-[#111111]">SYNCHRONIZING CANVAS TICKS...</div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-[460px]" />
      </div>

      {/* 5. Footer Masthead Status Strip */}
      <div className="px-3 py-1.5 bg-[#FAF8F3] border-t border-[#111111] flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-600 font-sans">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-mono font-semibold">
            <Activity className="w-3 h-3 text-emerald-700" />
            <span>NATIVE 60FPS HARDWARE ACCELERATED RENDERER</span>
          </span>
          <span className="hidden sm:inline text-stone-300">|</span>
          <span className="hidden sm:inline text-stone-500 font-mono">
            TICK TIMEFRAME: {timeframe}
          </span>
        </div>
        <div className="flex items-center gap-1 text-stone-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
          <span>ZERO THIRD-PARTY EXTENSIONS • 100% PRIVATE & UNRESTRICTED</span>
        </div>
      </div>
    </div>
  );
}
