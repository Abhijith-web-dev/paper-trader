import React, { Component } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ScreenerView from '../components/ScreenerView';
import { ArrowLeft, Filter, AlertTriangle } from 'lucide-react';
import { useTradingTools } from '../context/TradingToolsContext';

class ScreenerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ScreenerPage caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="newspaper-photo-plate p-6 text-center space-y-3 font-mono text-xs bg-white border-2 border-[#111111] max-w-xl mx-auto my-12">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-600" />
          <h3 className="font-serif font-bold text-base text-[#111111] uppercase">
            Screener Engine Notice
          </h3>
          <p className="text-neutral-600">
            A temporary parsing error occurred in the live quantitative screener stream.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800 cursor-pointer"
          >
            Reload Screener
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ScreenerPage() {
  const navigate = useNavigate();
  const { openTrade, openRiskCalculator } = useTradingTools();

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Breadcrumb Bar */}
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
          <span className="text-neutral-700 font-bold uppercase flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-stone-700" />
            Market Screener & Heatmap
          </span>
        </div>

        <div className="text-[11px] text-neutral-700 font-mono font-medium">
          Exchange Feed: <strong className="text-emerald-700">ONLINE (NSE & US)</strong>
        </div>
      </div>

      {/* Main Broad-Sheet Screener Container */}
      <div className="border-2 border-[#111111] bg-white shadow-[8px_8px_0px_#111111] overflow-hidden">
        <ScreenerErrorBoundary>
          <ScreenerView
            isModal={false}
            onSelectStock={(stock) => navigate(`/stock/${stock.symbol}`)}
            onOpenTrade={(stock, action) => openTrade(stock, action)}
            onOpenRiskCalculator={(stock) => openRiskCalculator(stock)}
          />
        </ScreenerErrorBoundary>
      </div>
    </div>
  );
}
