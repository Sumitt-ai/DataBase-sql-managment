import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CreateDatabaseModal } from './CreateDatabaseModal';
import { AssignDatabaseModal } from './AssignDatabaseModal';
import {
  Database,
  Plus,
  Link2,
  Trash2,
  HardDrive,
  Table,
  Users,
  Search,
  KeyRound,
  ShieldCheck,
  Check
} from 'lucide-react';

export const DatabaseList = () => {
  const { databases, users, deleteDatabase } = useApp();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [assignDbTarget, setAssignDbTarget] = useState(null); // string dbName or null
  const [deletingDb, setDeletingDb] = useState(null);

  const filteredDbs = databases.filter((db) =>
    db.name.toLowerCase().includes(search.toLowerCase())
  );

  const confirmDeleteDb = (dbName) => {
    if (
      window.confirm(
        `Are you sure you want to drop database '${dbName}' from MySQL Server? A safety backup will be logged before dropping.`
      )
    ) {
      deleteDatabase(dbName);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search databases by schema name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setAssignDbTarget('')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Assign Database</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Database</span>
          </button>
        </div>
      </div>

      {/* Database Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDbs.map((db) => {
          // Find users assigned to this database
          const assignedUserObjects = users.filter(
            (u) => u.assignedDatabase === db.name
          );

          return (
            <div
              key={db.id}
              className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 shadow-xl backdrop-blur transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-mono font-bold text-slate-100 text-sm">
                        {db.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {db.charset} • {db.collation}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => confirmDeleteDb(db.name)}
                    title="Drop database from MySQL"
                    className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Details Metrics */}
                <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{db.sizeMb} MB</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Table className="w-3.5 h-3.5 text-blue-400" />
                    <span>{db.tablesCount} Tables</span>
                  </div>
                </div>

                {/* Assigned Users list */}
                <div className="space-y-1.5 my-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span>Assigned Users ({assignedUserObjects.length})</span>
                    </span>
                  </div>

                  {assignedUserObjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedUserObjects.map((u) => (
                        <span
                          key={u.id}
                          className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[10px] flex items-center gap-1"
                        >
                          <span>@{u.username}</span>
                          <span className="text-cyan-400 text-[9px] font-semibold">
                            ({u.permissions.split(' ')[0]})
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      No user assigned yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Action footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-mono">
                  Created {db.createdAt.split(' ')[0]}
                </span>
                <button
                  onClick={() => setAssignDbTarget(db.name)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
                >
                  <Link2 className="w-3 h-3" />
                  <span>Assign User</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Database Modal */}
      <CreateDatabaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Assign Database Modal */}
      <AssignDatabaseModal
        isOpen={assignDbTarget !== null}
        onClose={() => setAssignDbTarget(null)}
        defaultDbName={assignDbTarget || ''}
      />
    </div>
  );
};

