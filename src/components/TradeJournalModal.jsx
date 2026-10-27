import React, { Component } from 'react';
import TradeJournalView from './TradeJournalView';
import { BookOpen, AlertTriangle } from 'lucide-react';

class JournalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TradeJournalModal ErrorBoundary caught exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-3 font-mono text-xs bg-white">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
          <h3 className="font-serif font-bold text-base text-[#111111] uppercase">
            Journal Render Protection
          </h3>
          <p className="text-neutral-600">
            A corrupt record was intercepted safely. Your IndexedDB records are secure.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            className="px-3 py-1.5 bg-[#111111] text-[#F6F4EE] font-bold text-xs"
          >
            Retry Loading Journal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TradeJournalModal({ isOpen, onClose, currentStock }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-[#F6F4EE] border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col max-h-[90vh]">
        <JournalErrorBoundary>
          <div className="overflow-y-auto flex-1 flex flex-col">
            <TradeJournalView currentStock={currentStock} isModal={true} onClose={onClose} />
          </div>
        </JournalErrorBoundary>
      </div>
    </div>
  );
}
