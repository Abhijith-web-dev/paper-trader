import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ADSTERRA_CONFIG } from '../config/adsterra';

/**
 * Adsterra Hybrid Monetization Orchestrator & Trading Shield
 * 
 * Rules:
 * 1. ZERO Popunders / Click-to-open screen ads: Permanently disabled across entire site.
 * 2. Dedicated, non-intrusive broadside banner ads in Dashboard, TradingView, HomePage, and GuidePage.
 * 3. Notification-mode ads (Social Bar) strictly suppressed on all trading routes (/dashboard, /stock/*, etc.).
 * 4. Trading controls (Buy/Sell, order slips, charts, search) are fully protected.
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

  // Purge any popunder scripts, adult push notifications, or click-screen ad tags from DOM
  useEffect(() => {
    const popunderScript = document.getElementById('adsterra-popunder-script');
    if (popunderScript) popunderScript.remove();

    const socialbarScript = document.getElementById('adsterra-socialbar-script');
    if (socialbarScript) socialbarScript.remove();

    // Remove any script elements pointing to abscloud.org (popunder) or adult social bars
    const lingeringPopunders = document.querySelectorAll('script[src*="abscloud.org"], script[src*="fe7abb4b849d2618628b74d2fbb658ec"]');
    lingeringPopunders.forEach((el) => el.remove());
  }, []);

  // Route-aware CSS marker for complete notification suppression on trading pages
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

  // Trading Form & Interaction Click Shield
  useEffect(() => {
    const handleCaptureClick = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;

      const isTradeCritical = isTradingRoute || el.closest(
        'button[type="submit"], button[data-action="buy"], button[data-action="sell"], input, select, textarea, [role="dialog"], #stock-search-input, .no-popunder, [data-no-popunder="true"], .tradingview-widget-container, canvas'
      );

      if (isTradeCritical) {
        e.__isTradeProtected = true;
      }
    };

    document.addEventListener('click', handleCaptureClick, true);
    return () => document.removeEventListener('click', handleCaptureClick, true);
  }, [isTradingRoute]);

  // Social Bar Lifecycle Management (Only on Non-Trading Pages - Never in Dashboard or TradingView)
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
