import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/dashboard/StatCard';
import { RecentActivityWidget } from '../components/dashboard/RecentActivityWidget';
import { AddUserModal } from '../components/users/AddUserModal';
import { CreateDatabaseModal } from '../components/databases/CreateDatabaseModal';
import {
  Users,
  UserCheck,
  UserX,
  Database,
  GitPullRequest,
  UserPlus,
  Plus,
  HardDrive,
  ShieldCheck,
  Server,
  ArrowRight,
  TrendingUp,
  Activity
} from 'lucide-react';

export const DashboardPage = () => {
  const { users = [], databases = [], requests = [], settings = {}, setCurrentTab } = useApp();

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isCreateDbOpen, setIsCreateDbOpen] = useState(false);

  const safeUsers = Array.isArray(users) ? users : [];
  const safeDatabases = Array.isArray(databases) ? databases : [];
  const safeRequests = Array.isArray(requests) ? requests : [];

  const totalUsers = safeUsers.length;
  const activeUsers = safeUsers.filter((u) => u && u.status === 'Active').length;
  const inactiveUsers = safeUsers.filter((u) => u && u.status === 'Inactive').length;
  const totalDatabases = safeDatabases.length;
  const pendingRequests = safeRequests.filter((r) => r && r.status === 'Pending').length;

  const totalStorageMb = safeDatabases
    .reduce((acc, db) => acc + (parseFloat(db?.sizeMb) || 0), 0)
    .toFixed(1);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl backdrop-blur relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Activity className="w-4 h-4" />
              <span>Admin Console Active</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              MySQL Administration Overview
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Managing user privileges, isolated databases, schema provisioning, and creation requests on local server MySQL 8.0.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCreateDbOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-2"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span>New Database</span>
            </button>

            <button
              onClick={() => setIsAddUserOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/25 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {/* Ambient glow accent */}
        <div className="absolute right-0 top-0 w-80 h-full bg-cyan-500/5 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stat Cards (Section 4 Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Users */}
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          color="cyan"
          subtitle="Registered accounts"
          onClick={() => setCurrentTab('users')}
        />

        {/* Active Users */}
        <StatCard
          title="Active Users"
          value={activeUsers}
          icon={UserCheck}
          color="emerald"
          subtitle="Login privileges enabled"
          onClick={() => setCurrentTab('users')}
        />

        {/* Inactive Users */}
        <StatCard
          title="Inactive Users"
          value={inactiveUsers}
          icon={UserX}
          color="rose"
          subtitle="Access suspended"
          onClick={() => setCurrentTab('users')}
        />

        {/* Total Databases */}
        <StatCard
          title="Total Databases"
          value={totalDatabases}
          icon={Database}
          color="blue"
          subtitle={`${totalStorageMb} MB allocated`}
          onClick={() => setCurrentTab('databases')}
        />

        {/* Pending Database Requests */}
        <StatCard
          title="Pending Requests"
          value={pendingRequests}
          icon={GitPullRequest}
          color={pendingRequests > 0 ? 'amber' : 'cyan'}
          subtitle={pendingRequests > 0 ? 'Requires admin action' : 'All caught up'}
          onClick={() => setCurrentTab('requests')}
        />
      </div>

      {/* Main Grid: Databases Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Databases by Size / Allocation */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Database Allocation
                </h3>
              </div>
              <button
                onClick={() => setCurrentTab('databases')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {safeDatabases.slice(0, 5).map((db) => {
                const size = parseFloat(db?.sizeMb) || 0;
                const percentage = Math.min(100, Math.round((size / 1500) * 100));
                return (
                  <div key={db?.id || db?.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-semibold text-slate-200">
                        {db?.name || 'database'}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {size} MB ({db?.tablesCount || 0} tables)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>MySQL 8.0 Engine</span>
            <span>Total: {totalStorageMb} MB</span>
          </div>
        </div>

        {/* Recent Activities Widget (2 columns) */}
        <div className="lg:col-span-2">
          <RecentActivityWidget />
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
      />

      {/* Create Database Modal */}
      <CreateDatabaseModal
        isOpen={isCreateDbOpen}
        onClose={() => setIsCreateDbOpen(false)}
      />
    </div>
  );
};

