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
  ShieldCheck,
  BookOpen,
  Building2
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Global Markets', icon: Globe2 },
  { to: '/markets/coverage', label: 'Market Coverage', icon: Building2 },
  { to: '/forex', label: 'Currency Converter', icon: ArrowLeftRight },
  { to: '/portfolio', label: 'Portfolio & P&L', icon: Briefcase },
  { to: '/journal', label: 'Trade Journal', icon: BookOpen },
  { to: '/orders', label: 'Orders & Ledger', icon: ListOrdered },
  { to: '/watchlists', label: 'Watchlists', icon: Star },
  { to: '/backtesting', label: 'Strategy Lab', icon: FlaskConical },
  { to: '/learn', label: 'Learning Center', icon: GraduationCap },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Telemetry & Admin', icon: ShieldCheck }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-[#1B222D] bg-[#070A0F] hidden lg:flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#10151C] text-[#CCFF00] border border-[#1B222D] shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#10151C]/60'
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
      <div className="p-3.5 rounded-2xl bg-[#0B0F14] border border-[#1B222D] space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#CCFF00]">
          <ShieldCheck className="w-4 h-4" />
          <span>Simulated Capital</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          100% virtual funds. Live quotes from Yahoo Finance & European Central Bank.
        </p>
      </div>
    </aside>
  );
};
