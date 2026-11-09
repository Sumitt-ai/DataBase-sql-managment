import React from 'react';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { Settings } from 'lucide-react';

export const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>Server Parameters & Security</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            System & Console Settings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure server IP binding, port numbers, MySQL connectivity, and system settings. Admin sign-in uses MySQL accounts with global privileges.
          </p>
        </div>
      </div>

      <SettingsPanel />
    </div>
  );
};

