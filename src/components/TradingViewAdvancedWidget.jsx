import React, { useEffect, useRef, useState } from 'react';

/**
 * Resolves any stock symbol to TradingView's official exchange ticker
 */
export function resolveTradingViewTicker(rawSymbol) {
  if (!rawSymbol) return 'NASDAQ:AAPL';
  const sym = rawSymbol.toUpperCase().trim();

  // Indian Equities (NSE & BSE)
  if (sym.endsWith('.NS')) {
    return `NSE:${sym.replace('.NS', '')}`;
  }
  if (sym.endsWith('.BO')) {
    return `BSE:${sym.replace('.BO', '')}`;
  }

  // Major US Indices & NYSE Equities
  if (sym === 'SPY') return 'AMEX:SPY';
  if (sym === 'QQQ') return 'NASDAQ:QQQ';
  if (sym === 'DIA') return 'AMEX:DIA';
  if (['IBM', 'DIS', 'JNJ', 'PFE', 'BA', 'KO', 'NKE', 'WMT', 'JPM', 'GS', 'XOM', 'CVX'].includes(sym)) {
    return `NYSE:${sym}`;
  }

  // Crypto Pairs
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL')) {
    return `BINANCE:${sym.replace('/', '')}`;
  }

  // Forex Pairs
  if (sym.includes('/') || (sym.length === 6 && ['EURUSD', 'GBPUSD', 'USDJPY', 'USDINR'].includes(sym))) {
    return `FX:${sym.replace('/', '')}`;
  }

  // Default to NASDAQ for US Equities
  return `NASDAQ:${sym}`;
}

/**
 * 100% Free Official TradingView Real-Time Chart Widget
 * Zero Backend • Zero Server Cost • Zero Subscription Fees
 * 
 * Configured strictly with standard free-tier options:
 * details: false, hotlist: false, calendar: false
 * (Prevents the "This view is not available" restricted partner notification)
 */
export default function TradingViewAdvancedWidget({ 
  symbol = 'AAPL', 
  height = 480,
  theme = 'light' 
}) {
  const containerRef = useRef(null);
  const containerIdRef = useRef(`tv_chart_${Math.random().toString(36).substring(2, 9)}`);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const tvTicker = resolveTradingViewTicker(symbol);
  const isIndian = symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO');
  const timezone = isIndian ? 'Asia/Kolkata' : 'America/New_York';

  // 1. Load official TradingView tv.js script once globally
  useEffect(() => {
    if (window.TradingView) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById('tradingview-widget-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      existingScript.addEventListener('error', () => setHasError(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'tradingview-widget-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setHasError(true);
    document.head.appendChild(script);
  }, []);

  // 2. Instantiate Widget using 100% Free Public Configuration
  useEffect(() => {
    if (!scriptLoaded || hasError || !containerRef.current || !window.TradingView) return;

    const container = containerRef.current;
    container.innerHTML = `<div id="${containerIdRef.current}" style="width: 100%; height: 100%;"></div>`;

    try {
      new window.TradingView.widget({
        autosize: true,
        symbol: tvTicker,
        interval: 'D',
        timezone: timezone,
        theme: theme,
        style: '1', // Japanese Candlesticks
        locale: 'en',
        toolbar_bg: '#FFFFFF',
        enable_publishing: false,
        allow_symbol_change: true,
        save_image: false,
        container_id: containerIdRef.current,
        hide_side_toolbar: false,
        withdateranges: true,
        hide_legend: false,
        
        // STRICTLY FALSE: These 3 properties cause "This view is not available" if true!
        details: false,
        hotlist: false,
        calendar: false,

        studies: [
          'STD;SMA',
          'STD;EMA',
          'STD;Bollinger_Bands',
          'STD;RSI'
        ],
        disabled_features: [
          'header_symbol_search',
        ],
        enabled_features: [
          'use_localstorage_for_settings',
          'volume_force_overlay'
        ]
      });
    } catch (e) {
      console.warn('TradingView initialization caught:', e);
      setHasError(true);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [scriptLoaded, hasError, tvTicker, theme, timezone]);

  // Fallback: If tv.js is blocked by an adblocker, load the official clean embed iframe
  if (hasError) {
    const embedUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvTicker)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=FFFFFF&studies=%5B%22STD%3BSMA%22%2C%22STD%3BBollinger_Bands%22%5D&theme=${theme}&style=1&timezone=${encodeURIComponent(timezone)}&locale=en`;

    return (
      <div className="w-full relative bg-white border border-stone-200" style={{ height: `${height}px` }}>
        <iframe
          src={embedUrl}
          title={`TradingView Chart for ${symbol}`}
          className="w-full h-full border-0 block"
          allowTransparency={true}
          scrolling="no"
          allowFullScreen={true}
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full relative bg-white" 
      style={{ height: `${height}px` }}
    >
      {!scriptLoaded && (
        <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 font-mono text-xs text-[#111111]">
            <span className="w-3 h-3 border-2 border-[#111111] border-t-transparent rounded-full animate-spin"></span>
            <span>Connecting to official exchange live feed...</span>
          </div>
        </div>
      )}
    </div>
  );
}
