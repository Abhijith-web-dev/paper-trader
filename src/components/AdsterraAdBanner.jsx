import React, { useEffect, useRef } from 'react';

/**
 * Adsterra Responsive Broadside Banner Component
 * 
 * Securely encapsulates Adsterra ad serving (Placement ID: 6161748) within an isolated 
 * sub-document iframe to protect React's virtual DOM against document.write overrides.
 * 
 * Designed in authentic broadsheet newspaper style to seamlessly integrate with
 * Paper Trading's financial aesthetic.
 */
export default function AdsterraAdBanner({ 
  placementId = '6161748', 
  className = '' 
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous ad instance on re-render
    container.innerHTML = '';

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const width = isMobile ? 320 : 728;
    const height = isMobile ? 50 : 90;

    // Create sandboxed sub-document iframe
    const iframe = document.createElement('iframe');
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.setAttribute('title', 'Sponsored Financial Dispatch');
    iframe.setAttribute('loading', 'lazy');

    container.appendChild(iframe);

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: transparent;
                overflow: hidden;
              }
            </style>
          </head>
          <body>
            <script type="text/javascript">
              atOptions = {
                'key' : '${placementId}',
                'format' : 'iframe',
                'height' : ${height},
                'width' : ${width},
                'params' : {}
              };
            </script>
            <script type="text/javascript" src="//www.highperformanceformat.com/${placementId}/invoke.js"></script>
          </body>
          </html>
        `);
        doc.close();
      }
    } catch {
      // Safe failover for restricted iframe contexts
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [placementId]);

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

        {/* Dynamic Ad Slot Frame */}
        <div 
          ref={containerRef}
          className="min-h-[50px] md:min-h-[90px] w-full flex items-center justify-center overflow-hidden bg-white/40 border border-dashed border-[#D8D2C4] py-1"
        />

        {/* Footer Attribution Micro-bar */}
        <div className="flex items-center justify-between pt-1.5 mt-2 border-t border-dashed border-[#D8D2C4] text-[9px] text-[#111111]/50 uppercase tracking-wider">
          <span>Official Adsterra Network Partner</span>
          <span>Placement #{placementId}</span>
        </div>
      </div>
    </aside>
  );
}
