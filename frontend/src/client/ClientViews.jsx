/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Download, FileSpreadsheet, FileText, Filter, Folder, FolderPlus,
  LoaderCircle, Plus, RotateCcw, Save, Search, Trash2, Upload, UserRound, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';

const buttonClass = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed';
const primaryClass = 'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 disabled:opacity-50';
const formatBytes = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';

const PageTitle = ({ eyebrow, title, description, icon: Icon = FileSpreadsheet, action }) => <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"><div><div className="flex items-center gap-2 text-cyan-400 text-[11px] font-bold uppercase tracking-wider mb-1"><Icon className="w-4 h-4"/>{eyebrow}</div><h1 className="text-2xl font-bold text-slate-100">{title}</h1>{description && <p className="text-xs text-slate-400 mt-1">{description}</p>}</div>{action}</div>;

export const ClientRoute = ({ path, fileId, navigate, profile }) => {
  if (path === '/client/files') return <ClientFiles navigate={navigate}/>;
  if (path === '/client/upload') return <UploadPage navigate={navigate}/>;
  if (path === '/client/downloads') return <ClientFiles navigate={navigate} downloadsOnly/>;
  if (path === '/client/recycle-bin') return <RecycleBinPage/>;
  if (path === '/client/activity') return <ActivityPage/>;
  if (path === '/client/profile') return <ProfilePage profile={profile}/>;
  if (path === 'editor') return <WorkbookEditor fileId={fileId} navigate={navigate}/>;
  if (path === 'text-editor') return <TextFileEditor fileId={fileId} navigate={navigate}/>;
  return <ClientDashboard navigate={navigate} profile={profile}/>;
};

