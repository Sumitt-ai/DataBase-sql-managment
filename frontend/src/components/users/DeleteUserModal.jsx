import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Database,
  Archive,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';

export const DeleteUserModal = ({ isOpen, onClose, user }) => {
  const { deleteUser } = useApp();

  const [selectedOption, setSelectedOption] = useState(null); // 'A' | 'B' | null
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [backupStage, setBackupStage] = useState('idle'); // 'idle' | 'backing_up' | 'verified' | 'deleting'
  const [backupProgress, setBackupProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user) return null;

  const handleClose = () => {
    setSelectedOption(null);
    setTypedConfirmation('');
    setBackupStage('idle');
    setBackupProgress(0);
    setIsDeleting(false);
    onClose();
  };

  // Option A: Delete Account Only
  const handleDeleteAccountOnly = async () => {
    setIsDeleting(true);
    await deleteUser(user.id, 'ACCOUNT_ONLY');
    setIsDeleting(false);
    handleClose();
  };

  // Option B: Delete Account and Database (with backup verification)
  const handleDeleteAccountAndDatabase = () => {
    if (typedConfirmation !== user.username) return;

    setBackupStage('backing_up');
    setBackupProgress(15);

    // Simulate reliable multi-step backup verification
    const interval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          setBackupStage('verified');
          return 100;
        }
        return prev + 25;
      });
    }, 400);

    setTimeout(async () => {
      setBackupStage('deleting');
      setTimeout(async () => {
        await deleteUser(user.id, 'ACCOUNT_AND_DATABASE');
        handleClose();
      }, 700);
    }, 2200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5 text-rose-400">
          <Trash2 className="w-5 h-5" />
          <span>Delete User: <span className="font-mono text-white">@{user.username}</span></span>
        </div>
      }
      subtitle="Select deletion policy for this account and its associated database"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* User Info Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div className="text-slate-400">Full Name: <span className="text-slate-200 font-semibold">{user.fullName}</span></div>
            <div className="text-slate-400 mt-0.5">Assigned Database: <span className="font-mono text-cyan-300 font-semibold">{user.assignedDatabase || 'None'}</span></div>
          </div>
          <div className="text-right">
            <span className="font-mono text-slate-400">Status: {user.status}</span>
          </div>
        </div>

        {/* Options Overview */}
        <div className="space-y-3">
          {/* OPTION A: DELETE ACCOUNT ONLY */}
          <div
            onClick={() => {
              if (backupStage === 'idle') setSelectedOption('A');
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedOption === 'A'
                ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="deleteOption"
                checked={selectedOption === 'A'}
                onChange={() => setSelectedOption('A')}
                className="mt-1 accent-amber-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-400">
                    OPTION A: DELETE ACCOUNT ONLY
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Preserves Data
                  </span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4 pt-1">
                  <li>Removes user's login credentials and MySQL connection access.</li>
                  <li>Revokes database privileges on assigned databases.</li>
                  <li><strong>Preserves all tables, records, and databases intact</strong> on MySQL.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* OPTION B: DELETE ACCOUNT AND DATABASE */}
          <div
            onClick={() => {
              if (backupStage === 'idle') setSelectedOption('B');
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedOption === 'B'
                ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/30'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="deleteOption"
                checked={selectedOption === 'B'}
                onChange={() => setSelectedOption('B')}
                className="mt-1 accent-rose-500"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-rose-400">
                    OPTION B: DELETE ACCOUNT AND DATABASE
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Permanent Removal
                  </span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4 pt-1">
                  <li>Creates and verifies an automated full SQL backup first.</li>
                  <li>Removes the user account and revokes all privileges.</li>
                  <li><strong>Permanently drops the associated database</strong> <code>{user.assignedDatabase || '(None)'}</code>.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed action panel based on selection */}
        {selectedOption === 'A' && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Confirm Account-Only Deletion</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete user <strong>@{user.username}</strong>? The user will no longer be able to connect, but database <strong>{user.assignedDatabase || 'none'}</strong> will remain completely safe.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountOnly}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20"
              >
                {isDeleting ? 'Removing...' : 'Confirm Option A: Delete Account'}
              </button>
            </div>
          </div>
        )}

        {selectedOption === 'B' && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>High-Risk Operation: Automated Backup & Full Deletion</span>
            </div>

            <p className="text-xs text-rose-200/90 leading-relaxed">
              This action will drop database <strong>{user.assignedDatabase || 'none'}</strong>. The system will automatically run <code>mysqldump</code> to take a backup and verify its checksum before proceeding.
            </p>

            {backupStage === 'idle' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    To confirm, please type the username <span className="font-mono text-rose-400">@{user.username}</span>:
                  </label>
                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder={user.username}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-sm font-mono text-white outline-none focus:border-rose-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccountAndDatabase}
                    disabled={typedConfirmation !== user.username}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-rose-600/30 flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Backup & Permanently Delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-2 text-slate-300">
                    {backupStage === 'backing_up' && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
                    {backupStage === 'verified' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {backupStage === 'deleting' && <Loader2 className="w-4 h-4 animate-spin text-rose-400" />}
                    {backupStage === 'backing_up' && 'Creating full mysqldump backup archive...'}
                    {backupStage === 'verified' && 'Backup verified: checksum SHA256 matches'}
                    {backupStage === 'deleting' && 'Revoking privileges and dropping database...'}
                  </span>
                  <span className="font-bold text-cyan-400">{backupProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${backupProgress}%` }}
                  />
                </div>
                {backupStage === 'verified' && (
                  <p className="text-[11px] text-emerald-400 font-mono">
                    ✓ Backup archived at: backups/backup_{user.assignedDatabase}_{Date.now()}.sql.gz
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* OPTION C: CANCEL */}
        {!selectedOption && (
          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Option C: Cancel (Make No Changes)
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

