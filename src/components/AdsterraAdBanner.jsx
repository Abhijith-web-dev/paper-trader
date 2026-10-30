import React, { useState, useEffect } from 'react';
import { resolveAdsterraPlacement, ADSTERRA_CONFIG } from '../config/adsterra';

/**
 * Adsterra Responsive Broadside Banner Component
 * 
 * Safely loads Adsterra ad creatives via an isolated same-origin document (/adsterra-banner.html).
 * This completely isolates React's virtual DOM against document.write overrides while providing
 * the ad network with a legitimate top-level origin (paper-trader-001.web.app).
 */
export default function AdsterraAdBanner({ 
  placementId = ADSTERRA_CONFIG.defaultPlacementId,
  adKey = ADSTERRA_CONFIG.defaultHashKey,
  className = '' 
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const config = resolveAdsterraPlacement({ placementId, adKey, isMobile });
  const iframeSrc = `/adsterra-banner.html?key=${encodeURIComponent(config.hashKey)}&width=${config.width}&height=${config.height}&script=${encodeURIComponent(config.scriptUrl)}`;

  return (
    <aside 
      aria-label="Sponsored Market Bulletin"
      className={`adsterra-banner-wrapper my-8 ${className}`}
    >
      <div className="newspaper-photo-plate p-3.5 bg-[#FAF8F3] border-2 border-[#111111] shadow-[4px_4px_0px_#111111] max-w-4xl mx-auto font-mono text-xs">
        {/* Header Micro-label Bar */}
        <div className="flex items-center justify-between border-b border-dashed border-[#D8D2C4] pb-1.5 mb-2.5 text-[10px] text-[#111111]/75">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-[#111111]" />
            <span>SPONSORED FINANCIAL DISPATCH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] px-1 py-0.2 bg-neutral-200 border border-neutral-400 text-neutral-800 font-bold uppercase">
              AD
            </span>
          </div>
        </div>

        {/* Real Same-Origin Sandbox Frame */}
        <div className="min-h-[50px] md:min-h-[60px] w-full flex items-center justify-center overflow-hidden bg-white/40 border border-dashed border-[#D8D2C4] py-1">
          <iframe 
            key={`${config.hashKey}-${config.width}-${config.height}`}
            src={iframeSrc}
            title={config.label}
            width={config.width}
            height={config.height}
            className="border-0 overflow-hidden"
            scrolling="no"
            loading="lazy"
          />
        </div>

        {/* Footer Attribution Micro-bar */}
        <div className="flex items-center justify-between pt-1.5 mt-2 border-t border-dashed border-[#D8D2C4] text-[9px] text-[#111111]/50 uppercase tracking-wider">
          <span>Official Adsterra Network Partner</span>
          <span>Placement #{placementId}</span>
        </div>
      </div>
    </aside>
  );
}
