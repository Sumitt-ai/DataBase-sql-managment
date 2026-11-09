import React from 'react';
import { DatabaseList } from '../components/databases/DatabaseList';
import { Database } from 'lucide-react';

export const DatabasesPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            <span>Schema Storage & Ownership</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Database Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            View all databases on MySQL Server, create isolated schemas, and assign database ownership.
          </p>
        </div>
      </div>

      <DatabaseList />
    </div>
  );
};

