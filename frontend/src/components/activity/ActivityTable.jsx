import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Shield,
  Server,
  ArrowUpDown
} from 'lucide-react';

export const ActivityTable = () => {
  const { activities } = useApp();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const activityTypes = [
    'ALL',
    'Admin Login',
    'User Created',
    'User Updated',
    'User Activated',
    'User Deactivated',
    'User Deleted',
    'Database Created',
    'Database Assigned',
    'Database Request Approved',
    'Database Request Rejected',
    'Permissions Changed',
    'Database Deleted'
  ];

  const filteredActivities = useMemo(() => {
    return (activities || []).filter((act) => {
      const targetStr = String(act.target || '');
      const detailsStr = String(act.details || '');
      const performedByStr = String(act.performedBy || act.performed_by || '');
      const typeStr = String(act.activityType || act.activity_type || '');

      const matchSearch =
        targetStr.toLowerCase().includes(search.toLowerCase()) ||
        detailsStr.toLowerCase().includes(search.toLowerCase()) ||
        performedByStr.toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === 'ALL' || typeStr === typeFilter;

      return matchSearch && matchType;
    });
  }, [activities, search, typeFilter]);

  const exportCsv = () => {
    const headers = ['Timestamp', 'Activity Type', 'Performed By', 'Target', 'IP Address', 'Details', 'Status'];
    const rows = filteredActivities.map((a) => [
      `"${a.timestamp}"`,
      `"${a.activityType}"`,
      `"${a.performedBy}"`,
      `"${a.target}"`,
      `"${a.ipAddress}"`,
      `"${a.details.replace(/"/g, '""')}"`,
      `"${a.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mysql_admin_audit_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActivityBadgeColor = (type = '') => {
    const t = String(type || '');
    if (t.includes('Created') || t.includes('Approved') || t.includes('Activated')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (t.includes('Deleted') || t.includes('Rejected') || t.includes('Deactivated')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    }
    if (t.includes('Permissions') || t.includes('Assigned')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
    return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by target, user, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Filter and Export */}
        <div className="flex items-center gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            {activityTypes.map((t) => (
              <option key={t} value={t}>
                {t === 'ALL' ? 'All Activity Types' : t}
              </option>
            ))}
          </select>

          <button
            onClick={exportCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Activity Type</th>
                <th className="py-3.5 px-4">Performed By</th>
                <th className="py-3.5 px-4">Target Entity</th>
                <th className="py-3.5 px-4">Details</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    No matching activity logs recorded.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => (
                  <tr
                    key={act.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 text-slate-300 text-[11px] whitespace-nowrap">
                      {act.timestamp}
                    </td>

                    {/* Activity Type */}
                    <td className="py-3 px-4 font-sans whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getActivityBadgeColor(
                          act.activityType || act.activity_type
                        )}`}
                      >
                        {act.activityType || act.activity_type || 'General'}
                      </span>
                    </td>

                    {/* Performed By */}
                    <td className="py-3 px-4 text-slate-300">
                      @{act.performedBy || act.performed_by || 'admin'}
                    </td>

                    {/* Target Entity */}
                    <td className="py-3 px-4 text-cyan-300 font-semibold">
                      {act.target || 'System'}
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-slate-300 font-sans text-xs max-w-md truncate" title={act.details}>
                      {act.details || ''}
                    </td>

                    {/* IP Address */}
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {act.ipAddress || act.ip_address || '127.0.0.1'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-right font-sans">
                      <StatusBadge status={act.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

