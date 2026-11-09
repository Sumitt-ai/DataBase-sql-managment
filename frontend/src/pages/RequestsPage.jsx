import React from 'react';
import { RequestTable } from '../components/requests/RequestTable';
import { GitPullRequest } from 'lucide-react';

export const RequestsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <GitPullRequest className="w-4 h-4" />
            <span>Schema Provisioning Approvals</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Database Creation Requests
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review user-submitted database creation requests. Approved requests trigger automatic database provisioning.
          </p>
        </div>
      </div>

      <RequestTable />
    </div>
  );
};

