import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Sparkles, ExternalLink, BellRing } from 'lucide-react';

/**
 * Monetag Ad Manager
 * 
 * Orchestrates Monetag monetization formats:
 * 1. In-Page Push (IPP) Banner:
 *    - Desktop: Unobtrusive floating card in lower right quadrant.
 *    - Mobile: Sticky, responsive bottom plate positioned cleanly above navigation.
 *    - Dismissible with session-aware close button.
 * 
 * 2. Vignette Interstitial Banner:
 *    - Smoothly transitions on route changes between terminal views.
 * 
 * 3. Ad-Blocker Immune & Zero-Crash Architecture:
 *    - Fails silently if ad networks are filtered; never impedes order execution or charting.
 */
export default function MonetagAdManager() {
  const location = useLocation();
  const [inPageDismissed, setInPageDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('paper_trading_ad_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [vignetteActive, setVignetteActive] = useState(false);
  const [lastPath, setLastPath] = useState(location.pathname);

  // Handle route change for Vignette trigger
  useEffect(() => {
    if (location.pathname !== lastPath) {
      setLastPath(location.pathname);

      // Trigger Monetag Vignette hook if loaded on window
      try {
        if (typeof window !== 'undefined' && window.showMonetagVignette) {
          window.showMonetagVignette();
        }
      } catch (err) {
        // Silent failover
      }
    }
  }, [location.pathname, lastPath]);

  // Session-dismiss handler for in-page push banner
  const handleDismissInPage = () => {
    setInPageDismissed(true);
    try {
      sessionStorage.setItem('paper_trading_ad_dismissed', 'true');
    } catch {}
  };

  return (
    <>
      {/* 1. Monetag Vignette Overlay Container */}
      <div 
        id="monetag-vignette-zone" 
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden" 
        aria-hidden="true" 
      />

      {/* 2. Responsive In-Page Push & Sponsored Market Bulletin */}
      {!inPageDismissed && (
        <aside 
          aria-label="Sponsored Market Bulletin"
          className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-40 max-w-[calc(100vw-1rem)] sm:max-w-sm w-full bg-[#FAF8F3] border-2 border-[#111111] shadow-[4px_4px_0px_#111111] transition-all duration-200 font-mono text-xs text-[#111111]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-[#111111] text-[#F6F4EE] px-2.5 py-1.5 border-b border-[#111111]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <BellRing className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>MARKET SPONSOR DISPATCH</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] px-1 py-0.2 bg-neutral-800 text-neutral-300 border border-neutral-600 uppercase font-mono">
                AD
              </span>
              <button
                type="button"
                onClick={handleDismissInPage}
                className="p-0.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss sponsor notice for this session"
                aria-label="Dismiss sponsor notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Ad Content & Injection Slot */}
          <div className="p-3 space-y-2 bg-[#FAF8F3]">
            {/* Native Monetag Dynamic Injection Target */}
            <div id="monetag-inpage-push-zone" className="min-h-[40px] flex items-center justify-center">
              <div className="text-left w-full space-y-1">
                <div className="font-news text-sm font-bold text-[#111111] leading-tight">
                  Institutional Liquidity & Trading Insights
                </div>
                <p className="text-[11px] text-[#111111]/75 leading-snug">
                  Support free paper trading access. Explore top trading tools and partner resources.
                </p>
              </div>
            </div>

            {/* Footer Micro-notice */}
            <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-[#D8D2C4] text-[9px] text-[#111111]/60">
              <span>Monetag Verified Partner</span>
              <span className="hover:underline cursor-pointer" onClick={handleDismissInPage}>
                Close Bulletin
              </span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
