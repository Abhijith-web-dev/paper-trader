import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  ColorType, 
  CrosshairMode,
  createSeriesMarkers
} from 'lightweight-charts';
import { Play, Pause, RotateCcw, SkipForward, SkipBack, Sparkles, TrendingUp, TrendingDown, Eye, Gauge } from 'lucide-react';
import { detectCandlePatterns } from '../lib/patternRecognition';

export default function BacktestReplayChart({ candles = [], trades = [], initialCapital = 100000, currencySymbol = '$' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersPrimitiveRef = useRef(null);
  const timerRef = useRef(null);

  // Start replay from at least 25 candles in so indicators/patterns have context
  const startIndex = Math.min(25, Math.floor(candles.length / 3));
  const [replayIndex, setReplayIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(500); // 500ms per bar

  // Calculate patterns at current candle
  const activePatterns = useMemo(() => {
    return detectCandlePatterns(candles, replayIndex);
  }, [candles, replayIndex]);

  // Current bar
  const currentBar = candles[replayIndex] || candles[candles.length - 1];

  // Active trade status at current replay index
  const { currentPosition, activeTrade } = useMemo(() => {
    if (!currentBar) return { currentPosition: null, activeTrade: null };

    // Find if current bar falls within any trade
    for (const t of trades) {
      if (t.entryTime <= currentBar.time && t.exitTime >= currentBar.time) {
        const unrealizedPnl = (currentBar.close - t.entryPrice) * t.qty;
        const unrealizedPct = ((currentBar.close - t.entryPrice) / t.entryPrice) * 100;
        return {
          currentPosition: {
            type: t.type,
            qty: t.qty,
            entryPrice: t.entryPrice,
            unrealizedPnl,
            unrealizedPct,
          },
          activeTrade: t,
        };
      }
    }
    return { currentPosition: null, activeTrade: null };
  }, [currentBar, trades]);

  // Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const isIntraday = typeof candles[0]?.time === 'number';

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#57534E',
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#F3EFE6' },
        horzLines: { color: '#F3EFE6' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#DCD6C8',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#DCD6C8',
        timeVisible: isIntraday,
      },
    });

    chartRef.current = chart;

    const mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#059669',
      downColor: '#DC2626',
      borderVisible: false,
      wickUpColor: '#059669',
      wickDownColor: '#DC2626',
    });
    seriesRef.current = mainSeries;

    // Initialize series markers primitive
    try {
      markersPrimitiveRef.current = createSeriesMarkers(mainSeries, []);
    } catch {
      // fallback
    }

    // Set initial visible slice
    const initialSlice = candles.slice(0, Math.min(candles.length, 25));
    mainSeries.setData(initialSlice);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 320,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles]);

  // Update chart data and trade markers as replayIndex changes
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const currentSlice = candles.slice(0, replayIndex + 1);
    seriesRef.current.setData(currentSlice);

    // Filter trades that have occurred up to current replay bar
    const currentTime = currentSlice[currentSlice.length - 1]?.time;
    if (currentTime && markersPrimitiveRef.current) {
      const markers = [];

      for (const t of trades) {
        if (t.entryTime <= currentTime) {
          markers.push({
            time: t.entryTime,
            position: 'belowBar',
            color: '#059669',
            shape: 'arrowUp',
            text: `BUY @ ${currencySymbol}${t.entryPrice}`,
          });
        }
        if (t.exitTime <= currentTime) {
          markers.push({
            time: t.exitTime,
            position: 'aboveBar',
            color: '#DC2626',
            shape: 'arrowDown',
            text: `SELL (${t.pnl >= 0 ? '+' : ''}${currencySymbol}${t.pnl})`,
          });
        }
      }

      markersPrimitiveRef.current.setMarkers(markers);
    }
  }, [replayIndex, candles, trades, currencySymbol]);

  // Auto-play timer loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= candles.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speedMs, candles.length]);

  const handleStepForward = () => {
    setIsPlaying(false);
    if (replayIndex < candles.length - 1) {
      setReplayIndex(replayIndex + 1);
    }
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    if (replayIndex > startIndex) {
      setReplayIndex(replayIndex - 1);
    }
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setReplayIndex(startIndex);
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Replay Controls & Date Navigator Bar */}
      <div className="p-3 bg-neutral-100 border border-[#111111] flex flex-wrap items-center justify-between gap-3">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold border border-[#111111] transition-colors ${
              isPlaying
                ? 'bg-amber-400 text-black hover:bg-amber-500'
                : 'bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Auto Play</span>
              </>
            )}
          </button>

          <button
            onClick={handleStepBack}
            disabled={replayIndex <= startIndex}
            className="p-1.5 bg-white border border-[#111111] hover:bg-neutral-200 disabled:opacity-40"
            title="Step Back 1 Candle"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleStepForward}
            disabled={replayIndex >= candles.length - 1}
            className="p-1.5 bg-white border border-[#111111] hover:bg-neutral-200 disabled:opacity-40"
            title="Step Forward 1 Candle"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRestart}
            className="p-1.5 bg-white border border-[#111111] hover:bg-neutral-200"
            title="Restart Replay from Beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-500 uppercase font-bold mr-1">Speed:</span>
          {[
            { label: '1x', ms: 750 },
            { label: '2x', ms: 350 },
            { label: '4x', ms: 120 },
          ].map((sp) => (
            <button
              key={sp.label}
              onClick={() => setSpeedMs(sp.ms)}
              className={`px-2 py-0.5 text-[11px] font-bold border border-[#111111] ${
                speedMs === sp.ms ? 'bg-[#111111] text-white' : 'bg-white hover:bg-neutral-200'
              }`}
            >
              {sp.label}
            </button>
          ))}
        </div>

        {/* Date / Candle Position Scrubber */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[10px] text-neutral-500 uppercase whitespace-nowrap">
            Bar {replayIndex + 1}/{candles.length}:
          </span>
          <input
            type="range"
            min={startIndex}
            max={candles.length - 1}
            value={replayIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setReplayIndex(Number(e.target.value));
            }}
            className="w-full accent-[#111111] cursor-pointer"
          />
          <span className="font-bold text-[11px] bg-white px-2 py-0.5 border border-neutral-300 whitespace-nowrap">
            {String(currentBar?.time || '—')}
          </span>
        </div>
      </div>

      {/* Candlestick Replay Canvas */}
      <div className="border border-[#111111] bg-white relative">
        <div ref={chartContainerRef} className="w-full h-[320px]" />

        {/* Current Replay Status Strip Overlay */}
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2 pointer-events-none">
          <div className="px-2 py-1 bg-white/95 border border-[#111111] shadow-xs text-[11px]">
            <span className="text-neutral-500">Date: </span>
            <strong>{String(currentBar?.time)}</strong> •{' '}
            <span className="text-neutral-500">Close: </span>
            <strong>{currencySymbol}{currentBar?.close}</strong>
          </div>

          {currentPosition ? (
            <div className="px-2 py-1 bg-emerald-50/95 border border-emerald-600 shadow-xs text-[11px] text-emerald-900">
              <span className="font-bold">IN POSITION: </span>
              {currentPosition.qty} shares @ {currencySymbol}{currentPosition.entryPrice} •{' '}
              <span className="font-bold">
                Unrealized: {currentPosition.unrealizedPnl >= 0 ? '+' : ''}
                {currencySymbol}{currentPosition.unrealizedPnl.toFixed(2)} ({currentPosition.unrealizedPct.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <div className="px-2 py-1 bg-neutral-100/90 border border-neutral-400 text-neutral-600 text-[11px]">
              Status: <strong>IN CASH</strong> (Waiting for Strategy Trigger)
            </div>
          )}
        </div>
      </div>

      {/* Pattern Recognition & Live Signal Inspector */}
      <div className="p-3 bg-white border border-[#111111] space-y-2">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
          <div className="flex items-center gap-1.5 font-bold uppercase text-xs text-[#111111]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Candlestick Pattern & Market Structure Detector</span>
          </div>
          <span className="text-[10px] text-neutral-500 font-sans">
            Evaluates current bar vs preceding price action
          </span>
        </div>

        {activePatterns.length === 0 ? (
          <div className="p-2.5 bg-neutral-50 border border-neutral-200 text-neutral-500 text-center">
            No distinct classic reversal pattern on this bar (Normal Continuation).
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activePatterns.map((p, idx) => (
              <div
                key={idx}
                className={`p-2.5 border-l-4 border ${
                  p.type === 'BULLISH'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950'
                    : p.type === 'BEARISH'
                    ? 'border-rose-600 bg-rose-50/80 text-rose-950'
                    : 'border-amber-500 bg-amber-50/80 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1">
                    {p.type === 'BULLISH' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    ) : p.type === 'BEARISH' ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-700" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    {p.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/80 border border-current">
                    {p.confidence}% Confidence
                  </span>
                </div>
                <p className="text-[11px] font-sans leading-relaxed opacity-90">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
