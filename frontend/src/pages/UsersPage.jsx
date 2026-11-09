import React from 'react';
import { UserTable } from '../components/users/UserTable';
import { Users } from 'lucide-react';

export const UsersPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Identity & Access Control</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            MySQL User Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage user credentials, database ownership, permission tiers, and account activation.
          </p>
        </div>
      </div>

      <UserTable />
    </div>
  );
};

