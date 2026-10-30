import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Monetag Push Notification Manager (Zone 12144415)
 * 
 * Rules:
 * 1. ZERO front popup ads, ZERO popunders, ZERO middle vignette ads.
 * 2. Only supports genuine browser site notifications (Monetag Zone 12144415 via /sw.js).
 * 3. Non-intrusive, user-initiated opt-in banner with polite snooze memory.
 */
export default function MonetagAdManager() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only show if browser supports notifications, not yet granted/denied, and not snoozed
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    try {
      const dismissedUntil = localStorage.getItem('paper_trading_push_snooze');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch {}

    // Polite delay so it never interrupts immediate landing
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 12000);

    return () => clearTimeout(timer);
  }, []);

  const handleEnablePush = async () => {
    try {
      const res = await Notification.requestPermission();
      setShowPrompt(false);
      if (res === 'granted') {
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
          } catch {
            // Service worker fallback
          }
        }
        toast.success('Market notifications enabled! You will receive market opening and price trigger alerts.');
      } else if (res === 'denied') {
        localStorage.setItem('paper_trading_push_snooze', String(Date.now() + 7 * 86400 * 1000));
      }
    } catch {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      // Snooze for 48 hours
      localStorage.setItem('paper_trading_push_snooze', String(Date.now() + 48 * 3600 * 1000));
    } catch {}
  };

  if (!showPrompt) return null;

  return (
    <aside 
      aria-label="Market Notifications Opt-in"
      className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 max-w-[calc(100vw-1.5rem)] sm:max-w-xs w-full bg-[#FAF8F3] border-2 border-[#111111] shadow-[4px_4px_0px_#111111] font-mono text-xs text-[#111111] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center justify-between bg-[#111111] text-[#F6F4EE] px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span>MARKET DISPATCH NOTICES</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
          title="Dismiss notification prompt"
          aria-label="Dismiss notification prompt"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        <p className="font-news text-xs leading-relaxed text-[#111111]/85">
          Get real-time browser alerts when market sessions open, stock targets are triggered, and institutional insights are dispatched.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleEnablePush}
            className="flex-1 py-1.5 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 font-bold text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enable Alerts</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-2.5 py-1.5 bg-white border border-[#111111] text-[#111111] hover:bg-neutral-100 font-bold text-[11px] transition-colors cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>
    </aside>
  );
}
