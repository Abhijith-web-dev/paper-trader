import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home, Search, Compass, BookOpen } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 font-mono text-xs text-[#111111]">
      <div className="newspaper-photo-plate p-6 sm:p-10 max-w-lg w-full bg-white border-2 border-[#111111] shadow-[8px_8px_0px_#111111] space-y-5 text-center">
        
        {/* Newspaper 404 Badge */}
        <div className="w-16 h-16 mx-auto bg-amber-100 border-2 border-[#111111] flex items-center justify-center text-amber-900 shadow-[3px_3px_0px_#111111]">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 font-semibold block mb-1">
            ERROR CODE 404 • DISPATCH SUSPENDED
          </span>
          <h1 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
            QUOTATION NOT FOUND
          </h1>
          <p className="font-news text-sm sm:text-base text-[#111111]/75 mt-2 leading-relaxed">
            The market page or instrument ticker you requested has either been delisted from the board or relocated to another exchange desk.
          </p>
        </div>

        <div className="p-3 bg-[#FAF8F3] border border-neutral-300 text-left space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-800 block">Recommended Navigation:</span>
          <ul className="list-disc pl-5 font-news text-xs text-neutral-700 space-y-0.5">
            <li>Check the spelling of the stock symbol or route.</li>
            <li>Return to your main portfolio ledger.</li>
            <li>Scan live active stocks using the market screener.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
          <Link
            to="/dashboard"
            className="px-5 py-2.5 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#111111] min-h-[42px]"
          >
            <Home className="w-4 h-4" />
            <span>Return to Trader's Desk</span>
          </Link>
          <Link
            to="/screener"
            className="px-4 py-2.5 bg-white border-2 border-[#111111] text-[#111111] font-bold text-xs hover:bg-neutral-100 transition-colors flex items-center justify-center gap-1.5 min-h-[42px]"
          >
            <Compass className="w-4 h-4 text-neutral-700" />
            <span>Open Market Screener</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
