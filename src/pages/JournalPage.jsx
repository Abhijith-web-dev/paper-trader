import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import TradeJournalView from '../components/TradeJournalView';
import { BookOpen, ArrowLeft, AlertTriangle } from 'lucide-react';

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('JournalPage caught rendering exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="newspaper-photo-plate p-6 text-center space-y-3 font-mono text-xs bg-white border-2 border-[#111111]">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
          <h3 className="font-serif font-bold text-base text-[#111111] uppercase">
            Journal Render Protection
          </h3>
          <p className="text-neutral-600">
            A corrupt record or parsing issue was intercepted safely. Your IndexedDB records remain secure.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800"
          >
            Reload Journal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function JournalPage() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4] font-mono text-xs">
        <div className="flex items-center gap-2 text-neutral-600">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 font-bold text-[#111111] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <span>/</span>
          <span className="text-neutral-700 uppercase font-bold">Trade Journal & Edge Post-Mortem</span>
        </div>

        <div className="text-[11px] text-neutral-700 font-mono font-medium hidden sm:block">
          Local IndexedDB • Zero Cloud Transfer
        </div>
      </div>

      {/* Main Newspaper Plate Container */}
      <div className="newspaper-photo-plate p-1 bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] overflow-hidden">
        <PageErrorBoundary>
          <TradeJournalView isModal={false} />
        </PageErrorBoundary>
      </div>
    </div>
  );
}
