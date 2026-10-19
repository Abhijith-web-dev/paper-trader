import React, { useEffect, useState } from 'react';
import { ApiClient } from '../lib/apiClient';
import { MarketCoverageInfo } from '@globaltrade/shared';
import { 
  Building2, 
  Clock, 
  ShieldCheck, 
  Database, 
  AlertCircle,
  ExternalLink,
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <Building2 className="w-4 h-4" /> Global Directory
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Market Coverage Directory
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Transparent disclosure of all supported international exchanges, order types, official market sessions, data feed freshness, and architectural simulation rules.
          </p>
        </div>

        <Link
          to="/markets"
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          View All Instruments <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading exchange specifications...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {coverageList.map((cov) => (
            <div
              key={cov.exchange}
              className="bg-navy-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg text-white">{cov.exchange}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                        {cov.country}
                      </span>
                    </div>
                    <h2 className="text-sm font-semibold text-slate-200 mt-0.5">{cov.name}</h2>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {cov.dataFreshness.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1 font-mono">{cov.currency}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Market Hours</span>
                    <span className="text-slate-300 flex items-center gap-1 mt-0.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {cov.marketHours}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Timezone</span>
                    <span className="text-slate-300 font-mono mt-0.5 block">{cov.timezone}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Data Provider & Source</span>
                    <span className="text-slate-300 flex items-center gap-1 font-medium mt-0.5">
                      <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {cov.dataProvider} ({cov.historicalDepth})
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Supported Orders</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cov.supportedOrderTypes.map(ot => (
                        <span key={ot} className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-950 text-slate-300 border border-slate-800">
                          {ot}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{cov.limitations}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Sample Tickers:</span>
                <div className="flex gap-1.5">
                  {cov.sampleTickers.map(t => (
                    <Link
                      key={t}
                      to={`/instrument/${encodeURIComponent(t)}`}
                      className="text-[11px] font-mono font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded transition-colors"
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
