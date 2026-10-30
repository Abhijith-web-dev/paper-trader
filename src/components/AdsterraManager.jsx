import React, { useEffect } from 'react';
import { ADSTERRA_CONFIG } from '../config/adsterra';

/**
 * Adsterra Hybrid Monetization Orchestrator & Trading Shield
 * 
 * Manages active multi-format monetization for paper-trader-001.web.app:
 * 1. Popunder: https://abscloud.org/1/d558b6a9096b6007a50019663f7969c3 (High-CPM Revenue Driver)
 * 2. Social Bar: https://bauval.org/14/fe7abb4b849d2618628b74d2fbb658ec (Dynamic In-Page Push)
 * 3. Banners: Broadsheet photo-plate slots with bauval.org ad delivery
 * 
 * CORE TRADING PROTECTION:
 * Ensures popunders and ad overlays NEVER trigger on trading operations:
 * - Buy / Sell execution buttons
 * - Limit & Market order inputs
 * - Stock search and symbol selection
 * - Interactive TradingView chart canvas
 * - Ledger journal & transaction actions
 */
export default function AdsterraManager({ 
  placementId = ADSTERRA_CONFIG.defaultPlacementId,
  adKey = ADSTERRA_CONFIG.defaultHashKey 
}) {
  // 1. Trading Form & Interaction Click Shield
  useEffect(() => {
    const handleCaptureClick = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;

      const isTradeCritical = el.closest(
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
  }, []);

  // 2. Popunder Lifecycle Management (abscloud.org)
  useEffect(() => {
    const popunderConfig = ADSTERRA_CONFIG.formats.popunder;
    if (!popunderConfig.enabled || !popunderConfig.scriptUrl) return;

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
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  // 3. Social Bar Lifecycle Management (bauval.org)
  useEffect(() => {
    const socialBarConfig = ADSTERRA_CONFIG.formats.socialBar;
    if (!socialBarConfig.enabled || !socialBarConfig.scriptUrl) return;

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
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  return null;
}
