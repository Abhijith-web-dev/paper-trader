import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldCheck, ArrowLeft, EyeOff, Database, Server, UserCheck } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 font-mono text-xs text-[#111111]">
      
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between pb-3 mb-6 border-b-2 border-[#111111]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-bold hover:underline min-h-[38px] text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>← Return to Front Page</span>
        </Link>
        <span className="text-[10px] uppercase font-bold text-neutral-700">
          Privacy & Data Protection Notice
        </span>
      </div>

      {/* Main Newspaper Masthead Box */}
      <div className="newspaper-photo-plate p-5 sm:p-8 bg-white border-2 border-[#111111] shadow-[8px_8px_0px_#111111] space-y-6">
        
        {/* Header Ribbon */}
        <div className="border-b-2 border-[#111111] pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-[#111111] text-[#F6F4EE]">
              <Lock className="w-5 h-5 text-emerald-400" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-900 bg-emerald-100 border border-emerald-400 px-2 py-0.5">
              LOCAL-FIRST PRIVACY CHARTER
            </span>
          </div>
          <h1 className="font-headline uppercase font-black text-2xl sm:text-4xl text-[#111111] tracking-tight leading-tight">
            PRIVACY POLICY & DATA INTEGRITY
          </h1>
          <p className="font-news text-sm sm:text-base text-[#111111]/80 mt-1 leading-relaxed">
            Transparent, zero-tracking commitment for all simulated paper traders.
          </p>
        </div>

        {/* Core Guarantee */}
        <div className="p-4 bg-[#FAF8F3] border-2 border-[#111111] space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm uppercase text-[#111111]">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Our Privacy Guarantee: Your Financial Practice Stays Yours</span>
          </div>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            We believe that learning to trade requires a safe, judgment-free environment. Unlike traditional retail trading applications, we do not monetize user order flows, sell trade logs to third-party institutions, or run invasive tracking scripts.
          </p>
        </div>

        {/* Section 1: Information Collected */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>1. Information We Collect</span>
          </h2>
          <div className="space-y-2 font-news text-sm text-[#111111]/80">
            <p>
              <strong>Account Authentication:</strong> If you register via email or Google OAuth, we store only your basic authentication identifier (email address, display name, and avatar URL) via secure Firebase Authentication.
            </p>
            <p>
              <strong>Simulated Orders & Portfolios:</strong> All positions, trade entries, stops, profit targets, and journal notes are stored client-side in your device's browser memory (IndexedDB / LocalStorage).
            </p>
            <p>
              <strong>Zero Banking Credentials:</strong> We never request, process, or store credit cards, debit cards, bank account numbers, PAN numbers, or SSNs.
            </p>
          </div>
        </section>

        {/* Section 2: Local Storage vs Optional Cloud Sync */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>2. Local Storage Architecture & Cloud Sync</span>
          </h2>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            By default, all calculations and order book records live directly inside your browser. When you click <em>"Sync with Cloud"</em>, your trade logs and portfolio balances are synchronized with your authenticated Firebase account purely to allow you to resume your learning across different devices.
          </p>
        </section>

        {/* Section 3: Third-Party Market Data */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>3. Third-Party Market Quotes & APIs</span>
          </h2>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            Our market screener and candlestick charts utilize public market quotation streams. When fetching quotations, anonymous ticker queries (such as <code>RELIANCE.NS</code> or <code>AAPL</code>) are sent without attaching your personal identity.
          </p>
        </section>

        {/* Section 4: Data Erasure & Vault */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>4. Right to Data Erasure & Local Vault Export</span>
          </h2>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            You hold total control over your practice records. At any point, you can download a full unencrypted or AES-256 encrypted JSON backup of your practice history, or wipe all records clean via the Encrypted Vault modal or Account Settings.
          </p>
        </section>

        {/* Sign-Off Footer */}
        <div className="pt-6 border-t-2 border-[#111111] space-y-3 text-xs font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-neutral-700 font-medium">
              <span>Effective Date: October 2026</span> • <span>Compliance Standards: GDPR & Indian IT Rules</span>
            </div>
            <div className="flex gap-2">
              <Link
                to="/disclaimer"
                className="px-3 py-1.5 bg-white border border-[#111111] font-bold hover:bg-neutral-100"
              >
                Risk Disclaimer
              </Link>
              <Link
                to="/terms"
                className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold hover:bg-neutral-800"
              >
                Terms of Service
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600">
            <span>Platform Engineered by <strong>Abhijith S</strong></span>
            <a
              href="https://abhijith-dev-io.web.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#111111] font-bold underline hover:text-emerald-800"
            >
              Portfolio: abhijith-dev-io.web.app
            </a>
          </div>
        </div>

      </div>

    </div>
  );
}
