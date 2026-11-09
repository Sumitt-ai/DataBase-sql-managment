import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { UserCheck, KeyRound, Database, Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const EditUserModal = ({ isOpen, onClose, user }) => {
  const { databases, editUser } = useApp();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [assignedDatabase, setAssignedDatabase] = useState('');
  const [permissions, setPermissions] = useState('READ & WRITE');
  const [canCreateDb, setCanCreateDb] = useState(false);
  const [status, setStatus] = useState('Active');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPassword('');
      setAssignedDatabase(user.assignedDatabase || '');
      setPermissions(user.permissions || 'READ & WRITE');
      setCanCreateDb(!!user.canCreateDb);
      setStatus(user.status || 'Active');
      setError('');
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    try {
      editUser(user.id, {
        fullName: fullName.trim(),
        assignedDatabase: assignedDatabase || null,
        permissions,
        canCreateDb,
        status,
        ...(password.trim() ? { password: password.trim() } : {})
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update user.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-cyan-400" />
          <span>Edit MySQL User: <span className="font-mono text-cyan-400">@{user.username}</span></span>
        </div>
      }
      subtitle="Modify user details, database assignments, and permission level"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Full Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-sm text-slate-100 outline-none transition"
            required
          />
        </div>

        {/* Change Password (Optional) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            New Password <span className="text-slate-400 font-normal lowercase">(leave blank to keep current)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password if changing"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-sm text-slate-100 outline-none transition placeholder-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Assigned Database */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Assigned Database
          </label>
          <select
            value={assignedDatabase}
            onChange={(e) => setAssignedDatabase(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm text-slate-100 font-mono outline-none focus:border-cyan-500"
          >
            <option value="">-- No Database Assigned --</option>
            {databases.map((db) => (
              <option key={db.id} value={db.name}>
                {db.name} ({db.tablesCount} tables • {db.sizeMb} MB)
              </option>
            ))}
          </select>
        </div>

        {/* Permissions */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Database Permissions
          </label>
          <select
            value={permissions}
            onChange={(e) => setPermissions(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="READ ONLY">READ ONLY (SELECT)</option>
            <option value="WRITE ONLY">WRITE ONLY (INSERT, UPDATE, DELETE)</option>
            <option value="READ & WRITE">READ & WRITE (SELECT, INSERT, UPDATE, DELETE)</option>
          </select>
        </div>

        {/* Database Creation Privilege */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              Database Creation Privilege
            </div>
            <div className="text-[11px] text-slate-400">
              Grant direct CREATE DATABASE capability
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={canCreateDb}
              onChange={(e) => setCanCreateDb(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>

        {/* Account Status */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Account Status
          </label>
          <div className="flex gap-3">
            <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950/40 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Active"
                checked={status === 'Active'}
                onChange={() => setStatus('Active')}
                className="accent-emerald-500"
              />
              <span className="text-xs font-semibold text-emerald-400">Active</span>
            </label>
            <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950/40 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="Inactive"
                checked={status === 'Inactive'}
                onChange={() => setStatus('Inactive')}
                className="accent-rose-500"
              />
              <span className="text-xs font-semibold text-rose-400">Inactive</span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};

