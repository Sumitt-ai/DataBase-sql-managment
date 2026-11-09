import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle2,
  Lock,
  Network
} from 'lucide-react';

export const SettingsPanel = () => {
  const { settings, updateSettings, resetDemoData } = useApp();

  const [serverIp, setServerIp] = useState(settings.serverIp);
  const [mysqlPort, setMysqlPort] = useState(settings.mysqlPort);
  const [frontendPort, setFrontendPort] = useState(settings.frontendPort);
  const [backendPort, setBackendPort] = useState(settings.backendPort);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(settings.sessionTimeoutMinutes);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    setError('');

    updateSettings({
      serverIp,
      mysqlPort: parseInt(mysqlPort, 10),
      frontendPort: parseInt(frontendPort, 10),
      backendPort: parseInt(backendPort, 10),
      sessionTimeoutMinutes: parseInt(sessionTimeoutMinutes, 10)
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>System and administrative settings have been saved successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MySQL Server Status */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">MySQL Server</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
              CONNECTED
            </span>
          </div>
          <p className="font-mono text-sm font-bold text-slate-100">Port {settings.mysqlPort}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">{settings.mysqlVersion}</p>
        </div>

        {/* Backend FastAPI Status */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">FastAPI Backend</span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">
              READY
            </span>
          </div>
          <p className="font-mono text-sm font-bold text-slate-100">Port {settings.backendPort}</p>
          <p className="text-[11px] text-slate-400 mt-1">Python 3.12 Engine</p>
        </div>

        {/* LAN Access Status */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">LAN Endpoint</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
              ACCESSIBLE
            </span>
          </div>
          <p className="font-mono text-sm font-bold text-cyan-300 truncate">
            {settings.serverIp}:{settings.frontendPort}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Wi-Fi / Ethernet Network</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Network & Connection Parameters */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <Network className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Network & Host Configuration
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Server Laptop IP Address
              </label>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                IP address accessed by other laptops across the LAN.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                MySQL Server Port
              </label>
              <input
                type="number"
                value={mysqlPort}
                onChange={(e) => setMysqlPort(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Default: 3306 for standard local MySQL Server.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Frontend Application Port
              </label>
              <input
                type="number"
                value={frontendPort}
                onChange={(e) => setFrontendPort(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Backend API Port
              </label>
              <input
                type="number"
                value={backendPort}
                onChange={(e) => setBackendPort(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Dynamic MySQL administrator sign-in */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Admin Sign-In
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">
            Sign in with any MySQL account directly granted <code>ALL PRIVILEGES ON *.*</code>.
            MySQL verifies the username and password directly; the application does not store that password.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Session Inactivity Timeout (Minutes)
            </label>
            <input
              type="number"
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
              className="w-full md:w-1/2 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Security & Isolation Guardrails Card */}
        <div className="p-6 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 shadow-xl backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Security Architecture & Safeguards (Section 13)</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5">
            <li><strong>Credential Separation:</strong> Backend service credentials stay on the server and are <strong>never</strong> sent to the browser; administrator passwords are checked by MySQL at sign-in and are not stored by the application.</li>
            <li><strong>Parameterized Queries:</strong> All database commands executed by the Python FastAPI backend utilize prepared statements to prevent SQL injection.</li>
            <li><strong>Least-Privilege Isolation:</strong> Users are granted access strictly to their assigned database schema, preventing cross-tenant data leaks.</li>
            <li><strong>Pre-Deletion Backup Verification:</strong> Any permanent database drop triggers an automated <code>mysqldump</code> with checksum verification prior to table deletion.</li>
          </ul>
        </div>

        {/* Save button and reset */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={resetDemoData}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo State</span>
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
