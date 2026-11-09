import { useEffect, useState } from 'react';
import {
  Activity, Database, Download, Files, FileSpreadsheet, LayoutDashboard,
  LogOut, Trash2, Upload, UserRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ToastContainer } from '../components/common/Toast';
import { api } from '../services/api';
import { ClientRoute } from './ClientViews';

const CLIENT_NAV = [
  ['/client/dashboard', 'Dashboard', LayoutDashboard],
  ['/client/files', 'My Files', Files],
  ['/client/upload', 'Upload Excel Files', Upload],
  ['/client/downloads', 'Download Files', Download],
  ['/client/recycle-bin', 'Recycle Bin', Trash2],
  ['/client/activity', 'Activity History', Activity],
  ['/client/profile', 'My Profile', UserRound],
];

export const ClientLoginPage = () => {
  const { clientLogin, addToast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await clientLogin(username.trim(), password);
      window.history.replaceState({}, '', '/client/dashboard');
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center mb-4"><FileSpreadsheet className="w-7 h-7 text-white"/></div>
          <h1 className="text-xl font-extrabold text-slate-100">Client File Portal</h1>
            <p className="text-xs text-slate-400 mt-1">Sign in with your enabled MySQL account username and password.</p>
        </div>
        {error && <div role="alert" className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-300">MySQL username<input autoFocus required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-sm font-mono outline-none"/></label>
          <label className="block text-xs font-semibold text-slate-300">MySQL password<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-sm outline-none"/></label>
          <button disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-xs uppercase disabled:opacity-50">{busy ? 'Signing in…' : 'Sign In to Client Portal'}</button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">An administrator must enable your MySQL account for Client Portal access. <a href="/" className="text-cyan-300 hover:text-cyan-200">Admin sign in</a></p>
      </div>
    </div>
  );
};

export const ClientPortal = () => {
  const { clientProfile, setClientProfile, logout, addToast } = useApp();
  const [path, setPath] = useState(window.location.pathname);
  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  useEffect(() => {
    api.getClientMe().then(setClientProfile).catch((err) => {
      addToast(`Client session could not be restored: ${err.message}`, 'error');
      logout();
    });
  }, [setClientProfile, addToast, logout]);

  const route = path.startsWith('/client/editor/')
    ? 'editor'
    : path.startsWith('/client/text-editor/')
      ? 'text-editor'
      : (path.replace(/\/$/, '') || '/client/dashboard');
  const fileId = route === 'editor' || route === 'text-editor' ? path.split('/').pop() : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 px-5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center"><Database className="w-5 h-5 text-white"/></div><div><div className="font-bold text-sm">Client File Portal</div><div className="text-[10px] text-slate-500">Private Excel workspace</div></div></div>
        <div className="flex items-center gap-3"><div className="hidden sm:block text-right"><div className="text-xs font-semibold">{clientProfile?.clientName || 'Client'}</div><div className="text-[10px] text-slate-500 font-mono">@{clientProfile?.username || '…'}</div></div><button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-rose-300 hover:border-rose-500/30 text-xs"><LogOut className="w-3.5 h-3.5"/>Logout</button></div>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-60 shrink-0 border-r border-slate-800 bg-slate-900/50 flex-col p-3">
          <p className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Workspace</p>
          <nav className="space-y-1">{CLIENT_NAV.map(([href, label, Icon]) => {
            const active = href === '/client/files' && (route === 'editor' || route === 'text-editor') || route === href;
            return <button key={href} onClick={() => navigate(href)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${active ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'}`}><Icon className="w-4 h-4"/>{label}</button>;
          })}</nav>
          <div className="mt-auto p-3 text-[10px] leading-relaxed text-slate-500 border-t border-slate-800">Your files are private to your account. Only the administrator can manage accounts and permissions.</div>
        </aside>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="md:hidden flex gap-2 overflow-x-auto pb-4 mb-4">{CLIENT_NAV.map(([href, label, Icon]) => <button key={href} onClick={() => navigate(href)} className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2"><Icon className="w-3.5 h-3.5"/>{label}</button>)}</div>
          <div className="max-w-7xl mx-auto"><ClientRoute path={route} fileId={fileId} navigate={navigate} profile={clientProfile}/></div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};
