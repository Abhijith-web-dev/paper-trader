import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ADSTERRA_CONFIG } from '../config/adsterra';

/**
 * Adsterra Hybrid Monetization Orchestrator & Trading Shield
 * 
 * Manages active multi-format monetization for paper-trader-001.web.app:
 * 1. Popunder: https://abscloud.org/1/d558b6a9096b6007a50019663f7969c3 (High-CPM Revenue Driver on public routes)
 * 2. Social Bar: https://bauval.org/14/fe7abb4b849d2618628b74d2fbb658ec (In-page push notification on public routes)
 * 3. Banners: Dedicated, non-intrusive broadside banner ads in Dashboard and TradingView views
 * 
 * CORE TRADING PROTECTION:
 * - On /dashboard, /stock/:symbol, and trading terminals:
 *   Notification mode (Social Bar) and Popunder are strictly SUPPRESSED.
 *   Only clean broadside banners are rendered.
 * - All order tickets, Buy/Sell buttons, search inputs, and TradingView chart canvas
 *   are fully protected against click interception.
 */
export default function AdsterraManager({ 
  placementId = ADSTERRA_CONFIG.defaultPlacementId,
  adKey = ADSTERRA_CONFIG.defaultHashKey 
}) {
  const location = useLocation();
  const pathname = location?.pathname || '';
  
  // Route check for active trading workspace
  const isTradingRoute = [
    '/dashboard', 
    '/journal', 
    '/screener', 
    '/transactions', 
    '/backtest'
  ].includes(pathname) || pathname.startsWith('/stock');

  // Route-aware CSS marker for complete notification suppression
  useEffect(() => {
    if (isTradingRoute) {
      document.body.classList.add('trading-terminal-active');
    } else {
      document.body.classList.remove('trading-terminal-active');
    }
    return () => {
      document.body.classList.remove('trading-terminal-active');
    };
  }, [isTradingRoute]);

  // 1. Trading Form & Interaction Click Shield
  useEffect(() => {
    const handleCaptureClick = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;

      const isTradeCritical = isTradingRoute || el.closest(
        'button[type="submit"], button[data-action="buy"], button[data-action="sell"], input, select, textarea, [role="dialog"], #stock-search-input, .no-popunder, [data-no-popunder="true"], .tradingview-widget-container, canvas'
      );

      if (isTradeCritical) {
        // Tag event and suppress propagation to background ad listeners
        e.__isTradeProtected = true;
        if (ADSTERRA_CONFIG.formats.popunder.protectTradingAreas) {
          e.stopPropagation();
        }
      }
    };

    // Attach in capture phase before third-party vendor listeners can intercept
    document.addEventListener('click', handleCaptureClick, true);
    return () => document.removeEventListener('click', handleCaptureClick, true);
  }, [isTradingRoute]);

  // 2. Popunder Lifecycle Management (Only on Non-Trading Pages)
  useEffect(() => {
    const popunderConfig = ADSTERRA_CONFIG.formats.popunder;
    if (!popunderConfig.enabled || !popunderConfig.scriptUrl || isTradingRoute) {
      const existing = document.getElementById('adsterra-popunder-script');
      if (existing) existing.remove();
      return;
    }

    const scriptId = 'adsterra-popunder-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.src = popunderConfig.scriptUrl;
    script.setAttribute('data-cfasync', 'false');
    script.async = true;

    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, [isTradingRoute]);

  // 3. Social Bar Lifecycle Management (Only on Non-Trading Pages - Never in Dashboard or TradingView)
  useEffect(() => {
    const socialBarConfig = ADSTERRA_CONFIG.formats.socialBar;
    if (!socialBarConfig.enabled || !socialBarConfig.scriptUrl || isTradingRoute) {
      const existing = document.getElementById('adsterra-socialbar-script');
      if (existing) existing.remove();
      return;
    }

    const scriptId = 'adsterra-socialbar-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.src = socialBarConfig.scriptUrl;
    script.setAttribute('data-cfasync', 'false');
    script.async = true;

    document.body.appendChild(script);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, [isTradingRoute]);

  return null;
}
