import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, CheckCircle2, ArrowLeft, Shield, AlertOctagon, Terminal } from 'lucide-react';

export default function TermsPage() {
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
          User Agreement & Legal Terms
        </span>
      </div>

      {/* Main Newspaper Masthead Box */}
      <div className="newspaper-photo-plate p-5 sm:p-8 bg-white border-2 border-[#111111] shadow-[8px_8px_0px_#111111] space-y-6">
        
        {/* Header Ribbon */}
        <div className="border-b-2 border-[#111111] pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-[#111111] text-[#F6F4EE]">
              <Scale className="w-5 h-5 text-amber-400" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-900 bg-neutral-200 border border-[#111111] px-2 py-0.5">
              TERMS OF SIMULATED SERVICE
            </span>
          </div>
          <h1 className="font-headline uppercase font-black text-2xl sm:text-4xl text-[#111111] tracking-tight leading-tight">
            TERMS OF USE & EDUCATIONAL COVENANT
          </h1>
          <p className="font-news text-sm sm:text-base text-[#111111]/80 mt-1 leading-relaxed">
            Rules of engagement for participating in the paper trading simulator and learning community.
          </p>
        </div>

        {/* Core Notice */}
        <div className="p-4 bg-amber-50 border-2 border-amber-800 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm uppercase">
            <AlertOctagon className="w-5 h-5 text-amber-800 shrink-0" />
            <span>Educational Use Only</span>
          </div>
          <p className="font-news text-sm leading-relaxed text-amber-900/90">
            By creating an account or accessing this website, you agree that you are using this platform strictly for educational simulation, market hypothesis testing, and technical study. You agree not to attempt any real-money transaction or represent your virtual paper balances as authentic monetary assets.
          </p>
        </div>

        {/* Section 1: Acceptable Use */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>1. Permitted & Acceptable Use</span>
          </h2>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            Users may utilize the charting tools, backtester, position size calculators, and trade journals to refine their personal market methodologies. You may not:
          </p>
          <ul className="list-disc pl-5 font-news text-sm space-y-1 text-[#111111]/80">
            <li>Misrepresent simulated trading gains or losses to solicit real investments from third parties.</li>
            <li>Attempt to reverse-engineer, overload, or launch denial-of-service attacks against market data proxies.</li>
            <li>Use the platform to execute automated high-frequency scrapers without prior authorization.</li>
          </ul>
        </section>

        {/* Section 2: Account Integrity */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>2. Account Integrity & Virtual Funds</span>
          </h2>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            Virtual capital allocations (₹10,00,000 INR and $100,000 USD) are provided without fee. We reserve the right to reset, calibrate, or adjust baseline simulator settings during platform updates or beta release cycles.
          </p>
        </section>

        {/* Section 3: Limitation of Liability */}
        <section className="space-y-2">
          <h2 className="font-serif font-black text-base uppercase text-[#111111] flex items-center gap-2 border-b border-neutral-300 pb-1">
            <span className="w-2 h-2 bg-[#111111]"></span>
            <span>3. Limitation of Liability & Market Risk Waiver</span>
          </h2>
          <p className="font-news text-sm leading-relaxed text-[#111111]/80">
            In no event shall the developers, contributors, or operators of this platform be held liable for any real-world financial losses, damages, or missed market opportunities incurred by users if they choose to trade actual equities based on patterns observed in this simulator. Real market trading carries inherent capital risk.
          </p>
        </section>

        {/* Sign-Off Footer */}
        <div className="pt-6 border-t-2 border-[#111111] space-y-3 text-xs font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-neutral-700 font-medium">
              <span>Governing Framework: Educational Fair Use Standards</span>
            </div>
            <div className="flex gap-2">
              <Link
                to="/disclaimer"
                className="px-3 py-1.5 bg-white border border-[#111111] font-bold hover:bg-neutral-100"
              >
                Risk Disclaimer
              </Link>
              <Link
                to="/privacy"
                className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold hover:bg-neutral-800"
              >
                Privacy Policy
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
