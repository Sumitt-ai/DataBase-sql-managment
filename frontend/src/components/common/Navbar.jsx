import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Database, Server, ShieldCheck, LogOut, Copy, Check, Bell } from 'lucide-react';

export const Navbar = () => {
  const { settings = {}, logout, requests = [], adminUsername } = useApp();
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const pendingCount = (requests || []).filter((r) => r && r.status === 'Pending').length;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const copyIp = () => {
    navigator.clipboard.writeText(`http://${settings.serverIp}:${settings.frontendPort}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Server Connection Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/10">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 tracking-tight text-base">
                MySQL Admin Console
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v2.0 LAN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Centralized Database Administration
            </p>
          </div>
        </div>

        {/* Server IP Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 font-mono">Server IP:</span>
          <span className="text-slate-200 font-mono font-semibold">{settings.serverIp}:{settings.frontendPort}</span>
          <button
            onClick={copyIp}
            title="Copy LAN address to clipboard"
            className="text-slate-400 hover:text-cyan-400 transition-colors p-0.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Right Side: Statuses, Time, Admin, Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* MySQL Port 3306 Live Status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono font-medium hidden sm:inline">MySQL :3306</span>
          <span className="font-semibold text-[11px]">ACTIVE</span>
        </div>

        {/* Pending Requests Alert */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium animate-pulse">
            <Bell className="w-3.5 h-3.5" />
            <span>{pendingCount} Pending Request{pendingCount > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* System Time */}
        <div className="hidden md:block font-mono text-xs text-slate-400 border-l border-slate-800 pl-4">
          {currentTime}
        </div>

        {/* Admin Identity */}
        <div className="flex items-center gap-2.5 border-l border-slate-800 pl-4">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs shadow-inner">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-200">MySQL Administrator</div>
            <div className="text-[10px] text-slate-400 font-mono">@{adminUsername || 'unknown'}</div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Sign out of Admin Console"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all flex items-center gap-1.5 text-xs font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
