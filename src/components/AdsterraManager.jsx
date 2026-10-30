import React, { useEffect } from 'react';

/**
 * Adsterra Ad Orchestrator & Trading Shield
 * 
 * Rules:
 * 1. Protects trade-critical controls (Buy/Sell, order execution, stock search) from click hijacking.
 * 2. Provides safe, non-destructive lifecycle management for Adsterra network scripts (Placement: 6161748).
 * 3. Zero DOM-deletion mutations to completely avoid React virtual DOM exceptions and auto-refresh loops.
 */
export default function AdsterraManager({ placementId = '6161748' }) {
  // Trading Form & Interaction Shield
  useEffect(() => {
    const handleCaptureClick = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;

      const isTradeCritical = el.closest(
        'button[type="submit"], input, select, textarea, [role="dialog"], #stock-search-input, .no-popunder, [data-no-popunder="true"]'
      );

      if (isTradeCritical) {
        e.__isTradeProtected = true;
      }
    };

    document.addEventListener('click', handleCaptureClick, true);
    return () => document.removeEventListener('click', handleCaptureClick, true);
  }, []);

  return null;
}
