import React from 'react';

export const StatusBadge = ({ status }) => {
  const isOk = status === 'Active' || status === 'Approved' || status === 'SUCCESS';
  const isPending = status === 'Pending';
  const isDanger = status === 'Inactive' || status === 'Rejected' || status === 'FAILED';

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  if (isOk) {
    colorClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (isPending) {
    colorClasses = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  } else if (isDanger) {
    colorClasses = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOk ? 'bg-emerald-400' : isPending ? 'bg-amber-400' : 'bg-rose-400'}`} />
      {status}
    </span>
  );
};

export const PermissionBadge = ({ permission }) => {
  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';

  if (permission === 'READ & WRITE') {
    badgeStyle = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  } else if (permission === 'READ ONLY') {
    badgeStyle = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  } else if (permission === 'WRITE ONLY') {
    badgeStyle = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium border ${badgeStyle}`}>
      {permission}
    </span>
  );
};

