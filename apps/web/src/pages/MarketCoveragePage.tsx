import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { MarketCoverageInfo } from '@globaltrade/shared';
import { 
  Building2, 
  Clock, 
  Database, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const MarketCoveragePage: React.FC = () => {
  const [coverageList, setCoverageList] = useState<MarketCoverageInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    ApiClient.get<MarketCoverageInfo[]>('/markets/coverage')
      .then(data => setCoverageList(data))
      .catch(err => console.error('Failed to load coverage directory:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1B222D] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#CCFF00] font-extrabold text-xs tracking-wider uppercase mb-1">
            <Building2 className="w-4 h-4" /> Global Directory
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Market Coverage Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Transparent disclosure of all supported international exchanges, order types, official market sessions, data feed freshness, and architectural simulation rules.
          </p>
        </div>

        <Link
          to="/markets"
          className="self-start sm:self-auto px-5 py-2.5 rounded-full bg-[#10151C] hover:border-[#CCFF00] hover:text-[#CCFF00] text-xs font-bold text-slate-200 border border-[#1B222D] transition-all flex items-center gap-2"
        >
          View All Instruments <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium">Loading exchange specifications...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {coverageList.map((cov) => (
            <div
              key={cov.exchange}
              className="bg-[#0B0F14] border border-[#1B222D] rounded-3xl p-6 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-xl text-white">{cov.exchange}</span>
                      <span className="text-xs px-3 py-1 rounded-full bg-[#10151C] text-slate-300 font-bold border border-[#1B222D]">
                        {cov.country}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-slate-200 mt-1">{cov.name}</h2>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/25">
                      {cov.dataFreshness.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1.5 font-mono font-bold">{cov.currency}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-[#1B222D]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Market Hours</span>
                    <span className="text-slate-300 flex items-center gap-1.5 mt-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {cov.marketHours}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Timezone</span>
                    <span className="text-slate-300 font-mono mt-1 block font-bold">{cov.timezone}</span>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Data Provider & Source</span>
                    <span className="text-slate-300 flex items-center gap-1.5 font-medium mt-1">
                      <Database className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                      {cov.dataProvider} ({cov.historicalDepth})
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Supported Orders</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {cov.supportedOrderTypes.map(ot => (
                        <span key={ot} className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#10151C] text-slate-300 border border-[#1B222D]">
                          {ot}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{cov.limitations}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1B222D] flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 font-bold">Sample Tickers:</span>
                <div className="flex gap-2">
                  {cov.sampleTickers.map(t => (
                    <Link
                      key={t}
                      to={`/instrument/${encodeURIComponent(t)}`}
                      className="text-[11px] font-mono font-bold text-[#CCFF00] hover:text-white bg-[#CCFF00]/10 hover:bg-[#CCFF00]/20 border border-[#CCFF00]/20 px-3 py-1 rounded-full transition-colors"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
