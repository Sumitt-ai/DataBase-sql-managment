import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { Database, Link2, Shield, AlertCircle } from 'lucide-react';

export const AssignDatabaseModal = ({ isOpen, onClose, defaultDbName = '' }) => {
  const { databases, users, assignDatabaseToUser } = useApp();

  const [selectedDb, setSelectedDb] = useState(defaultDbName || (databases[0]?.name || ''));
  const [selectedUsername, setSelectedUsername] = useState(users[0]?.username || '');
  const [permissions, setPermissions] = useState('READ & WRITE');
  const [error, setError] = useState('');

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedDb) {
      setError('Please select a database.');
      return;
    }
    if (!selectedUsername) {
      setError('Please select a user to assign.');
      return;
    }

    try {
      assignDatabaseToUser(selectedDb, selectedUsername, permissions);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to assign database.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-cyan-400" />
          <span>Assign Database to User</span>
        </div>
      }
      subtitle="Connect a MySQL user account to an existing database schema"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Database Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Select Database
          </label>
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-500"
          >
            {databases.map((db) => (
              <option key={db.id} value={db.name}>
                {db.name} ({db.tablesCount} tables • {db.sizeMb} MB)
              </option>
            ))}
          </select>
        </div>

        {/* User Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Select User Account
          </label>
          <select
            value={selectedUsername}
            onChange={(e) => setSelectedUsername(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-500"
          >
            {users.map((u) => (
              <option key={u.id} value={u.username}>
                @{u.username} ({u.fullName})
              </option>
            ))}
          </select>
        </div>

        {/* Permissions */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Permission Level
          </label>
          <select
            value={permissions}
            onChange={(e) => setPermissions(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="READ & WRITE">READ & WRITE (SELECT, INSERT, UPDATE, DELETE)</option>
            <option value="READ ONLY">READ ONLY (SELECT)</option>
            <option value="WRITE ONLY">WRITE ONLY (INSERT, UPDATE, DELETE)</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20"
          >
            Assign Database
          </button>
        </div>
      </form>
    </Modal>
  );
};

