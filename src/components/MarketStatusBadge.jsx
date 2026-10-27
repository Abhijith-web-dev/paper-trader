import React, { useState, useEffect } from 'react';
import { getNSEMarketStatus, getUSMarketStatus, getUpcomingHolidays } from '../lib/marketHours';
import { Clock, Lock, Calendar, Landmark, Info, X } from 'lucide-react';

export default function MarketStatusBadge({ market = 'NSE', showTime = true, size = 'md', interactive = true }) {
  const [status, setStatus] = useState(() => {
    return market === 'NSE' ? getNSEMarketStatus() : getUSMarketStatus();
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const update = () => {
      setStatus(market === 'NSE' ? getNSEMarketStatus() : getUSMarketStatus());
    };
    update();
    // 1-second live clock update
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [market]);

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  const Tag = interactive ? 'button' : 'span';
  const getTagProps = (clickHandler) => (interactive ? { type: 'button', onClick: clickHandler } : {});

  return (
    <>
      {status.isHoliday ? (
        <Tag
          {...getTagProps(() => setShowModal(true))}
          title={`Official Government Holiday: ${status.holidayName}. Click to inspect full holiday calendar.`}
          className={`inline-flex items-center gap-1.5 font-mono font-bold transition-all border min-h-[24px] ${interactive ? 'cursor-pointer hover:bg-amber-100' : ''} ${
            isSmall
              ? 'px-2 py-0.5 text-[9px] bg-amber-50 text-amber-950 border-amber-800'
              : isLarge
                ? 'px-3 py-1.5 text-xs bg-amber-100 text-amber-950 border-2 border-amber-900 shadow-xs'
                : 'px-2.5 py-1 text-[10px] bg-amber-50 text-amber-900 border border-amber-800'
          }`}
        >
          <Landmark className="w-3 h-3 text-amber-800 shrink-0" />
          <span className="uppercase">{market} HOLIDAY</span>
          <span className="text-amber-800 font-semibold truncate max-w-[140px] sm:max-w-none">
            ({status.holidayName})
          </span>
          {showTime && (
            <>
              <span className="text-amber-400 hidden sm:inline">|</span>
              <span className="font-normal text-amber-950 hidden sm:inline">{status.exchangeTime}</span>
            </>
          )}
        </Tag>
      ) : status.isOpen ? (
        <Tag
          {...getTagProps(() => setShowModal(true))}
          title={`${status.marketName}: ${status.schedule} (Current: ${status.exchangeTime}). Click for market calendar.`}
          className={`inline-flex items-center gap-1.5 font-mono font-bold transition-all border min-h-[24px] ${interactive ? 'cursor-pointer hover:bg-emerald-100' : ''} ${
            isSmall
              ? 'px-2 py-0.5 text-[9px] bg-emerald-100 text-emerald-900 border-emerald-800'
              : isLarge
                ? 'px-3 py-1.5 text-xs bg-emerald-50 text-emerald-950 border-2 border-emerald-900 shadow-xs'
                : 'px-2.5 py-1 text-[10px] bg-emerald-50 text-emerald-900 border-emerald-800'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-700"></span>
          </span>
          <span>{market} LIVE</span>
          {showTime && (
            <>
              <span className="text-emerald-400 hidden sm:inline">|</span>
              <span className="font-normal text-emerald-900 hidden sm:inline">
                {status.closingCountdown ? `Closes in ${status.closingCountdown}` : status.closeTimeStr}
              </span>
            </>
          )}
        </Tag>
      ) : (
        <Tag
          {...getTagProps(() => setShowModal(true))}
          title={`${status.marketName}: ${status.schedule} (Current: ${status.exchangeTime}). Click for schedule.`}
          className={`inline-flex items-center gap-1.5 font-mono font-semibold transition-all border min-h-[24px] ${interactive ? 'cursor-pointer hover:bg-stone-100' : ''} ${
            isSmall
              ? 'px-2 py-0.5 text-[9px] bg-white text-[#111111] border-[#111111]'
              : isLarge
                ? 'px-3 py-1.5 text-xs bg-white text-[#111111] border-2 border-[#111111] shadow-xs'
                : 'px-2.5 py-1 text-[10px] bg-white text-[#111111] border border-[#111111]'
          }`}
        >
          <Lock className="w-3 h-3 text-[#111111] shrink-0" />
          <span className="font-bold">{market} CLOSED</span>
          {showTime && (
            <>
              <span className="text-stone-300 hidden sm:inline">|</span>
              <span className="text-[#111111]/70 hidden sm:inline">{status.exchangeTime}</span>
            </>
          )}
        </Tag>
      )}

      {/* Official Market Schedule & Government Holiday Calendar Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs font-mono text-xs">
          <div className="newspaper-photo-plate bg-[#F6F4EE] border-4 border-[#111111] w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative text-[#111111]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 text-[#111111] hover:bg-[#111111] hover:text-[#F6F4EE] border border-[#111111] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b-2 border-[#111111] pb-3 mb-4 pr-8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                OFFICIAL FINANCIAL GAZETTE BULLETIN
              </span>
              <h3 className="font-headline uppercase font-black text-xl sm:text-2xl text-[#111111] tracking-tight">
                {status.marketName}
              </h3>
              <p className="text-xs text-[#111111]/80 mt-1">
                Official Trading Sessions, Real-Time Clocks & Government Holidays Calendar
              </p>
            </div>

            {/* Current Session Live State */}
            <div className="p-3.5 bg-white border-2 border-[#111111] mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase">Current Exchange Clock:</span>
                <span className="font-mono font-bold text-sm bg-[#111111] text-[#F6F4EE] px-2 py-0.5">
                  {status.exchangeTime}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Official Session Hours:</span>
                <span className="font-bold">{status.schedule}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Opening Time:</span>
                <strong className="text-emerald-800">{status.openTimeStr}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Closing Time:</span>
                <strong className="text-red-800">{status.closeTimeStr}</strong>
              </div>
              <div className="pt-2 border-t border-[#D8D2C4] text-xs">
                <span className="font-bold block text-[11px] uppercase text-stone-500 mb-0.5">Next Session Event:</span>
                <span className="font-bold text-[#111111]">{status.nextEventDesc}</span>
              </div>
            </div>

            {/* Today's Holiday Alert if active */}
            {status.isHoliday && (
              <div className="p-3 bg-amber-100 border-2 border-amber-900 text-amber-950 mb-4 text-xs font-news leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold font-mono text-sm uppercase text-amber-900 mb-1">
                  <Landmark className="w-4 h-4" />
                  <span>Government / Exchange Holiday Observed Today</span>
                </div>
                <p>
                  Today is an official market holiday in celebration/observance of <strong>{status.holidayName}</strong>. 
                  All live trading floors and settlement systems are closed as mandated by national financial regulations.
                </p>
              </div>
            )}

            {/* Upcoming Official Government Holidays */}
            <div>
              <div className="flex items-center justify-between border-b border-[#111111] pb-1.5 mb-2 font-bold uppercase text-xs">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#111111]" />
                  <span>Upcoming Official Holidays</span>
                </span>
                <span className="text-[10px] text-stone-500">OFFICIAL GAZETTE</span>
              </div>

              <div className="divide-y divide-[#D8D2C4] bg-white border border-[#111111]">
                {status.upcomingHolidays?.map((h) => (
                  <div key={h.dateKey} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#111111] block">
                        {h.name} {h.isToday && <span className="ml-1 px-1 py-0.2 bg-amber-300 text-black text-[9px] font-black uppercase">TODAY</span>}
                      </span>
                      <span className="text-[11px] text-[#111111]/70">{h.formattedDate}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FAF8F3] border border-[#111111]">
                      {h.dateKey}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t-2 border-[#111111] flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Close Bulletin
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
