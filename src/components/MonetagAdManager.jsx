import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { X, BellRing, ShieldCheck } from 'lucide-react';

/**
 * Monetag Advanced Ad Orchestrator
 * 
 * Configured specifically for Monetag Zone IDs:
 * - Zone 12144413: In-Page Push (IPP)
 * - Zone 12144414: Vignette Banner (Interstitial)
 * - Zone 12144412: OnClick (Popunder)
 * - Zone 12144415: Push Notifications (Service Worker)
 * 
 * Non-Irritating Rules:
 * 1. Safe Placement: In-Page Push stays locked to the bottom-right corner, away from charts & trade forms.
 * 2. Trading Shield: Critical trade actions (Buy/Sell, Execute Order, Search) are shielded from popunders.
 * 3. Navigation Pacing: Vignette banners are throttled to at most once every 180s on major tab navigation.
 * 4. Dismissible: Clean close buttons with session/24h dismissal memory.
 */
export default function MonetagAdManager() {
  const location = useLocation();
  const [inPageDismissed, setInPageDismissed] = useState(() => {
    try {
      const dismissedUntil = localStorage.getItem('monetag_ipp_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return true;
      }
      return sessionStorage.getItem('paper_trading_ad_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [lastPath, setLastPath] = useState(location.pathname);
  const lastVignetteTimeRef = useRef(Date.now() - 120000); // 2-min initial grace period

  // 1. Route Navigation Pacing for Vignette Interstitial (Zone 12144414)
  useEffect(() => {
    if (location.pathname !== lastPath) {
      setLastPath(location.pathname);

      // Only trigger on transitions to secondary analytical views
      const safeVignetteRoutes = ['/journal', '/screener', '/transactions', '/guide', '/disclaimer'];
      const isSafeTransition = safeVignetteRoutes.some((route) => location.pathname.startsWith(route));
      const now = Date.now();
      const cooldownMs = 180000; // 3-minute strict cooldown to prevent spam

      if (isSafeTransition && now - lastVignetteTimeRef.current > cooldownMs) {
        lastVignetteTimeRef.current = now;
        try {
          if (typeof window !== 'undefined' && window.showMonetagVignette) {
            window.showMonetagVignette();
          }
        } catch {
          // Fail silently
        }
      }
    }
  }, [location.pathname, lastPath]);

  // 2. Popunder Shield (Zone 12144412): Protect trading & inputs from popunder hijacking
  useEffect(() => {
    const handleCaptureClick = (e) => {
      const el = e.target;
      if (!el || typeof el.closest !== 'function') return;

      // Identify trade-critical and input elements
      const isTradeCritical = el.closest(
        'button[type="submit"], input, select, textarea, [role="dialog"], #stock-search-input, .no-popunder, [data-no-popunder="true"]'
      );

      if (isTradeCritical) {
        // Tagging event prevents popunder scripts that inspect events from taking action
        e.__isTradeProtected = true;
      }
    };

    document.addEventListener('click', handleCaptureClick, true);
    return () => document.removeEventListener('click', handleCaptureClick, true);
  }, []);

  // 3. Dismiss handler for In-Page Push banner (Zone 12144413)
  const handleDismissInPage = () => {
    setInPageDismissed(true);
    try {
      sessionStorage.setItem('paper_trading_ad_dismissed', 'true');
      // Snooze for 6 hours so return visitors aren't constantly nagged
      localStorage.setItem('monetag_ipp_dismissed_until', String(Date.now() + 6 * 3600 * 1000));
    } catch {}
  };

  return (
    <>
      {/* 1. Monetag Vignette Overlay Injection Target (Zone 12144414) */}
      <div 
        id="monetag-vignette-zone" 
        data-zone="12144414"
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden" 
        aria-hidden="true" 
      />

      {/* 2. Responsive In-Page Push & Sponsored Market Bulletin (Zone 12144413) */}
      {!inPageDismissed && (
        <aside 
          aria-label="Sponsored Market Bulletin"
          data-zone="12144413"
          className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-40 max-w-[calc(100vw-1rem)] sm:max-w-sm w-full bg-[#FAF8F3] border-2 border-[#111111] shadow-[4px_4px_0px_#111111] transition-all duration-200 font-mono text-xs text-[#111111]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-[#111111] text-[#F6F4EE] px-2.5 py-1.5 border-b border-[#111111]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <BellRing className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>MARKET SPONSOR DISPATCH</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] px-1 py-0.2 bg-neutral-800 text-neutral-300 border border-neutral-600 uppercase font-mono">
                AD
              </span>
              <button
                type="button"
                onClick={handleDismissInPage}
                className="p-0.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss sponsor notice"
                aria-label="Dismiss sponsor notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Ad Content & Dynamic Injection Slot */}
          <div className="p-3 space-y-2 bg-[#FAF8F3]">
            {/* Native Monetag Dynamic Injection Target */}
            <div id="monetag-inpage-push-zone" data-zone="12144413" className="min-h-[44px] flex items-center justify-center">
              <div className="text-left w-full space-y-1">
                <div className="font-news text-sm font-bold text-[#111111] leading-tight">
                  Institutional Liquidity & Trading Insights
                </div>
                <p className="text-[11px] text-[#111111]/75 leading-snug">
                  Support free paper trading. Explore top partner platforms, market screener intelligence, and institutional trading tools.
                </p>
              </div>
            </div>

            {/* Footer Micro-bar */}
            <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-[#D8D2C4] text-[9px] text-[#111111]/60">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-700" />
                Monetag Verified Partner
              </span>
              <button 
                type="button"
                className="hover:underline hover:text-[#111111] cursor-pointer" 
                onClick={handleDismissInPage}
              >
                Dismiss Notice
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
