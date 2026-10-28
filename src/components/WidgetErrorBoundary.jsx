import React, { Component } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

/**
 * Institutional Widget-Level Error Boundary
 * Prevents any isolated rendering or Canvas/Chart exception from crashing
 * the parent trading terminal, portfolio, or ledger view.
 */
export default class WidgetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn(`[WidgetErrorBoundary] Caught exception in ${this.props.title || 'Widget'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="newspaper-photo-plate p-5 bg-white border-2 border-[#111111] text-[#111111] font-mono text-xs my-2">
          <div className="flex items-center gap-2 text-amber-900 border-b border-[#111111] pb-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <h4 className="font-bold uppercase tracking-wider text-sm">
              {this.props.title || 'Component'} Safeguard Active
            </h4>
          </div>
          <p className="font-news text-xs text-[#111111]/80 leading-relaxed mb-2">
            A rendering update in this widget was paused to prevent execution lockup. Ledger balances and holdings remain fully secure.
          </p>
          <div className="p-2 bg-amber-50/70 border border-amber-300 text-[10px] text-amber-950 font-mono truncate mb-3">
            {this.state.error?.message || 'Display exception caught'}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-3.5 py-1.5 bg-[#111111] text-[#F6F4EE] hover:bg-neutral-800 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset {this.props.title || 'Widget'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
