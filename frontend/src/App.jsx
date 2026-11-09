import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { ToastContainer } from './components/common/Toast';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { RequestsPage } from './pages/RequestsPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { ClientManagementPage } from './pages/ClientManagementPage';
import { ClientLoginPage, ClientPortal } from './client/ClientPortal';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md p-6 rounded-2xl bg-slate-900 border border-rose-500/30 shadow-2xl">
            <h2 className="text-lg font-bold text-rose-400 mb-2">Something went wrong</h2>
            <p className="text-xs text-slate-400 mb-4 font-mono break-words">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('mysql_admin_auth');
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase"
            >
              Reset & Reload Console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { isAuthenticated, userRole, currentTab } = useApp();

  if (isAuthenticated && userRole === 'client') {
    return <ClientPortal />;
  }

  if (!isAuthenticated) {
    return (
      <>
        {window.location.pathname.startsWith('/client') ? <ClientLoginPage /> : <LoginPage />}
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/40">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'overview' && <DashboardPage />}
            {currentTab === 'users' && <UsersPage />}
            {currentTab === 'clients' && <ClientManagementPage />}
            {currentTab === 'databases' && <DatabasesPage />}
            {currentTab === 'requests' && <RequestsPage />}
            {currentTab === 'activity' && <ActivityPage />}
            {currentTab === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
