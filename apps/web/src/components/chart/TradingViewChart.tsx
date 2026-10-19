import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, Time } from 'lightweight-charts';
import { HistoricalCandle } from '@globaltrade/shared';
import { TechnicalIndicators } from '@globaltrade/trading-engine';
import { Layers, Activity } from 'lucide-react';

interface TradingViewChartProps {
  candles: HistoricalCandle[];
  symbol: string;
  interval?: string;
  height?: number;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  candles,
  symbol,
  height = 420
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  // Indicator series refs
  const smaSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeries = useRef<ISeriesApi<'Line'> | null>(null);

  // Indicator toggles
  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showBB, setShowBB] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: '#070A0F' },
        textColor: '#627284'
      },
      grid: {
        vertLines: { color: 'rgba(27, 34, 45, 0.4)' },
        horzLines: { color: 'rgba(27, 34, 45, 0.4)' }
      },
      crosshair: {
        vertLine: { color: '#CCFF00', width: 1, style: 3 },
        horzLine: { color: '#CCFF00', width: 1, style: 3 }
      },
      timeScale: {
        borderColor: '#1B222D',
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: '#1B222D',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      }
    });

    chartInstance.current = chart;

    // Candlesticks with neon lime bullish bars
    const series = chart.addCandlestickSeries({
      upColor: '#CCFF00',
      downColor: '#FF4D4D',
      borderVisible: false,
      wickUpColor: '#CCFF00',
      wickDownColor: '#FF4D4D'
    });
    candleSeries.current = series;

    // SMA 20 (Amber)
    const sma = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 2,
      title: 'SMA 20'
    });
    smaSeries.current = sma;

    // EMA 50 (Blue)
    const ema = chart.addLineSeries({
      color: '#38BDF8',
      lineWidth: 2,
      title: 'EMA 50'
    });
    emaSeries.current = ema;

    // VWAP (Purple)
    const vwap = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 2,
      title: 'VWAP'
    });
    vwapSeries.current = vwap;

    // Bollinger Bands Upper & Lower (Cyan dotted)
    const bbUpper = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      lineStyle: 2,
      title: 'BB Upper'
    });
    bbUpperSeries.current = bbUpper;

    const bbLower = chart.addLineSeries({
      color: '#06B6D4',
      lineWidth: 1,
      lineStyle: 2,
      title: 'BB Lower'
    });
    bbLowerSeries.current = bbLower;

    // Handle container resize
    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
    };
  }, [height]);

  // Update chart data whenever candles or indicator states change
  useEffect(() => {
    if (!candleSeries.current || !candles || candles.length === 0) return;

    const formattedCandles: CandlestickData<Time>[] = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    candleSeries.current.setData(formattedCandles);

    const closes = candles.map(c => c.close);

    // 1. SMA 20
    if (smaSeries.current) {
      if (showSMA && candles.length >= 20) {
        const smaVals = TechnicalIndicators.calculateSMA(closes, 20);
        const smaData: LineData<Time>[] = [];
        for (let i = 19; i < candles.length; i++) {
          smaData.push({ time: candles[i].time as Time, value: smaVals[i] });
        }
        smaSeries.current.setData(smaData);
        smaSeries.current.applyOptions({ visible: true });
      } else {
        smaSeries.current.applyOptions({ visible: false });
      }
    }

    // 2. EMA 50
    if (emaSeries.current) {
      if (showEMA && candles.length >= 20) {
        const emaPeriod = Math.min(50, Math.floor(candles.length / 2));
        const emaVals = TechnicalIndicators.calculateEMA(closes, emaPeriod);
        const emaData: LineData<Time>[] = [];
        for (let i = emaPeriod - 1; i < candles.length; i++) {
          emaData.push({ time: candles[i].time as Time, value: emaVals[i] });
        }
        emaSeries.current.setData(emaData);
        emaSeries.current.applyOptions({ visible: true });
      } else {
        emaSeries.current.applyOptions({ visible: false });
      }
    }

    // 3. VWAP
    if (vwapSeries.current) {
      if (showVWAP && candles.length > 0) {
        const vwapVals = TechnicalIndicators.calculateVWAP(candles);
        const vwapData: LineData<Time>[] = candles.map((c, idx) => ({
          time: c.time as Time,
          value: vwapVals[idx]
        }));
        vwapSeries.current.setData(vwapData);
        vwapSeries.current.applyOptions({ visible: true });
      } else {
        vwapSeries.current.applyOptions({ visible: false });
      }
    }

    // 4. Bollinger Bands (20, 2)
    if (bbUpperSeries.current && bbLowerSeries.current) {
      if (showBB && candles.length >= 20) {
        const bb = TechnicalIndicators.calculateBollingerBands(closes, 20, 2);
        const upperData: LineData<Time>[] = [];
        const lowerData: LineData<Time>[] = [];
        for (let i = 19; i < candles.length; i++) {
          upperData.push({ time: candles[i].time as Time, value: bb.upper[i] });
          lowerData.push({ time: candles[i].time as Time, value: bb.lower[i] });
        }
        bbUpperSeries.current.setData(upperData);
        bbLowerSeries.current.setData(lowerData);
        bbUpperSeries.current.applyOptions({ visible: true });
        bbLowerSeries.current.applyOptions({ visible: true });
      } else {
        bbUpperSeries.current.applyOptions({ visible: false });
        bbLowerSeries.current.applyOptions({ visible: false });
      }
    }

    if (chartInstance.current) {
      chartInstance.current.timeScale().fitContent();
    }
  }, [candles, showSMA, showEMA, showVWAP, showBB]);

  return (
    <div className="bg-[#0B0F14] border border-[#1B222D] rounded-3xl overflow-hidden shadow-xl">
      {/* Chart toolbar with technical indicators */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#1B222D] bg-[#10151C]/60">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-white tracking-wide">{symbol}</span>
          <span className="text-[11px] text-slate-400 font-mono">Candlestick • Multi-Indicator Suite</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowSMA(!showSMA)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              showSMA
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Simple Moving Average (20-day)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SMA 20</span>
          </button>

          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              showEMA
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Exponential Moving Average (50-day)"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>EMA 50</span>
          </button>

          <button
            onClick={() => setShowVWAP(!showVWAP)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              showVWAP
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Volume Weighted Average Price"
          >
            <span>VWAP</span>
          </button>

          <button
            onClick={() => setShowBB(!showBB)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              showBB
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Bollinger Bands (20, 2)"
          >
            <span>BB (20, 2)</span>
          </button>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full relative" />
    </div>
  );
};
