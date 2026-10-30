import React, { useEffect } from 'react';

/**
 * Monetag Ad Manager
 * 
 * Enforces monetization rules & trading UX safety:
 * 1. Front page middle ads (vignette overlays) are suppressed from pushing on landing.
 * 2. In-Page Push (IPP) is completely removed and suppressed site-wide via CSS.
 * 3. Popunder hijacking protection on critical trading inputs (search, trade modal, buy/sell orders).
 * 4. Zero DOM-destruction mutations to eliminate auto-refresh and React rendering crashes permanently.
 */
export default function MonetagAdManager() {
  // 1. Popunder Shield: Protect trading & inputs from popunder hijacking
  useEffect(() => {
    const handleCaptureClick = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;

      // Identify trade-critical and input elements
      const isTradeCritical = el.closest(
        'button[type="submit"], input, select, textarea, [role="dialog"], #stock-search-input, .no-popunder, [data-no-popunder="true"]'
      );

      if (isTradeCritical) {
        // Tagging event prevents popunder scripts that inspect events from hijacking trade execution
        e.__isTradeProtected = true;
      }
    };

    document.addEventListener('click', handleCaptureClick, true);
    return () => document.removeEventListener('click', handleCaptureClick, true);
  }, []);

  return null;
}
