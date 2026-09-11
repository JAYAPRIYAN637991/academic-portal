import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Menu, School, Bell, Key } from 'lucide-react';
import { Badge } from '../common/Badge';

interface TopbarProps {
  onToggleSidebar: () => void;
  activeModuleTitle: string;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, activeModuleTitle }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between shadow-sm">
      {/* Left side: Hamburger & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{activeModuleTitle}</span>
              <span className="hidden md:inline text-xs font-normal text-slate-400">| VSB Engineering College</span>
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-400">
              Academic Year 2026-2027 (Even Semester)
            </p>
          </div>
        </div>
      </div>

      {/* Right side: User & Role info + Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 uppercase">
            {user?.username?.[0] || 'U'}
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.staffName || user?.username || 'User'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant={user?.role === 'ADMIN' ? 'primary' : 'success'}
                size="sm"
                className="text-[9px] py-0 px-1.5 font-bold uppercase"
              >
                {user?.role}
              </Badge>
            </div>
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <a
            href="#settings"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-700/50 transition-colors"
            title="Manage Admin Credentials & Settings"
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Admin Security</span>
          </a>
        )}

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
