import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Globe2, 
  ArrowLeftRight, 
  Briefcase, 
  ListOrdered, 
  Star, 
  FlaskConical, 
  GraduationCap, 
  Settings,
  ShieldCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Global Markets', icon: Globe2 },
  { to: '/forex', label: 'Currency Converter', icon: ArrowLeftRight },
  { to: '/portfolio', label: 'Portfolio & P&L', icon: Briefcase },
  { to: '/orders', label: 'Orders & Ledger', icon: ListOrdered },
  { to: '/watchlists', label: 'Watchlists', icon: Star },
  { to: '/backtesting', label: 'Strategy Lab', icon: FlaskConical },
  { to: '/learn', label: 'Learning Center', icon: GraduationCap },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Telemetry & Admin', icon: ShieldCheck }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-navy-900/60 backdrop-blur-sm hidden lg:flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Trading & Markets
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Safety & Educational Badge */}
      <div className="p-3.5 rounded-2xl bg-slate-850/80 border border-slate-750/80 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Simulated Environment</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          100% virtual capital. Market feeds are genuine live data from Yahoo Finance & European Central Bank.
        </p>
      </div>
    </aside>
  );
};
