import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { History, ArrowRight } from 'lucide-react';

export const RecentActivityWidget = () => {
  const { activities = [], setCurrentTab } = useApp();
  const recent = Array.isArray(activities) ? activities.slice(0, 5) : [];

  const getActivityColor = (type = '') => {
    const t = String(type || '');
    if (t.includes('Created') || t.includes('Approved') || t.includes('Activated')) {
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
    if (t.includes('Deleted') || t.includes('Rejected') || t.includes('Deactivated')) {
      return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }
    return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Recent Activities
          </h3>
        </div>
        <button
          onClick={() => setCurrentTab('activity')}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {recent.map((act) => (
          <div
            key={act.id}
            className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/80 transition-all text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getActivityColor(
                    act.activityType || act.activity_type
                  )}`}
                >
                  {act.activityType || act.activity_type || 'Activity'}
                </span>
                <span className="font-mono text-slate-300 font-medium">
                  {act.target || 'System'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {act.details || ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] text-slate-400">
                {act.timestamp ? (act.timestamp.includes(' ') ? act.timestamp.split(' ')[1] : act.timestamp) : ''}
              </span>
              <div className="mt-1">
                <StatusBadge status={act.status || 'SUCCESS'} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

