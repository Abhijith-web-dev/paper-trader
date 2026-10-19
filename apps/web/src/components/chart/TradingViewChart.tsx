import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, Time } from 'lightweight-charts';
import { HistoricalCandle } from '@globaltrade/shared';
import { BarChart3, LineChart, Layers } from 'lucide-react';

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
  const smaSeries = useRef<ISeriesApi<'Line'> | null>(null);

  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [showSMA, setShowSMA] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up old instance if exists
    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: '#0A121E' },
        textColor: '#94A3B8'
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' }
      },
      crosshair: {
        vertLine: { color: '#38BDF8', width: 1, style: 3 },
        horzLine: { color: '#38BDF8', width: 1, style: 3 }
      },
      timeScale: {
        borderColor: '#1E293B',
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: '#1E293B',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      }
    });

    chartInstance.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444'
    });
    candleSeries.current = series;

    const sma = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 2,
      title: 'SMA 20'
    });
    smaSeries.current = sma;

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

  // Update chart data whenever candles or toggles change
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

    // Calculate SMA 20
    if (smaSeries.current) {
      if (showSMA && candles.length >= 20) {
        const smaData: LineData<Time>[] = [];
        for (let i = 19; i < candles.length; i++) {
          let sum = 0;
          for (let j = 0; j < 20; j++) {
            sum += candles[i - j].close;
          }
          smaData.push({
            time: candles[i].time as Time,
            value: Number((sum / 20).toFixed(2))
          });
        }
        smaSeries.current.setData(smaData);
        smaSeries.current.applyOptions({ visible: true });
      } else {
        smaSeries.current.applyOptions({ visible: false });
      }
    }

    if (chartInstance.current) {
      chartInstance.current.timeScale().fitContent();
    }
  }, [candles, showSMA]);

  return (
    <div className="bg-navy-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Chart toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-850/50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white tracking-wide">{symbol}</span>
          <span className="text-[11px] text-slate-400 font-mono">Candlestick • 1D</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSMA(!showSMA)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              showSMA
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Toggle SMA 20"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SMA 20</span>
          </button>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full relative" />
    </div>
  );
};
