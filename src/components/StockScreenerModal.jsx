import React, { useEffect } from 'react';
import ScreenerView from './ScreenerView';

export default function StockScreenerModal({ 
  isOpen, 
  onClose, 
  onSelectStock,
  onOpenTrade,
  onOpenRiskCalculator
}) {
  // ESC shortcut to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-6xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <ScreenerView
          isModal={true}
          onClose={onClose}
          onSelectStock={onSelectStock}
          onOpenTrade={onOpenTrade}
          onOpenRiskCalculator={onOpenRiskCalculator}
        />
      </div>
    </div>
  );
}
