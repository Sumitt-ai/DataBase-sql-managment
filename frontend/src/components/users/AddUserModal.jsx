import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import {
  User,
  Database,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Server
} from 'lucide-react';

export const AddUserModal = ({ isOpen, onClose }) => {
  const { databases, users, addUser } = useApp();

  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: User Information
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Database Assignment (Option A or Option B)
  const [dbOption, setDbOption] = useState('existing'); // 'existing' | 'create_own'
  const [selectedDatabase, setSelectedDatabase] = useState(databases[0]?.name || '');
  const [requestedDatabaseName, setRequestedDatabaseName] = useState('');

  // Step 3: Database Permissions
  // 1. READ ONLY (SELECT)
  // 2. WRITE ONLY (INSERT, UPDATE, DELETE)
  // 3. READ & WRITE (SELECT, INSERT, UPDATE, DELETE)
  const [permissions, setPermissions] = useState('READ & WRITE');
  const [canCreateDb, setCanCreateDb] = useState(false);

  // Reset form
  const resetForm = () => {
    setStep(1);
    setFullName('');
    setUsername('');
    setPassword('');
    setDbOption('existing');
    setSelectedDatabase(databases[0]?.name || '');
    setRequestedDatabaseName('');
    setPermissions('READ & WRITE');
    setCanCreateDb(false);
    setError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Step 1 Validation
  const validateStep1 = () => {
    setError('');
    if (!fullName.trim()) {
      setError('Please enter the user\'s Full Name.');
      return false;
    }
    if (!username.trim()) {
      setError('Please choose a Username.');
      return false;
    }
    // Check duplicate username
    const exists = users.some(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (exists) {
      setError(`Username '${username.trim()}' is already taken by an existing user.`);
      return false;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    setError('');
    if (dbOption === 'existing') {
      if (!selectedDatabase) {
        setError('Please select an existing database.');
        return false;
      }
    } else {
      if (!requestedDatabaseName.trim()) {
        setError('Please enter the desired database name for the creation request.');
        return false;
      }
      // Check database name validity
      const dbExists = databases.some(
        (d) => d.name.toLowerCase() === requestedDatabaseName.trim().toLowerCase()
      );
      if (dbExists) {
        setError(`A database named '${requestedDatabaseName.trim()}' already exists on MySQL Server.`);
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setError('');
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => prev - 1);
  };

  // Step 5: Backend Processing
  const handleCreateUser = () => {
    setIsSubmitting(true);
    setError('');

    try {
      addUser({
        fullName,
        username,
        password,
        dbOption,
        selectedDatabase,
        requestedDatabaseName,
        permissions,
        canCreateDb
      });

      // Move to success step
      setStep(5);
    } catch (err) {
      setError(err.message || 'Failed to create user account.');
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    { num: 1, title: 'User Information', desc: 'Personal details & authentication' },
    { num: 2, title: 'Database Assignment', desc: 'Select existing or request new' },
    { num: 3, title: 'Database Permissions', desc: 'Configure MySQL privilege tiers' },
    { num: 4, title: 'Review Details', desc: 'Verify before provisioning' },
    { num: 5, title: 'Provisioned', desc: 'User created successfully' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <User className="w-5 h-5" />
          </div>
          <span>Add New MySQL User</span>
        </div>
      }
      subtitle="Complete the guided 5-step workflow to provision a database account"
      maxWidth="max-w-2xl"
    >
      {/* Progress Stepper */}
      {step < 5 && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {stepTitles.slice(0, 4).map((s) => (
              <div key={s.num} className="flex-1 flex flex-col items-center relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all ${
                    step === s.num
                      ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20 shadow-lg shadow-cyan-500/30'
                      : step > s.num
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {step > s.num ? <Check className="w-4 h-4 stroke-[3]" /> : s.num}
                </div>
                <span
                  className={`text-[11px] font-semibold mt-1.5 hidden sm:block ${
                    step === s.num ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-2">
            <div className="absolute top-0 left-0 h-1 bg-slate-800 w-full rounded-full"></div>
            <div
              className="absolute top-0 left-0 h-1 bg-cyan-500 rounded-full transition-all duration-300"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: USER INFORMATION */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              MySQL Username <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. jdoe_dev"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-slate-100 font-mono placeholder-slate-500 outline-none transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Must be unique. Allowed characters: lowercase letters, numbers, and underscores.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-950/70 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div
                className={`h-1 flex-1 rounded-full ${
                  password.length > 8
                    ? 'bg-emerald-500'
                    : password.length >= 6
                    ? 'bg-amber-500'
                    : 'bg-slate-700'
                }`}
              />
              <span className="text-[10px] text-slate-400 font-mono">
                {password.length > 8 ? 'Strong' : password.length >= 6 ? 'Fair' : 'Too short'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: DATABASE ASSIGNMENT */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <div className="text-xs text-slate-300 mb-2">
            Choose how the database should be assigned to this user:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* OPTION A */}
            <div
              onClick={() => setDbOption('existing')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                dbOption === 'existing'
                  ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name="dbOption"
                  checked={dbOption === 'existing'}
                  onChange={() => setDbOption('existing')}
                  className="accent-cyan-500"
                />
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Option A: Assign Existing Database
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Assign an existing MySQL database on the server immediately to the user.
              </p>
            </div>

            {/* OPTION B */}
            <div
              onClick={() => setDbOption('create_own')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                dbOption === 'create_own'
                  ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name="dbOption"
                  checked={dbOption === 'create_own'}
                  onChange={() => setDbOption('create_own')}
                  className="accent-cyan-500"
                />
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Option B: User Creates Own Database
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Submit a new database creation request that requires master administrator approval.
              </p>
            </div>
          </div>

          {/* Conditional Input based on selection */}
          {dbOption === 'existing' ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 mt-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Select Available MySQL Database <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 font-mono outline-none focus:border-cyan-500"
              >
                {databases.map((db) => (
                  <option key={db.id} value={db.name}>
                    {db.name} ({db.tablesCount} tables • {db.sizeMb} MB)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-2">
                User will receive access to this database once created.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Requested Database Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. analytics_staging"
                  value={requestedDatabaseName}
                  onChange={(e) =>
                    setRequestedDatabaseName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    )
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 font-mono outline-none focus:border-cyan-500 placeholder-slate-500"
                />
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Admin Approval Required</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Database creation will be queued in the <strong>Database Requests</strong> panel. Once approved, FastAPI creates the database on MySQL Server and provisions full permissions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: ASSIGN DATABASE PERMISSIONS */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <div className="text-xs text-slate-300 mb-1">
            Select the MySQL privilege tier to assign to this account:
          </div>

          <div className="space-y-2.5">
            {/* 1. READ ONLY */}
            <div
              onClick={() => setPermissions('READ ONLY')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                permissions === 'READ ONLY'
                  ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="permissions"
                    checked={permissions === 'READ ONLY'}
                    onChange={() => setPermissions('READ ONLY')}
                    className="accent-blue-500"
                  />
                  <span className="text-sm font-bold text-blue-300">READ ONLY</span>
                </div>
                <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                  SELECT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 pl-6">
                User can query tables and view data, but cannot modify, insert, or delete any records.
              </p>
            </div>

            {/* 2. WRITE ONLY */}
            <div
              onClick={() => setPermissions('WRITE ONLY')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                permissions === 'WRITE ONLY'
                  ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="permissions"
                    checked={permissions === 'WRITE ONLY'}
                    onChange={() => setPermissions('WRITE ONLY')}
                    className="accent-purple-500"
                  />
                  <span className="text-sm font-bold text-purple-300">WRITE ONLY</span>
                </div>
                <span className="font-mono text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                  INSERT, UPDATE, DELETE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 pl-6">
                User can insert, modify, and delete rows, but has no SELECT privilege on the tables.
              </p>
            </div>

            {/* 3. READ & WRITE */}
            <div
              onClick={() => setPermissions('READ & WRITE')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                permissions === 'READ & WRITE'
                  ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="permissions"
                    checked={permissions === 'READ & WRITE'}
                    onChange={() => setPermissions('READ & WRITE')}
                    className="accent-cyan-500"
                  />
                  <span className="text-sm font-bold text-cyan-300">READ & WRITE</span>
                </div>
                <span className="font-mono text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                  SELECT, INSERT, UPDATE, DELETE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 pl-6">
                Full DML access: User can query, insert, update, and delete table data.
              </p>
            </div>
          </div>

          {/* Database Creation Privilege (Managed Separately per Section 6) */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200">
                  Database Creation Privilege (CREATE DATABASE)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Allows user to run <code>CREATE DATABASE</code> directly on MySQL. Managed separately from DML permissions.
                </p>
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
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW DETAILS */}
      {step === 4 && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
              Provisioning Summary Review
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Full Name:</span>
                <p className="font-semibold text-slate-100 mt-0.5">{fullName}</p>
              </div>
              <div>
                <span className="text-slate-400">MySQL Username:</span>
                <p className="font-mono font-semibold text-cyan-300 mt-0.5">{username}</p>
              </div>
              <div>
                <span className="text-slate-400">Database Assignment:</span>
                <p className="font-mono font-semibold text-slate-100 mt-0.5">
                  {dbOption === 'existing'
                    ? selectedDatabase
                    : `Requesting '${requestedDatabaseName}'`}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Permission Level:</span>
                <p className="font-semibold text-emerald-400 mt-0.5">{permissions}</p>
              </div>
              <div>
                <span className="text-slate-400">Database Creation Privilege:</span>
                <p className="font-semibold text-slate-100 mt-0.5">
                  {canCreateDb ? (
                    <span className="text-emerald-400">GRANTED</span>
                  ) : (
                    <span className="text-slate-400">RESTRICTED (Admin Approval Only)</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Initial Account Status:</span>
                <p className="font-semibold text-emerald-400 mt-0.5">Active</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Clicking <strong>Create User</strong> will execute the account provisioning workflow and record this action in the Activity Log.
            </span>
          </div>
        </div>
      )}

      {/* STEP 5: BACKEND PROCESSED / SUCCESS */}
      {step === 5 && (
        <div className="py-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              User Account Successfully Created!
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Account <strong>@{username}</strong> has been provisioned on the MySQL Server. Database privileges and activity logs have been recorded.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 max-w-sm mx-auto text-left text-xs font-mono space-y-1">
            <div className="text-slate-400">Username: <span className="text-slate-200">@{username}</span></div>
            <div className="text-slate-400">Assigned DB: <span className="text-cyan-300">{dbOption === 'existing' ? selectedDatabase : requestedDatabaseName + ' (Pending approval)'}</span></div>
            <div className="text-slate-400">Permissions: <span className="text-emerald-400">{permissions}</span></div>
          </div>

          <button
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20"
          >
            Done & Return to Users
          </button>
        </div>
      )}

      {/* Action Buttons for Steps 1-4 */}
      {step < 5 && (
        <div className="flex items-center justify-between pt-5 mt-6 border-t border-slate-800">
          {step > 1 ? (
            <button
              onClick={prevStep}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={nextStep}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleCreateUser}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              {isSubmitting ? (
                <span>Provisioning...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Create User</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
};

