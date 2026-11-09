import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge, PermissionBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  User,
  Database,
  Shield,
  FileText,
  AlertCircle
} from 'lucide-react';

export const RequestTable = () => {
  const { requests, approveRequest, rejectRequest } = useApp();

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filter, setFilter] = useState('ALL');

  const filteredRequests = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  const handleApprove = (reqId) => {
    approveRequest(reqId);
  };

  const handleOpenReject = (reqId) => {
    setRejectingId(reqId);
    setRejectionReason('Does not meet current database naming convention or capacity requirements.');
  };

  const handleConfirmReject = () => {
    if (rejectingId) {
      rejectRequest(rejectingId, rejectionReason);
      setRejectingId(null);
      setRejectionReason('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['ALL', 'Pending', 'Approved', 'Rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === status
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {status}
              {status === 'Pending' && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold rounded-full text-[10px]">
                  {requests.filter((r) => r.status === 'Pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Data Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Request ID</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Requested Database Name</th>
                <th className="py-3.5 px-4">Permissions</th>
                <th className="py-3.5 px-4">Request Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No database creation requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Request ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                      {req.id}
                    </td>

                    {/* Username */}
                    <td className="py-3.5 px-4 font-mono text-slate-200">
                      @{req.username}
                    </td>

                    {/* Requested Database Name */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-100">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{req.requestedDatabaseName}</span>
                      </span>
                    </td>

                    {/* Permissions */}
                    <td className="py-3.5 px-4">
                      <PermissionBadge permission={req.permissionRequested || 'READ & WRITE'} />
                    </td>

                    {/* Request Date */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {req.requestDate}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={req.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => setSelectedRequest(req)}
                          title="View Request Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Approve Request (only if Pending) */}
                        {req.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(req.id)}
                              title="Approve & Create Database on MySQL"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition text-xs font-semibold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => handleOpenReject(req.id)}
                              title="Reject Request"
                              className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition text-xs font-semibold"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Request Details Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-cyan-400" />
            <span>Request Details: <span className="font-mono text-cyan-400">{selectedRequest?.id}</span></span>
          </div>
        }
        subtitle="Review database creation specifications and ownership"
        maxWidth="max-w-lg"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Status</span>
                <StatusBadge status={selectedRequest.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400">Requester Username:</span>
                  <p className="font-mono font-semibold text-slate-200 mt-0.5">
                    @{selectedRequest.username}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Request Date:</span>
                  <p className="font-mono text-slate-200 mt-0.5">
                    {selectedRequest.requestDate}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Requested Database:</span>
                  <p className="font-mono font-semibold text-cyan-400 mt-0.5">
                    {selectedRequest.requestedDatabaseName}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Requested Permissions:</span>
                  <p className="mt-0.5">
                    <PermissionBadge permission={selectedRequest.permissionRequested || 'READ & WRITE'} />
                  </p>
                </div>
              </div>

              <div>
                <span className="text-slate-400">Business Purpose / Notes:</span>
                <p className="text-slate-300 mt-1 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  {selectedRequest.purpose || 'No description provided.'}
                </p>
              </div>

              {selectedRequest.rejectionReason && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="font-bold">Rejection Reason:</span>
                  <p className="mt-0.5">{selectedRequest.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Actions inside modal if pending */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
              {selectedRequest.status === 'Pending' && (
                <>
                  <button
                    onClick={() => {
                      handleOpenReject(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      handleApprove(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20"
                  >
                    Approve & Create Database
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={!!rejectingId}
        onClose={() => setRejectingId(null)}
        title="Reject Database Creation Request"
        subtitle="Provide a note explaining why this request cannot be approved"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Rejection Reason
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-xs text-slate-100 outline-none focus:border-rose-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => setRejectingId(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