const ClientDashboard = ({ navigate, profile }) => {
  const { addToast } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getClientDashboard().then(setData).catch((err) => { setError(err.message); addToast(`Dashboard unavailable: ${err.message}`, 'error'); }); }, [addToast]);
  const cards = [['My files', data?.totalFiles ?? '—'], ['Active files', data?.activeFiles ?? '—'], ['Storage used', data ? formatBytes(data.storageBytes) : '—']];
  return <>
    <PageTitle eyebrow="Client workspace" title={`Welcome${profile?.clientName ? `, ${profile.clientName}` : ''}`} description="Your private Excel and CSV files, backed up on the central server." action={<button onClick={() => navigate('/client/upload')} className={primaryClass}><Upload className="w-4 h-4"/>Upload a file</button>}/>
    {error && <div role="alert" className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">{error}</div>}
    <div className="grid sm:grid-cols-3 gap-4 mb-6">{cards.map(([label, value]) => <div key={label} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold text-slate-100 mt-2">{value}</div></div>)}</div>
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-cyan-400"/><h2 className="font-semibold text-sm">Recent activity</h2></div>{data?.recentActivity?.length ? <div className="divide-y divide-slate-800">{data.recentActivity.map((item, index) => <div key={`${item.createdAt}-${index}`} className="py-3 flex justify-between gap-4 text-xs"><span className="text-slate-300 capitalize">{item.action.replaceAll('_', ' ')}</span><time className="text-slate-500 shrink-0">{formatDate(item.createdAt)}</time></div>)}</div> : <p className="text-xs text-slate-500">{data ? 'Your file activity will appear here.' : 'Loading your dashboard…'}</p>}</section>
  </>;
};

const triggerDownload = async (fileId, apiMethod, addToast) => {
  try {
    const { blob, filename } = await apiMethod(fileId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    addToast(`Download failed: ${err.message}`, 'error');
  }
};

const TextFileEditor = ({ fileId, navigate }) => {
  const { addToast, clientProfile } = useApp();
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = clientProfile?.permissions?.includes('edit');
  const loadFile = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getClientTextFile(fileId);
      setFile(result);
      setContent(result.content);
    } catch (err) {
      addToast(`Could not open text file: ${err.message}`, 'error');
      setFile(null);
    } finally { setLoading(false); }
  }, [addToast, fileId]);
  useEffect(() => { loadFile(); }, [loadFile]);

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveClientTextFile(fileId, content);
      setFile((prev) => ({ ...prev, currentVersion: result.currentVersion }));
      addToast(`Saved ${file.fileName} as version ${result.currentVersion}.`, 'success');
    } catch (err) { addToast(`Could not save text file: ${err.message}`, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Loading text file…</div>;
  if (!file) return <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900 text-center"><p className="text-sm text-slate-300">Text file could not be opened.</p><button onClick={() => navigate('/client/files')} className={`${buttonClass} mt-4`}><ArrowLeft className="w-3.5 h-3.5"/>Back to My Files</button></div>;

  return <>
    <PageTitle eyebrow="Text file editor" title={file.fileName} description={`Version ${file.currentVersion} · Plain text`} action={<div className="flex gap-2"><button onClick={() => navigate('/client/files')} className={buttonClass}><ArrowLeft className="w-3.5 h-3.5"/>My Files</button><button onClick={save} disabled={!canEdit || saving} className={primaryClass}>{saving ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}{saving ? 'Saving…' : 'Save changes'}</button></div>}/>
    <textarea aria-label={`Contents of ${file.fileName}`} value={content} onChange={(event) => setContent(event.target.value)} readOnly={!canEdit} spellCheck={false} className="w-full min-h-[65vh] p-4 rounded-xl border border-slate-800 bg-slate-900/70 text-sm font-mono text-slate-200 leading-relaxed outline-none focus:border-cyan-500 read-only:opacity-70"/>
    {!canEdit && <p className="mt-2 text-xs text-amber-300">Your account does not have permission to edit files.</p>}
  </>;
};

const ClientFiles = ({ navigate, downloadsOnly = false }) => {
  const { addToast, clientProfile } = useApp();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [textFileName, setTextFileName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [busy, setBusy] = useState(false);
  const uploadInput = useRef(null);
  const currentFolder = breadcrumbs.at(-1) || null;
  const canEdit = clientProfile?.permissions?.includes('edit');
  const canUpload = clientProfile?.permissions?.includes('upload');
  const canDownload = clientProfile?.permissions?.includes('download');
  const canRecycle = clientProfile?.permissions?.includes('recycle');
  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      if (downloadsOnly) {
        setFiles(await api.getClientFiles(undefined, true));
      } else {
        const [fileRows, folderRows] = await Promise.all([
          api.getClientFiles(currentFolder?.folderId),
          api.getClientFolders(currentFolder?.folderId),
        ]);
        setFiles(fileRows);
        setFolders(folderRows);
      }
    }
    catch (err) { addToast(`Could not load files: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  }, [addToast, currentFolder?.folderId, downloadsOnly]);
  useEffect(() => { loadFiles(); }, [loadFiles]);
  const visible = files.filter((file) => file.originalName.toLowerCase().includes(search.toLowerCase()));
  const openFolder = (folder) => setBreadcrumbs((prev) => [...prev, folder]);
  const openBreadcrumb = (index) => setBreadcrumbs((prev) => prev.slice(0, index + 1));
  const createFolder = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createClientFolder(folderName, currentFolder?.folderId);
      addToast(`Folder "${folderName.trim()}" created.`, 'success');
      setFolderName('');
      setCreatingFolder(false);
      await loadFiles();
    } catch (err) { addToast(`Could not create folder: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };
  const uploadFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selectedFiles.length) return;
    setBusy(true);
    let uploaded = 0;
    try {
      for (const file of selectedFiles) {
        const body = new FormData();
        body.append('file', file);
        if (currentFolder) body.append('folder_id', currentFolder.folderId);
        await api.uploadClientFile(body);
        uploaded += 1;
      }
      addToast(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded.`, 'success');
      await loadFiles();
    } catch (err) {
      addToast(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded; remaining upload failed: ${err.message}`, 'error');
      await loadFiles();
    } finally { setBusy(false); }
  };
  const createTextFile = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.createClientTextFile(textFileName, textContent, currentFolder?.folderId);
      addToast(`${result.file.originalName} created.`, 'success');
      setTextOpen(false);
      setTextFileName('');
      setTextContent('');
      navigate(`/client/text-editor/${result.file.fileId}`);
    } catch (err) { addToast(`Could not create text file: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };
  const moveToRecycle = async (file) => {
    try { await api.recycleClientFile(file.fileId); addToast(`${file.originalName} moved to the recycle bin.`, 'success'); await loadFiles(); }
    catch (err) { addToast(`Could not recycle file: ${err.message}`, 'error'); }
  };
  return <>
    <PageTitle eyebrow="Private files" title={downloadsOnly ? 'Download Files' : 'My Files'} description={downloadsOnly ? 'Download the latest saved version of your files.' : 'Create folders, upload files, or write plain-text documents in your private workspace.'} action={!downloadsOnly && <div className="flex flex-wrap gap-2"><input ref={uploadInput} className="hidden" type="file" multiple accept=".xlsx,.xls,.csv,.txt" onChange={uploadFiles}/><button disabled={!canUpload || busy} onClick={() => uploadInput.current?.click()} className={primaryClass}><Upload className="w-4 h-4"/>Upload files</button><button disabled={!canUpload || busy} onClick={() => setCreatingFolder((value) => !value)} className={buttonClass}><FolderPlus className="w-4 h-4"/>New folder</button><button disabled={!canUpload || busy} onClick={() => setTextOpen(true)} className={buttonClass}><FileText className="w-4 h-4"/>New text file</button></div>}/>
    {!downloadsOnly && <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 mb-4 text-xs"><button onClick={() => setBreadcrumbs([])} className="text-cyan-300 hover:text-cyan-200">My Files</button>{breadcrumbs.map((folder, index) => <span key={folder.folderId} className="inline-flex items-center gap-1"><ArrowRight className="w-3 h-3 text-slate-600"/><button onClick={() => openBreadcrumb(index)} className={index === breadcrumbs.length - 1 ? 'text-slate-200' : 'text-cyan-300 hover:text-cyan-200'}>{folder.name}</button></span>)}</nav>}
    {creatingFolder && !downloadsOnly && <form onSubmit={createFolder} className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl border border-slate-800 bg-slate-900/60"><input autoFocus required maxLength={120} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="New folder name" className="flex-1 min-w-48 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs outline-none focus:border-cyan-500"/><button disabled={busy} className={primaryClass}>{busy ? 'Creating…' : 'Create folder'}</button><button type="button" onClick={() => setCreatingFolder(false)} className={buttonClass}>Cancel</button></form>}
    <div className="flex gap-2 mb-4"><div className="relative flex-1 max-w-sm"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file names" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs outline-none focus:border-cyan-500"/></div><button onClick={loadFiles} className={buttonClass}>Refresh</button></div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-900 text-slate-500 uppercase text-[10px]"><tr><th className="px-4 py-3">Name</th><th>Version</th><th>Size</th><th>Updated</th><th className="text-right px-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{loading ? <tr><td colSpan={5} className="py-12 text-center text-slate-500">Loading files…</td></tr> : <>{!downloadsOnly && folders.map((folder) => <tr key={folder.folderId} className="hover:bg-slate-800/30"><td className="px-4 py-3.5"><button onClick={() => openFolder(folder)} className="flex items-center gap-2 text-cyan-200"><Folder className="w-4 h-4 text-cyan-400"/>{folder.name}</button></td><td className="text-slate-600">—</td><td className="text-slate-600">—</td><td className="text-slate-500">{formatDate(folder.createdAt)}</td><td/></tr>)}{visible.map((file) => <tr key={file.fileId} className="hover:bg-slate-800/30"><td className="px-4 py-3.5"><div className="flex items-center gap-2 text-slate-200">{file.extension === '.txt' ? <FileText className="w-4 h-4 text-cyan-300"/> : <FileSpreadsheet className="w-4 h-4 text-emerald-400"/>}{file.originalName}</div><div className="text-[10px] text-slate-600 mt-1">{file.extension.toUpperCase().slice(1)}</div></td><td className="text-slate-400">v{file.currentVersion}</td><td className="text-slate-400">{formatBytes(file.sizeBytes)}</td><td className="text-slate-500">{formatDate(file.updatedAt)}</td><td className="px-4"><div className="flex justify-end gap-2">{!downloadsOnly && file.extension === '.txt' && <button disabled={!canEdit} onClick={() => navigate(`/client/text-editor/${file.fileId}`)} className={buttonClass}>Edit text</button>}{!downloadsOnly && file.extension !== '.txt' && <button disabled={!canEdit} onClick={() => navigate(`/client/editor/${file.fileId}`)} className={buttonClass}>Edit</button>}{canDownload && <button onClick={() => triggerDownload(file.fileId, api.downloadClientFile, addToast)} className={buttonClass}><Download className="w-3.5 h-3.5"/>Download</button>}{!downloadsOnly && canRecycle && <button onClick={() => moveToRecycle(file)} className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300" title="Move to recycle bin"><Trash2 className="w-4 h-4"/></button>}</div></td></tr>)}</>}{!loading && visible.length === 0 && (downloadsOnly || folders.length === 0) && <tr><td colSpan={5} className="py-12 text-center text-slate-500">{files.length ? 'No files match this search.' : 'This folder is empty.'}</td></tr>}</tbody></table></div></div>
    <Modal isOpen={textOpen} onClose={() => setTextOpen(false)} title={<><FileText className="w-5 h-5 text-cyan-400"/>Create a text file</>} subtitle="Create a plain-text .txt document in the current folder." maxWidth="max-w-2xl"><form onSubmit={createTextFile} className="space-y-4"><label className="block text-xs text-slate-300">File name<input autoFocus required maxLength={251} value={textFileName} onChange={(event) => setTextFileName(event.target.value)} placeholder="notes.txt" className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm"/></label><label className="block text-xs text-slate-300">Text content<textarea rows={12} value={textContent} onChange={(event) => setTextContent(event.target.value)} className="mt-1 w-full resize-y rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm font-mono"/></label><div className="flex justify-end gap-2 border-t border-slate-800 pt-3"><button type="button" onClick={() => setTextOpen(false)} className={buttonClass}>Cancel</button><button disabled={busy || !textFileName.trim()} className={primaryClass}>{busy ? 'Creating…' : 'Create and edit'}</button></div></form></Modal>
  </>;
};

const UploadPage = ({ navigate }) => {
  const { addToast, clientProfile } = useApp();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const canUpload = clientProfile?.permissions?.includes('upload');
  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    const body = new FormData(); body.append('file', file);
    try {
      const result = await api.uploadClientFile(body);
      addToast(`${result.file.originalName} uploaded.`, 'success');
      navigate('/client/files');
    } catch (err) { addToast(`Upload failed: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <>
    <PageTitle eyebrow="Secure upload" title="Upload Excel Files" description="Supported formats: .xlsx, .xls, and .csv. The server checks file ownership and stores it in your private folder."/>
    {!canUpload ? <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">Your account does not have upload permission. Contact your administrator.</div> : <form onSubmit={submit} className="max-w-2xl p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-5"><label className="block p-8 text-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 cursor-pointer hover:border-cyan-500/50"><Upload className="w-8 h-8 text-cyan-400 mx-auto mb-3"/><span className="block text-sm font-semibold text-slate-200">Choose an Excel or CSV file</span><span className="block text-xs text-slate-500 mt-1">Maximum upload size is configured by the server.</span><input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)}/></label>{file && <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950 text-xs"><span className="text-slate-200">{file.name}</span><span className="text-slate-500">{formatBytes(file.size)}</span></div>}<div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-500">Uploaded workbooks are isolated by client account. A server-generated storage key is used; client-provided file paths are ignored.</div><div className="flex justify-end gap-2"><button type="button" onClick={() => navigate('/client/files')} className={buttonClass}>Cancel</button><button disabled={!file || busy} className={primaryClass}>{busy ? <><LoaderCircle className="w-4 h-4 animate-spin"/>Uploading…</> : <><Upload className="w-4 h-4"/>Upload file</>}</button></div></form>}
  </>;
};

const RecycleBinPage = () => {
  const { addToast, clientProfile } = useApp();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setFiles(await api.getClientRecycleBin()); } catch (err) { addToast(`Could not load recycle bin: ${err.message}`, 'error'); } finally { setLoading(false); } }, [addToast]);
  useEffect(() => { load(); }, [load]);
  const restore = async (file) => { try { await api.restoreClientFile(file.fileId); addToast(`${file.originalName} restored.`, 'success'); await load(); } catch (err) { addToast(`Could not restore file: ${err.message}`, 'error'); } };
  return <><PageTitle eyebrow="Deleted files" title="Recycle Bin" description="Restore a file to My Files. Items remain private to your account."/><div className="rounded-2xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800">{loading ? <p className="p-8 text-center text-xs text-slate-500">Loading recycle bin…</p> : files.length ? files.map((file) => <div key={file.fileId} className="p-4 flex items-center justify-between gap-4"><div><div className="text-sm text-slate-200">{file.originalName}</div><div className="text-[11px] text-slate-500 mt-1">Moved {formatDate(file.deletedAt)} · {formatBytes(file.sizeBytes)}</div></div><button disabled={!clientProfile?.permissions?.includes('restore')} onClick={() => restore(file)} className={buttonClass}><RotateCcw className="w-3.5 h-3.5"/>Restore</button></div>) : <p className="p-8 text-center text-xs text-slate-500">Your recycle bin is empty.</p>}</div></>;
};

