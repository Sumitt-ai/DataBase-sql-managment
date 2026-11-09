/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react';
import { Activity, BriefcaseBusiness, Download, FileSpreadsheet, Plus, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/Badge';
import { DeleteUserModal } from '../components/users/DeleteUserModal';

const PERMISSION_OPTIONS = [
  ['upload', 'Upload files'],
  ['edit', 'Edit workbooks'],
  ['download', 'Download files'],
  ['recycle', 'Move files to recycle bin'],
  ['restore', 'Restore files'],
];

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';

export const ClientManagementPage = () => {
  const { addToast, users } = useApp();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [permissionClient, setPermissionClient] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      setClients(await api.getClients());
    } catch (err) {
      addToast(`Could not load client accounts: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const openDetails = async (client, view) => {
    setDetails({ client, view });
    setDetailRows([]);
    setDetailLoading(true);
    try {
      setDetailRows(view === 'files'
        ? await api.getAdminClientFiles(client.clientId)
        : await api.getAdminClientActivity(client.clientId));
    } catch (err) {
      addToast(`Could not load client ${view}: ${err.message}`, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleClient = async (client) => {
    try {
      await api.setClientStatus(client.clientId, !client.isActive);
      addToast(`Client @${client.username} ${client.isActive ? 'deactivated' : 'activated'}.`, 'success');
      await loadClients();
    } catch (err) {
      addToast(`Could not update client status: ${err.message}`, 'error');
    }
  };

  const removeClient = async (client) => {
    if (!window.confirm(`Remove @${client.username} from Client Management? Portal access will be revoked, but uploaded files and activity history will be preserved.`)) return;
    try {
      await api.removeClient(client.clientId);
      addToast(`Client Portal access removed for @${client.username}. Existing files and history were preserved.`, 'success');
      await loadClients();
    } catch (err) {
      addToast(`Could not remove client access: ${err.message}`, 'error');
    }
  };

  const openDeleteUser = (client) => {
    const user = users.find((entry) => entry.username.toLowerCase() === client.username.toLowerCase());
    if (!user) {
      addToast(`MySQL user @${client.username} was not found in User Management. Remove Client Portal access instead.`, 'error');
      return;
    }
    setUserToDelete(user);
  };

  const downloadFile = async (client, file) => {
    try {
      const { blob, filename } = await api.downloadAdminClientFile(client.clientId, file.fileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(`Could not download file: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <BriefcaseBusiness className="w-4 h-4" /><span>Client Access</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Client Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enable existing MySQL accounts to use the Client Portal and manage their file permissions and activity.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadClients} className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5"/>Refresh</button>
          <button onClick={() => setCreateOpen(true)} className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold inline-flex items-center gap-2"><Plus className="w-4 h-4"/>Enable Client Access</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]"><tr>
              <th className="px-4 py-3.5">Client</th><th className="px-4 py-3.5">Username</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Permissions</th><th className="px-4 py-3.5">Files</th><th className="px-4 py-3.5">Storage</th><th className="px-4 py-3.5">Created</th><th className="px-4 py-3.5 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? <tr><td colSpan={8} className="py-12 text-center text-slate-500">Loading client accounts…</td></tr>
                : clients.length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-slate-500">No Client Portal accounts yet.</td></tr>
                  : clients.map((client) => <tr key={client.clientId} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3.5 font-semibold text-slate-100">{client.clientName}</td>
                    <td className="px-4 py-3.5 font-mono text-cyan-300">@{client.username}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={client.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className="px-4 py-3.5 text-slate-400 max-w-52">{client.permissions?.length ? client.permissions.join(', ') : 'No permissions'}</td>
                    <td className="px-4 py-3.5 text-slate-300">{client.fileCount}</td>
                    <td className="px-4 py-3.5 text-slate-300">{formatBytes(client.storageBytes)}</td>
                    <td className="px-4 py-3.5 text-slate-500">{formatDate(client.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openDetails(client, 'files')} className="px-2 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40">Files</button>
                        <button onClick={() => openDetails(client, 'activity')} className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-cyan-300" title="View client activity"><Activity className="w-3.5 h-3.5"/></button>
                        <button onClick={() => setPermissionClient(client)} className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-cyan-300" title="Edit permissions"><ShieldCheck className="w-3.5 h-3.5"/></button>
                        <button onClick={() => toggleClient(client)} className={`px-2 py-1.5 rounded-lg border ${client.isActive ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'}`}>{client.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button onClick={() => removeClient(client)} className="px-2 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10">Remove Access</button>
                        <button onClick={() => openDeleteUser(client)} className="px-2 py-1.5 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">Delete User</button>
                      </div>
                    </td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <CreateClientModal clients={clients} isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadClients} />
      <ClientPermissionsModal client={permissionClient} onClose={() => setPermissionClient(null)} onSaved={loadClients} />
      <DeleteUserModal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} onDeleted={loadClients} user={userToDelete} />
      <Modal isOpen={!!details} onClose={() => setDetails(null)} title={<span>{details?.view === 'files' ? <FileSpreadsheet className="inline w-4 h-4 mr-2 text-cyan-400"/> : <Activity className="inline w-4 h-4 mr-2 text-cyan-400"/>}{details?.client.clientName} — {details?.view === 'files' ? 'Files' : 'Activity'}</span>} subtitle={`Client account @${details?.client.username}`} maxWidth="max-w-4xl">
        {detailLoading ? <p className="text-center py-10 text-slate-500">Loading…</p> : details?.view === 'files' ? <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="text-slate-500 uppercase"><tr><th className="py-2">File</th><th>State</th><th>Version</th><th>Size</th><th>Updated</th><th/></tr></thead><tbody className="divide-y divide-slate-800">{detailRows.map((file) => <tr key={file.fileId}><td className="py-3 text-slate-200">{file.originalName}</td><td className="text-slate-400 capitalize">{file.state}</td><td className="text-slate-400">v{file.currentVersion}</td><td className="text-slate-400">{formatBytes(file.sizeBytes)}</td><td className="text-slate-500">{formatDate(file.updatedAt)}</td><td className="text-right">{file.state === 'active' && <button onClick={() => downloadFile(details.client, file)} className="p-1.5 text-slate-400 hover:text-cyan-300" title="Download file"><Download className="w-4 h-4"/></button>}</td></tr>)}{detailRows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No files found.</td></tr>}</tbody></table></div> : <div className="space-y-2">{detailRows.map((event, index) => <div key={`${event.createdAt}-${index}`} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between gap-4"><span className="text-slate-200">{event.action.replaceAll('_', ' ')} <span className="text-slate-500">by @{event.actorUsername}</span></span><time className="text-slate-500 shrink-0">{formatDate(event.createdAt)}</time></div>)}{detailRows.length === 0 && <p className="text-center py-8 text-slate-500">No activity found.</p>}</div>}
      </Modal>
    </div>
  );
};

const CreateClientModal = ({ clients, isOpen, onClose, onCreated }) => {
  const { addToast, users } = useApp();
  const [clientName, setClientName] = useState('');
  const [username, setUsername] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [userOptionsOpen, setUserOptionsOpen] = useState(false);
  const [permissions, setPermissions] = useState(PERMISSION_OPTIONS.map(([key]) => key));
  const [busy, setBusy] = useState(false);
  const enrolledUsernames = new Set(clients.map((client) => client.username.toLowerCase()));
  const availableUsers = users.filter((user) =>
    user.status === 'Active' && !enrolledUsernames.has(user.username.toLowerCase())
  );
  const matchingUsers = availableUsers
    .filter((user) => {
      const query = userSearch.trim().toLowerCase();
      return !query || user.fullName.toLowerCase().includes(query) || user.username.toLowerCase().includes(query);
    })
    .slice(0, 8);

  useEffect(() => {
    if (isOpen) {
      setClientName('');
      setUsername('');
      setSelectedUser(null);
      setUserSearch('');
      setUserOptionsOpen(false);
    }
  }, [isOpen]);

  const togglePermission = (key) => setPermissions((prev) => prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]);
  const submit = async (event) => {
    event.preventDefault();
    if (!selectedUser) {
      addToast('Select an active MySQL user that is not already in Client Management.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await api.createClient({ clientName, username, permissions });
      const message = result.created
        ? `Client Portal access enabled for @${username}.`
        : result.reactivated
          ? `Client Portal access reactivated for @${username}; existing permissions were preserved.`
          : `Client Portal access for @${username} already exists; use the permissions button to change access.`;
      addToast(message, result.created || result.reactivated ? 'success' : 'info');
      setClientName(''); setUsername('');
      onClose(); await onCreated();
    } catch (err) { addToast(`Could not create client: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <Modal isOpen={isOpen} onClose={onClose} title={<><UserRound className="w-5 h-5 text-cyan-400"/>Enable Client Portal Access</>} subtitle="The username and password must belong to an existing, active MySQL account." maxWidth="max-w-xl">
    <form onSubmit={submit} className="space-y-4">
      <div className="relative">
        <label htmlFor="client-user-search" className="block text-xs text-slate-300">Find an available client by name or username</label>
        <input
          id="client-user-search"
          required
          autoComplete="off"
          value={userSearch}
          onFocus={() => setUserOptionsOpen(true)}
          onChange={(event) => {
            setUserSearch(event.target.value);
            setSelectedUser(null);
            setClientName('');
            setUsername('');
            setUserOptionsOpen(true);
          }}
          placeholder="Type a client name or username..."
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={userOptionsOpen}
          aria-controls="available-client-users"
          className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm"
        />
        {userOptionsOpen && <ul id="available-client-users" role="listbox" className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
          {matchingUsers.length ? matchingUsers.map((user) => <li key={user.username} role="option" aria-selected={selectedUser?.username === user.username}>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
              setSelectedUser(user);
              setClientName(user.fullName);
              setUsername(user.username);
              setUserSearch(`${user.fullName} (@${user.username})`);
              setUserOptionsOpen(false);
            }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800">
              <span className="block text-sm text-slate-100">{user.fullName}</span>
              <span className="block font-mono text-xs text-cyan-300">@{user.username}</span>
            </button>
          </li>) : <li className="px-3 py-2 text-xs text-slate-500">{availableUsers.length ? 'No matching users.' : 'No active users available to enroll.'}</li>}
        </ul>}
        <p className="mt-1 text-[11px] text-slate-500">Only active MySQL users not already listed in Client Management are shown.</p>
      </div>
      {selectedUser && <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-300">Client name<input required maxLength={160} value={clientName} onChange={(event) => setClientName(event.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm"/></label>
        <label className="block text-xs text-slate-300">MySQL username<input value={username} readOnly className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm font-mono text-slate-400"/><span className="text-[11px] text-slate-500">Client signs in with this account&apos;s MySQL password.</span></label>
      </div>}
      <div><p className="text-xs uppercase font-semibold text-slate-400 mb-2">Client permissions</p><div className="grid sm:grid-cols-2 gap-2">{PERMISSION_OPTIONS.map(([key, label]) => <label key={key} className="flex gap-2 items-center text-xs text-slate-300"><input type="checkbox" checked={permissions.includes(key)} onChange={() => togglePermission(key)} className="accent-cyan-500"/>{label}</label>)}</div></div>
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800"><button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-400">Cancel</button><button disabled={busy || !selectedUser} className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold disabled:opacity-50">{busy ? 'Enabling...' : 'Enable Access'}</button></div>
    </form>
  </Modal>;
};

const ClientPermissionsModal = ({ client, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [permissions, setPermissions] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPermissions(client?.permissions || []); }, [client]);
  const toggle = (key) => setPermissions((prev) => prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.updateClientPermissions(client.clientId, permissions); addToast('Client permissions updated.', 'success'); onClose(); await onSaved(); }
    catch (err) { addToast(`Could not update permissions: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <Modal isOpen={!!client} onClose={onClose} title={<><ShieldCheck className="w-5 h-5 text-cyan-400"/>Client Permissions</>} subtitle={client ? `Permissions for @${client.username}.` : ''} maxWidth="max-w-md"><form onSubmit={submit} className="space-y-4"><div className="space-y-3">{PERMISSION_OPTIONS.map(([key, label]) => <label key={key} className="flex gap-2 items-center text-sm text-slate-300"><input type="checkbox" checked={permissions.includes(key)} onChange={() => toggle(key)} className="accent-cyan-500"/>{label}</label>)}</div><div className="flex justify-end gap-2 border-t border-slate-800 pt-3"><button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-400">Cancel</button><button disabled={busy} className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold">{busy ? 'Saving…' : 'Save Permissions'}</button></div></form></Modal>;
};
