import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Users,
  Database,
  GitPullRequest,
  History,
  Settings,
  LogOut,
  Server,
  BriefcaseBusiness
} from 'lucide-react';

export const Sidebar = () => {
  const { currentTab, setCurrentTab, requests = [], logout, settings = {} } = useApp();

  const pendingRequestsCount = (requests || []).filter((r) => r && r.status === 'Pending').length;

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      badge: null
    },
    {
      id: 'clients',
      label: 'Client Management',
      icon: BriefcaseBusiness,
      badge: null
    },
    {
      id: 'databases',
      label: 'Database Management',
      icon: Database,
      badge: null
    },
    {
      id: 'requests',
      label: 'Database Requests',
      icon: GitPullRequest,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      badgeColor: 'bg-amber-500 text-slate-950 font-bold'
    },
    {
      id: 'activity',
      label: 'Activity Log',
      icon: History,
      badge: null
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur flex flex-col justify-between shrink-0">
      <div className="p-4 space-y-6">
        {/* Navigation list */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Main Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full shadow-sm ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* LAN Access Info card in sidebar */}
        <div className="mx-1 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>LAN Network Hosting</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Accessible from client laptops at:
          </p>
          <div className="px-2 py-1 rounded bg-slate-950/70 border border-slate-800 font-mono text-[11px] text-cyan-300 select-all truncate">
            http://{settings.serverIp}:{settings.frontendPort}
          </div>
        </div>
      </div>

      {/* Logout button at bottom of sidebar */}
      <div className="p-4 border-t border-slate-800/80">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all group"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400 transition-transform group-hover:-translate-x-0.5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