const ActivityPage = () => {
  const { addToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getClientActivity().then(setItems).catch((err) => addToast(`Could not load activity: ${err.message}`, 'error')).finally(() => setLoading(false)); }, [addToast]);
  return <><PageTitle eyebrow="Audit history" title="Activity History" description="Recent activity for your account and files."/><div className="rounded-2xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800">{loading ? <p className="p-8 text-center text-xs text-slate-500">Loading activity…</p> : items.length ? items.map((event, index) => <div key={`${event.createdAt}-${index}`} className="p-4 flex items-start justify-between gap-4"><div><div className="text-sm text-slate-200 capitalize">{event.action.replaceAll('_', ' ')}</div>{event.details && <div className="text-[11px] text-slate-500 mt-1">{typeof event.details === 'string' ? event.details : JSON.stringify(event.details)}</div>}</div><time className="text-[11px] text-slate-500 shrink-0">{formatDate(event.createdAt)}</time></div>) : <p className="p-8 text-center text-xs text-slate-500">No activity recorded yet.</p>}</div></>;
};

const ProfilePage = ({ profile }) => {
  const { addToast, setClientProfile } = useApp();
  const [clientName, setClientName] = useState(profile?.clientName || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => setClientName(profile?.clientName || ''), [profile?.clientName]);
  const saveProfile = async (event) => {
    event.preventDefault(); setBusy(true);
    try { const updated = await api.updateClientProfile(clientName); setClientProfile(updated); addToast('Profile updated.', 'success'); }
    catch (err) { addToast(`Could not update profile: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };
  return <><PageTitle eyebrow="Account settings" title="My Profile" description="Update your portal display name."/><div className="grid lg:grid-cols-2 gap-5"><form onSubmit={saveProfile} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4"><h2 className="font-semibold text-sm">Profile details</h2><label className="block text-xs text-slate-400">Client name<input required maxLength={160} value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1.5 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-100"/></label><div className="text-xs text-slate-500">MySQL username: <span className="font-mono text-slate-300">@{profile?.username}</span></div><div className="text-xs text-slate-500">Permissions: <span className="text-slate-300">{profile?.permissions?.join(', ') || 'None'}</span></div><button disabled={busy} className={primaryClass}><UserRound className="w-4 h-4"/>Save profile</button></form><section className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3"><h2 className="font-semibold text-sm">MySQL account password</h2><p className="text-xs leading-relaxed text-slate-400">Your Client Portal password is the password for your MySQL account. Contact the administrator to change it in MySQL User Management. A separate portal password is not stored.</p></section></div></>;
};

const WorkbookEditor = ({ fileId, navigate }) => {
  const { addToast } = useApp();
  const [workbook, setWorkbook] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const rowsPerPage = 75;

  const loadWorkbook = useCallback(async () => {
    setLoading(true);
    try { setWorkbook(await api.getClientWorkbook(fileId)); }
    catch (err) { addToast(`Could not open workbook: ${err.message}`, 'error'); setWorkbook(null); }
    finally { setLoading(false); }
  }, [fileId, addToast]);
  useEffect(() => { loadWorkbook(); }, [loadWorkbook]);

  const sheet = workbook?.sheets?.[sheetIndex];
  const columnCount = (sheet?.rows || []).reduce((max, row) => Math.max(max, row.length), 1);
  const filteredRows = useMemo(() => (sheet?.rows || []).map((row, index) => ({ row, index })).filter(({ row }) => !search || row.some((cell) => String(cell ?? '').toLowerCase().includes(search.toLowerCase()))), [sheet, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const pageRows = filteredRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const commitCell = (rowIndex, columnIndex, value) => {
    setWorkbook((prev) => {
      const sheets = [...prev.sheets];
      const rows = sheets[sheetIndex].rows.map((row) => [...row]);
      while (rows[rowIndex].length <= columnIndex) rows[rowIndex].push(null);
      rows[rowIndex][columnIndex] = value === '' ? null : value;
      sheets[sheetIndex] = { ...sheets[sheetIndex], rows };
      return { ...prev, sheets };
    });
    setEditingCell(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveClientWorkbook(fileId, { sheets: workbook.sheets });
      setWorkbook((prev) => ({ ...prev, currentVersion: result.currentVersion }));
      addToast(`Saved workbook version ${result.currentVersion}. Previous version backed up.`, 'success');
    } catch (err) { addToast(`Save failed: ${err.message}`, 'error'); }
    finally { setSaving(false); }
  };

  const updateSheetRows = (rows) => setWorkbook((prev) => ({ ...prev, sheets: prev.sheets.map((item, index) => index === sheetIndex ? { ...item, rows } : item) }));
  const addRow = () => updateSheetRows([...sheet.rows, Array(columnCount).fill(null)]);
  const addColumn = () => updateSheetRows(sheet.rows.map((row) => [...row, null]));
  const deleteRow = (rowIndex) => updateSheetRows(sheet.rows.filter((_, index) => index !== rowIndex));
  const addSheet = () => {
    const name = `Sheet${workbook.sheets.length + 1}`;
    setWorkbook((prev) => ({ ...prev, sheets: [...prev.sheets, { name, rows: [] }] }));
    setSheetIndex(workbook.sheets.length);
  };
  const deleteSheet = () => {
    if (workbook.sheets.length < 2 || !window.confirm(`Delete sheet "${sheet.name}"?`)) return;
    setWorkbook((prev) => ({ ...prev, sheets: prev.sheets.filter((_, index) => index !== sheetIndex) }));
    setSheetIndex(Math.max(0, sheetIndex - 1));
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Loading workbook…</div>;
  if (!workbook || !sheet) return <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900 text-center"><p className="text-sm text-slate-300">Workbook could not be opened.</p><button onClick={() => navigate('/client/files')} className={`${buttonClass} mt-4`}><ArrowLeft className="w-3.5 h-3.5"/>Back to My Files</button></div>;

  return <>
    <PageTitle eyebrow="Workbook editor" title={workbook.fileName} description={`Version ${workbook.currentVersion} · ${workbook.extension.toUpperCase().slice(1)}`} action={<div className="flex gap-2"><button onClick={() => navigate('/client/files')} className={buttonClass}><ArrowLeft className="w-3.5 h-3.5"/>My Files</button><button onClick={save} disabled={saving} className={primaryClass}>{saving ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}{saving ? 'Saving…' : 'Save changes'}</button></div>}/>
    {workbook.limitations?.length > 0 && <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-200"><strong>Workbook compatibility:</strong> {workbook.limitations.join(' ')}</div>}
    <div className="flex flex-wrap items-center gap-2 mb-3">{workbook.sheets.map((item, index) => <button key={`${item.name}-${index}`} onClick={() => { setSheetIndex(index); setPage(0); }} className={`px-3 py-2 rounded-lg text-xs border ${sheetIndex === index ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 bg-slate-900 text-slate-400'}`}>{item.name}</button>)}{workbook.extension !== '.csv' && <><button onClick={addSheet} className={`${buttonClass} !py-1.5`} title="Add sheet"><Plus className="w-3 h-3"/>Sheet</button><button onClick={deleteSheet} disabled={workbook.sheets.length < 2} className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-300 disabled:opacity-30" title="Delete current sheet"><X className="w-3.5 h-3.5"/></button></>}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div className="flex gap-2"><button onClick={addRow} className={buttonClass}><Plus className="w-3.5 h-3.5"/>Add row</button><button onClick={addColumn} className={buttonClass}><Plus className="w-3.5 h-3.5"/>Add column</button></div><div className="relative w-full sm:w-64"><Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search / filter rows" className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs outline-none focus:border-cyan-500"/></div></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-auto max-h-[65vh]"><table className="border-collapse text-xs min-w-full"><thead className="sticky top-0 z-10 bg-slate-900"><tr><th className="px-2 py-2 border-b border-r border-slate-800 text-slate-600 w-10">#</th>{Array.from({ length: columnCount }, (_, col) => <th key={col} className="px-3 py-2 border-b border-r border-slate-800 text-slate-500 font-mono min-w-32">{String.fromCharCode(65 + (col % 26))}{col >= 26 ? Math.floor(col / 26) : ''}</th>)}<th className="px-2 py-2 border-b border-slate-800"/></tr></thead><tbody>{pageRows.map(({ row, index: rowIndex }) => <tr key={rowIndex} className="hover:bg-slate-800/40"><td className="px-2 py-1.5 border-r border-b border-slate-800 text-slate-600 text-center">{rowIndex + 1}</td>{Array.from({ length: columnCount }, (_, colIndex) => { const value = row[colIndex] ?? ''; const active = editingCell?.row === rowIndex && editingCell?.col === colIndex; return <td key={colIndex} onDoubleClick={() => { setEditingCell({ row: rowIndex, col: colIndex }); setEditValue(String(value)); }} className="px-2 py-1 border-r border-b border-slate-800 text-slate-300 min-w-32 max-w-64"><div className="min-h-7 flex items-center">{active ? <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitCell(rowIndex, colIndex, editValue)} onKeyDown={(e) => { if (e.key === 'Enter') commitCell(rowIndex, colIndex, editValue); if (e.key === 'Escape') setEditingCell(null); }} className="w-full bg-slate-950 border border-cyan-500 rounded px-1.5 py-1 outline-none"/> : <span onClick={() => { setEditingCell({ row: rowIndex, col: colIndex }); setEditValue(String(value)); }} className="block w-full truncate cursor-text" title={String(value)}>{String(value)}</span>}</div></td>; })}<td className="px-1 border-b border-slate-800"><button onClick={() => deleteRow(rowIndex)} title="Delete row" className="p-1 text-slate-600 hover:text-rose-300"><Trash2 className="w-3 h-3"/></button></td></tr>)}</tbody></table>{pageRows.length === 0 && <p className="p-8 text-center text-xs text-slate-500">No rows match this filter.</p>}</div>
    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3"><span>{filteredRows.length} rows · double-click a cell to edit</span><div className="flex items-center gap-2"><button disabled={page <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className={buttonClass}><ArrowLeft className="w-3 h-3"/>Previous</button><span>Page {page + 1} / {pageCount}</span><button disabled={page + 1 >= pageCount} onClick={() => setPage((n) => Math.min(pageCount - 1, n + 1))} className={buttonClass}>Next<ArrowRight className="w-3 h-3"/></button></div></div>
  </>;
};
