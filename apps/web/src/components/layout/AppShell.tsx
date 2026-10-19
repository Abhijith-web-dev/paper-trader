import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { 
  LayoutDashboard, 
  Globe2, 
  Briefcase, 
  ArrowLeftRight, 
  GraduationCap 
} from 'lucide-react';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#070D18]">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy-900/95 backdrop-blur-lg border-t border-slate-800 flex items-center justify-around py-2.5 px-3">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/markets"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`
          }
        >
          <Globe2 className="w-5 h-5" />
          <span>Markets</span>
        </NavLink>
        <NavLink
          to="/forex"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`
          }
        >
          <ArrowLeftRight className="w-5 h-5" />
          <span>Forex</span>
        </NavLink>
        <NavLink
          to="/portfolio"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`
          }
        >
          <Briefcase className="w-5 h-5" />
          <span>Portfolio</span>
        </NavLink>
        <NavLink
          to="/learn"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`
          }
        >
          <GraduationCap className="w-5 h-5" />
          <span>Learn</span>
        </NavLink>
      </nav>
    </div>
  );
};
