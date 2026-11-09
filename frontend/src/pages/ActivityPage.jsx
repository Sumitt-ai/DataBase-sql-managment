import React from 'react';
import { ActivityTable } from '../components/activity/ActivityTable';
import { History } from 'lucide-react';

export const ActivityPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Audit Trail & Administrative History</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Activity Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of all administrative actions, authentication attempts, database changes, and permission edits.
          </p>
        </div>
      </div>

      <ActivityTable />
    </div>
  );
};

