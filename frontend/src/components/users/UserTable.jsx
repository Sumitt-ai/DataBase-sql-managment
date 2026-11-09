import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge, PermissionBadge } from '../common/Badge';
import { AddUserModal } from './AddUserModal';
import { EditUserModal } from './EditUserModal';
import { DeleteUserModal } from './DeleteUserModal';
import {
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Power,
  Database,
  Shield,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';

export const UserTable = () => {
  const { users, toggleUserStatus } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [permissionFilter, setPermissionFilter] = useState('ALL');
  const [sortField, setSortField] = useState('createdAt');
  const [sortAsc, setSortAsc] = useState(false);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  // Filtering and Sorting
  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => {
        // Search query filter
        const matchSearch =
          user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.assignedDatabase &&
            user.assignedDatabase.toLowerCase().includes(searchQuery.toLowerCase()));

        // Status filter
        const matchStatus =
          statusFilter === 'ALL' || user.status === statusFilter;

        // Permission filter
        const matchPermission =
          permissionFilter === 'ALL' || user.permissions === permissionFilter;

        return matchSearch && matchStatus && matchPermission;
      })
      .sort((a, b) => {
        let fieldA = a[sortField] || '';
        let fieldB = b[sortField] || '';
        if (typeof fieldA === 'string') {
          return sortAsc
            ? fieldA.localeCompare(fieldB)
            : fieldB.localeCompare(fieldA);
        }
        return sortAsc ? fieldA - fieldB : fieldB - fieldA;
      });
  }, [users, searchQuery, statusFilter, permissionFilter, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Search, Filters, Add User Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by full name, username, or database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Filter Dropdowns and Actions */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          {/* Permission filter */}
          <select
            value={permissionFilter}
            onChange={(e) => setPermissionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Permissions</option>
            <option value="READ ONLY">Read Only</option>
            <option value="WRITE ONLY">Write Only</option>
            <option value="READ & WRITE">Read & Write</option>
          </select>

          {/* Add New User Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => toggleSort('fullName')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Full Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('username')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Username</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Assigned Database</th>
                <th className="py-3.5 px-4">Permissions</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th
                  onClick={() => toggleSort('createdAt')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Created Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Full Name */}
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {user.fullName}
                      {user.canCreateDb && (
                        <span
                          title="User holds direct CREATE DATABASE privilege"
                          className="ml-2 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                        >
                          DB_CREATOR
                        </span>
                      )}
                    </td>

                    {/* Username */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-cyan-400">
                      @{user.username}
                    </td>

                    {/* Assigned Database */}
                    <td className="py-3.5 px-4 font-mono">
                      {user.assignedDatabase ? (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Database className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{user.assignedDatabase}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>

                    {/* Permissions */}
                    <td className="py-3.5 px-4">
                      <PermissionBadge permission={user.permissions} />
                    </td>

                    {/* Account Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={user.status} />
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {user.createdAt}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Status (Activate / Deactivate) */}
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          title={
                            user.status === 'Active'
                              ? 'Deactivate User'
                              : 'Activate User'
                          }
                          className={`p-1.5 rounded-lg border transition ${
                            user.status === 'Active'
                              ? 'text-emerald-400 hover:text-amber-400 hover:bg-amber-500/10 border-transparent hover:border-amber-500/20'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border-transparent hover:border-emerald-500/20'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        {/* Edit User */}
                        <button
                          onClick={() => setEditingUser(user)}
                          title="Edit User"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete User (Special 3-Option Modal) */}
                        <button
                          onClick={() => setDeletingUser(user)}
                          title="Delete User"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
      />

      {/* Delete User Modal */}
      <DeleteUserModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        user={deletingUser}
      />
    </div>
  );
};

