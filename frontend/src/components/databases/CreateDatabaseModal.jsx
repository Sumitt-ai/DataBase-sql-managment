import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { Database, Plus, AlertCircle } from 'lucide-react';

export const CreateDatabaseModal = ({ isOpen, onClose }) => {
  const { createDatabase, users } = useApp();

  const [name, setName] = useState('');
  const [charset, setCharset] = useState('utf8mb4');
  const [collation, setCollation] = useState('utf8mb4_unicode_ci');
  const [assignedUsername, setAssignedUsername] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setName('');
    setCharset('utf8mb4');
    setCollation('utf8mb4_unicode_ci');
    setAssignedUsername('');
    setError('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a database name.');
      return;
    }

    try {
      createDatabase({
        name: name.trim(),
        charset,
        collation,
        assignedUsername: assignedUsername || null
      });
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to create database.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" />
          <span>Create New MySQL Database</span>
        </div>
      }
      subtitle="Provision an isolated database schema on MySQL Server"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Database Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Database Schema Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. ecommerce_v2"
            value={name}
            onChange={(e) =>
              setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-sm font-mono text-slate-100 outline-none transition placeholder-slate-500"
            required
            autoFocus
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Allowed: lowercase letters, numbers, and underscores.
          </p>
        </div>

        {/* Charset & Collation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Character Set
            </label>
            <select
              value={charset}
              onChange={(e) => setCharset(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="utf8mb4">utf8mb4 (Recommended)</option>
              <option value="utf8">utf8</option>
              <option value="latin1">latin1</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Collation
            </label>
            <select
              value={collation}
              onChange={(e) => setCollation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
              <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
              <option value="utf8mb4_0900_ai_ci">utf8mb4_0900_ai_ci</option>
            </select>
          </div>
        </div>

        {/* Initial Assigned User */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Initial Assigned User (Optional)
          </label>
          <select
            value={assignedUsername}
            onChange={(e) => setAssignedUsername(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm font-mono text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="">-- No User Assigned Yet --</option>
            {users.map((u) => (
              <option key={u.id} value={u.username}>
                @{u.username} ({u.fullName})
              </option>
            ))}
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
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Database</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

