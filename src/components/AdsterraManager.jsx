import React, { useEffect } from 'react';
import { ADSTERRA_CONFIG } from '../config/adsterra';

/**
 * Adsterra Hybrid Monetization Orchestrator & Trading Shield
 * 
 * Manages multi-format monetization recommended by Adsterra:
 * - Popunder (Highest CPM revenue engine)
 * - Social Bar (In-page notification & engagement)
 * - Banner (Display ads on non-critical informational pages)
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

  // 2. Popunder Lifecycle Management
  useEffect(() => {
    const popunderConfig = ADSTERRA_CONFIG.formats.popunder;
    if (!popunderConfig.enabled || !popunderConfig.scriptUrl) return;

    const scriptId = 'adsterra-popunder-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.src = popunderConfig.scriptUrl;
    script.async = true;

    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  // 3. Social Bar Lifecycle Management
  useEffect(() => {
    const socialBarConfig = ADSTERRA_CONFIG.formats.socialBar;
    if (!socialBarConfig.enabled || !socialBarConfig.scriptUrl) return;

    const scriptId = 'adsterra-socialbar-script';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.src = socialBarConfig.scriptUrl;
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
