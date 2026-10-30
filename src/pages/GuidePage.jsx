import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AdsterraAdBanner from '../components/AdsterraAdBanner';
import { 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  ShieldAlert, 
  Calculator, 
  BarChart2, 
  CheckCircle2, 
  ArrowLeft,
  ArrowRight,
  Layers,
  HelpCircle,
  Lightbulb,
  Clock,
  Sparkles
} from 'lucide-react';

export default function GuidePage() {
  const [activeFaq, setActiveFaq] = useState(null);

  const guideModules = [
    {
      step: '01',
      title: 'Virtual Capital & Zero-Risk Environment',
      icon: <GraduationCap className="w-5 h-5 text-emerald-700" />,
      desc: 'You begin with ₹10,00,000 for Indian Equities (NSE) and $100,000 for US Blue Chips (NASDAQ/NYSE). All trades are 100% paper-simulated so you can make mistakes, test theories, and master order execution without risking real life savings.',
      actionLink: '/dashboard',
      actionText: 'View Virtual Ledgers',
    },
    {
      step: '02',
      title: 'Fundamental Valuation vs Technical Timing',
      icon: <BookOpen className="w-5 h-5 text-blue-700" />,
      desc: 'Understand P/E ratios, 52-week price spans, and earnings stability before entering a position. Use our Technical Screener to spot 52-week breakouts, oversold bounces (RSI ≤ 35), and institutional trend continuation setups.',
      actionLink: '/screener',
      actionText: 'Explore Screener',
    },
    {
      step: '03',
      title: 'Institutional Position Sizing & The 1% Rule',
      icon: <Calculator className="w-5 h-5 text-purple-700" />,
      desc: 'Never risk more than 1% to 2% of your liquid account on a single idea. Use our mathematical Risk Calculator to auto-tune share quantities according to asset-specific ATR volatility and regulatory turnover taxes.',
      actionLink: '/dashboard',
      actionText: 'Open Risk Sizer',
    },
    {
      step: '04',
      title: 'The Unalterable Post-Mortem Trade Journal',
      icon: <Layers className="w-5 h-5 text-amber-700" />,
      desc: 'Top professional funds review every execution. Your Trade Journal automatically records every buy and sell in an IndexedDB ledger, calculating Net P&L, Sharpe Ratio, Risk-to-Reward ratio, and emotional discipline adherence.',
      actionLink: '/journal',
      actionText: 'Open Trade Journal',
    },
  ];

  const faqs = [
    {
      q: 'Is any real money required to use this website?',
      a: 'No, absolutely zero real money is ever needed or accepted. This website is purely an educational simulator designed to let students, investors, and traders master financial principles before committing hard-earned money in actual financial markets.'
    },
    {
      q: 'Can I withdraw my paper trading profits to a real bank account?',
      a: 'No. All virtual profits and balances are fictional software numbers generated for learning, performance scoring, and strategy testing. They possess zero real-world monetary value.'
    },
    {
      q: 'What is the difference between Indian (NSE) and US Equities on this platform?',
      a: 'Indian equities trade in Indian Rupees (₹) with realistic SEBI/STT turnover charges and market hours (09:15 AM – 03:30 PM IST). US equities trade in US Dollars ($) with SEC/FINRA fees and US market hours (09:30 AM – 04:00 PM ET). The platform supports sandbox trading even when real exchanges are closed so you can practice 24/7.'
    },
    {
      q: 'How does the strategy backtester work?',
      a: 'Our backtester runs 100% client-side in a multi-threaded Web Worker. It analyzes historical daily candlestick bars against quantitative rules (such as 9/21 EMA Cross, RSI Bounce, Bollinger Volatility Breakout, and Candlestick Reversals) to evaluate win rates and drawdowns.'
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 font-mono text-xs text-[#111111] space-y-6">
      
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 font-bold hover:underline min-h-[38px] text-xs sm:text-sm"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>← Return to Trader's Desk</span>
        </Link>
        <span className="text-[10px] uppercase font-bold text-neutral-700">
          Trader's Academy & Platform Handbook
        </span>
      </div>

      {/* Hero Newspaper Plate */}
      <div className="newspaper-photo-plate p-5 sm:p-8 bg-white border-2 border-[#111111] shadow-[8px_8px_0px_#111111] space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 bg-[#111111] text-[#F6F4EE]">
            <GraduationCap className="w-5 h-5 text-amber-400" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-900 bg-amber-100 border border-amber-400 px-2 py-0.5">
            ACADEMY CURRICULUM & SYSTEM MANUAL
          </span>
        </div>
        <h1 className="font-headline uppercase font-black text-2xl sm:text-4xl text-[#111111] tracking-tight leading-tight">
          MASTER THE FUNDAMENTALS BEFORE YOU INVEST REAL MONEY
        </h1>
        <p className="font-news text-sm sm:text-base text-[#111111]/80 max-w-3xl leading-relaxed">
          The stock market is an unforgiving environment for untrained capital. This paper trading platform provides you with an authentic, real-time testing laboratory to build edge, test hypotheses, and internalize risk management rules.
        </p>
      </div>

      {/* 4-Step Learning Roadmap */}
      <div className="space-y-3">
        <h2 className="font-headline uppercase text-xl sm:text-2xl font-black text-[#111111] tracking-tight">
          FOUR PILLARS OF SIMULATED EXECUTION
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guideModules.map((m) => (
            <div 
              key={m.step}
              className="p-5 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between border-b border-neutral-300 pb-2 mb-2">
                  <span className="font-black text-lg text-neutral-800 font-serif">STEP {m.step}</span>
                  <div className="p-1.5 bg-[#FAF8F3] border border-[#111111]">
                    {m.icon}
                  </div>
                </div>
                <h3 className="font-serif font-black text-sm uppercase text-[#111111] mb-1">
                  {m.title}
                </h3>
                <p className="font-news text-xs sm:text-sm text-[#111111]/85 leading-relaxed">
                  {m.desc}
                </p>
              </div>

            <div className="pt-2 border-t border-dashed border-neutral-300">
              <Link
                to={m.actionLink}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] hover:underline"
              >
                <span>{m.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Golden Rules of Capital Preservation */}
      <div className="p-5 sm:p-6 bg-[#FAF8F3] border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-300 pb-2">
          <Lightbulb className="w-5 h-5 text-amber-600" />
          <h2 className="font-serif font-black text-base uppercase text-[#111111]">
            The 5 Golden Rules of Market Survival
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-news text-sm">
          <div className="p-3 bg-white border border-neutral-300 space-y-1">
            <strong className="block text-[#111111] font-bold font-mono text-xs">Rule 1: Always Define Your Stop First</strong>
            <p className="text-neutral-600 text-xs">Never enter a position without knowing the exact invalidation price where your hypothesis is proven wrong.</p>
          </div>
          <div className="p-3 bg-white border border-neutral-300 space-y-1">
            <strong className="block text-[#111111] font-bold font-mono text-xs">Rule 2: Respect R:R Asymmetry (1:2+)</strong>
            <p className="text-neutral-600 text-xs">Only take setups where your prospective profit target is at least 1.5x to 2x larger than your potential downside risk.</p>
          </div>
          <div className="p-3 bg-white border border-neutral-300 space-y-1">
            <strong className="block text-[#111111] font-bold font-mono text-xs">Rule 3: Size According to Volatility</strong>
            <p className="text-neutral-600 text-xs">Volatile tech stocks require smaller share sizing than defensive dividend blue-chips to maintain identical rupee or dollar risk.</p>
          </div>
          <div className="p-3 bg-white border border-neutral-300 space-y-1">
            <strong className="block text-[#111111] font-bold font-mono text-xs">Rule 4: Log Every Execution Post-Mortem</strong>
            <p className="text-neutral-600 text-xs">Write down your entry rationale, emotional state, and mistakes. The journal is your true edge over other retail traders.</p>
          </div>
          <div className="p-3 bg-white border border-neutral-300 space-y-1">
            <strong className="block text-[#111111] font-bold font-mono text-xs">Rule 5: Never Average Down on Losers</strong>
            <p className="text-neutral-600 text-xs">Adding more shares to a declining, broken setup is the number one cause of total portfolio liquidation.</p>
          </div>
          <div className="p-3 bg-white border border-neutral-300 space-y-1">
            <strong className="block text-[#111111] font-bold font-mono text-xs">Rule 6: Don't Rush Into Real Money</strong>
            <p className="text-neutral-600 text-xs">Achieve at least 3 consecutive profitable months on this simulator before opening an authentic brokerage account.</p>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="newspaper-photo-plate p-5 sm:p-6 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-300 pb-2">
          <HelpCircle className="w-5 h-5 text-neutral-700" />
          <h2 className="font-serif font-black text-base uppercase text-[#111111]">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="divide-y divide-neutral-200">
          {faqs.map((faq, idx) => (
            <div key={idx} className="py-3">
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full text-left flex justify-between items-center gap-2 font-bold text-xs sm:text-sm text-[#111111] hover:text-neutral-700 cursor-pointer"
              >
                <span>{faq.q}</span>
                <span className="font-mono text-base">{activeFaq === idx ? '−' : '+'}</span>
              </button>
              {activeFaq === idx && (
                <p className="font-news text-sm text-[#111111]/80 mt-2 leading-relaxed animate-in fade-in duration-100">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Adsterra Sponsored Financial Dispatch (Placement: 6161748 -> Key: 265129238f893cd98f180d1efd562793) */}
      <AdsterraAdBanner placementId="6161748" adKey="265129238f893cd98f180d1efd562793" />

      {/* Bottom Dispatch Footer */}
      <div className="pt-4 border-t-2 border-[#111111] space-y-3 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-neutral-700 font-medium">
            Paper Trading Academy • Education Before Speculation
          </span>
          <div className="flex items-center gap-3">
            <Link to="/disclaimer" className="underline hover:text-black">
              Risk Disclosure
            </Link>
            <Link to="/privacy" className="underline hover:text-black">
              Privacy Policy
            </Link>
            <Link to="/terms" className="underline hover:text-black">
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Developer Attribution Credit */}
        <div className="pt-2 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600">
          <span>Engineered & Curated for Market Education</span>
          <div className="flex items-center gap-1.5">
            <span>By <strong>Abhijith S</strong></span>
            <span>•</span>
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
