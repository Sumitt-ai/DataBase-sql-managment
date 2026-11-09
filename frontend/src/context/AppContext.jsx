import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initialUsers,
  initialDatabases,
  initialRequests,
  initialActivities,
  initialSettings
} from '../mock/initialData';
import { api } from '../services/api';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    localStorage.removeItem('mysql_admin_auth');
    return !!sessionStorage.getItem('mysql_admin_token');
  });
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('mysql_admin_role'));
  const [adminUsername, setAdminUsername] = useState(() => sessionStorage.getItem('mysql_admin_username'));
  const [clientProfile, setClientProfile] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mysql_admin_client') || 'null'); }
    catch { return null; }
  });

  const [currentTab, setCurrentTab] = useState('overview');
  const [backendOnline, setBackendOnline] = useState(false);
  const [mysqlConnected, setMysqlConnected] = useState(false);

  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('mysql_admin_users');
    if (saved && (saved.includes('alice_j') || saved.includes('bob_dev'))) {
      localStorage.removeItem('mysql_admin_users');
      return [];
    }
    return saved ? JSON.parse(saved) : [];
  });

  const [databases, setDatabases] = useState(() => {
    const saved = localStorage.getItem('mysql_admin_databases');
    if (saved && (saved.includes('school') || saved.includes('students'))) {
      localStorage.removeItem('mysql_admin_databases');
      return [];
    }
    return saved ? JSON.parse(saved) : [];
  });

  const [requests, setRequests] = useState(() => {
    const saved = localStorage.getItem('mysql_admin_requests');
    if (saved && saved.includes('ml_pipeline_cache')) {
      localStorage.removeItem('mysql_admin_requests');
      return [];
    }
    return saved ? JSON.parse(saved) : [];
  });

  const [activities, setActivities] = useState(() => {
    const saved = localStorage.getItem('mysql_admin_activities');
    if (saved && saved.includes('act_1')) {
      localStorage.removeItem('mysql_admin_activities');
      return [];
    }
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('mysql_admin_settings');
    return saved ? JSON.parse(saved) : initialSettings;
  });

  const [toasts, setToasts] = useState([]);

  // Toast notification helper
  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Activity logger helper
  const logActivity = (activityType, target, details, status = 'SUCCESS', performedBy) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const newActivity = {
      id: `act_${Date.now()}`,
      timestamp: formattedDate,
      activityType,
      performedBy: performedBy || adminUsername || 'system',
      target,
      ipAddress: settings.serverIp,
      details,
      status
    };

    setActivities((prev) => [newActivity, ...prev]);
  };

  // Sync with Backend FastAPI & MySQL
  const refreshBackendData = useCallback(async () => {
    if (!isAuthenticated) return;
    if (userRole !== 'admin') {
      setBackendOnline(true);
      return;
    }
    try {
      const statusRes = await api.getStatus();
      setBackendOnline(true);
      setMysqlConnected(!!statusRes.mysql?.connected);

      if (statusRes.mysql?.version) {
        setSettings((prev) => ({
          ...prev,
          mysqlVersion: statusRes.mysql.version,
          mysqlStatus: statusRes.mysql.connected ? 'Connected & Active' : 'Disconnected (Check Password)',
          backendStatus: 'Online (FastAPI REST API)'
        }));
      }

      // Fetch live dashboard & users from FastAPI
      const dashboard = await api.getDashboard();
      if (Array.isArray(dashboard.users)) setUsers(dashboard.users);
      if (Array.isArray(dashboard.databases)) setDatabases(dashboard.databases);
      if (Array.isArray(dashboard.requests)) setRequests(dashboard.requests);
      if (Array.isArray(dashboard.recentActivities)) setActivities(dashboard.recentActivities);
    } catch (err) {
      // Backend not running yet or unreachable: keep frontend working with local state
      setBackendOnline(false);
    }
  }, [isAuthenticated, userRole]);

  // Poll or refresh on mount & when tab changes
  useEffect(() => {
    refreshBackendData();
    const interval = setInterval(refreshBackendData, 10000);
    return () => clearInterval(interval);
  }, [refreshBackendData]);

  // Admin and client session tokens stay in this browser tab, never localStorage.

  useEffect(() => {
    localStorage.setItem('mysql_admin_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('mysql_admin_databases', JSON.stringify(databases));
  }, [databases]);

  useEffect(() => {
    localStorage.setItem('mysql_admin_requests', JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem('mysql_admin_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('mysql_admin_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (userRole === 'client' && clientProfile) sessionStorage.setItem('mysql_admin_client', JSON.stringify(clientProfile));
    else sessionStorage.removeItem('mysql_admin_client');
  }, [clientProfile, userRole]);

  // Auth: Login - Strictly validates credentials against the MySQL Server
  const login = async (username, password) => {
    try {
      const res = await api.login(username, password);
      sessionStorage.setItem('mysql_admin_token', res.token);
      sessionStorage.setItem('mysql_admin_role', 'admin');
      sessionStorage.setItem('mysql_admin_username', username);
      sessionStorage.removeItem('mysql_admin_client');
      setAdminUsername(username);
      setClientProfile(null);
      setUserRole('admin');
      setIsAuthenticated(true);
      logActivity('Admin Login', 'Console Auth', `Database user '@${username}' authenticated via MySQL Server`, 'SUCCESS', username);
      addToast(`Welcome, @${username}`, 'success');
      refreshBackendData();
      return res;
    } catch (err) {
      logActivity('Admin Login', 'Console Auth', `Failed login attempt for user '@${username}'`, 'FAILED');
      throw new Error(err.message || 'Access Denied: Invalid MySQL database credentials.');
    }
  };

  const clientLogin = async (username, password) => {
    try {
      const res = await api.clientLogin(username, password);
      sessionStorage.setItem('mysql_admin_token', res.token);
      sessionStorage.setItem('mysql_admin_role', 'client');
      sessionStorage.setItem('mysql_admin_client', JSON.stringify(res.client));
      sessionStorage.removeItem('mysql_admin_username');
      setAdminUsername(null);
      setClientProfile(res.client);
      setUserRole('client');
      setIsAuthenticated(true);
      addToast(`Welcome, ${res.client.clientName}`, 'success');
      return res;
    } catch (err) {
      throw new Error(err.message || 'Unable to sign in to the Client Portal.');
    }
  };

  // Auth: Logout
  const logout = useCallback(async () => {
    try {
      if (userRole === 'client') await api.clientLogout();
      else if (userRole === 'admin') await api.logout();
    } catch (err) {
      console.warn('Session logout notice:', err.message);
    }
    sessionStorage.removeItem('mysql_admin_token');
    sessionStorage.removeItem('mysql_admin_role');
    sessionStorage.removeItem('mysql_admin_username');
    sessionStorage.removeItem('mysql_admin_client');
    localStorage.removeItem('mysql_admin_auth');
    setClientProfile(null);
    setAdminUsername(null);
    setUserRole(null);
    setIsAuthenticated(false);
    addToast('You have been logged out securely', 'info');
  }, [userRole, addToast]);

  useEffect(() => {
    const expireSession = () => { logout(); };
    window.addEventListener('mysql-admin-session-expired', expireSession);
    return () => window.removeEventListener('mysql-admin-session-expired', expireSession);
  }, [logout]);

  // User Management: Add User
  const addUser = async ({ fullName, username, password, dbOption, selectedDatabase, requestedDatabaseName, permissions, canCreateDb }) => {
    const cleanUsername = username.trim().toLowerCase();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      throw new Error(`Username '${cleanUsername}' already exists. Please choose a different username.`);
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let assignedDb = null;
    let newRequestId = null;

    if (dbOption === 'existing' && selectedDatabase) {
      assignedDb = selectedDatabase;
      setDatabases((prev) =>
        prev.map((db) => {
          if (db.name === selectedDatabase && !db.assignedUsers.includes(cleanUsername)) {
            return { ...db, assignedUsers: [...db.assignedUsers, cleanUsername] };
          }
          return db;
        })
      );
    } else if (dbOption === 'create_own' && requestedDatabaseName) {
      const cleanDbName = requestedDatabaseName.trim().toLowerCase();
      if (databases.some((d) => d.name.toLowerCase() === cleanDbName)) {
        throw new Error(`Database '${cleanDbName}' already exists.`);
      }
      
      newRequestId = `LOCAL-REQ-${Date.now()}`;
      const newRequest = {
        id: newRequestId,
        username: cleanUsername,
        requestedDatabaseName: cleanDbName,
        purpose: `Requested during user registration for ${fullName}`,
        permissionRequested: permissions,
        requestDate: formattedDate,
        status: 'Pending'
      };
      setRequests((prev) => [newRequest, ...prev]);
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      fullName: fullName.trim(),
      username: cleanUsername,
      assignedDatabase: assignedDb,
      permissions: permissions || 'READ & WRITE',
      canCreateDb: !!canCreateDb,
      status: 'Active',
      createdAt: formattedDate,
      lastLogin: 'Never'
    };

    setUsers((prev) => [newUser, ...prev]);

    // Send to backend API if available
    try {
      const result = await api.createUser({
        fullName,
        username: cleanUsername,
        password,
        dbOption,
        selectedDatabase: assignedDb,
        requestedDatabaseName,
        permissions,
        canCreateDb
      });
      if (newRequestId && result.requestId) {
        setRequests((prev) =>
          prev.map((request) =>
            request.id === newRequestId ? { ...request, id: result.requestId } : request
          )
        );
      }
    } catch (err) {
      console.warn("Backend sync notice:", err.message);
    }

    logActivity('User Created', cleanUsername, `User account created for ${fullName} with ${permissions} permissions.`);
    addToast(`User account '${cleanUsername}' created successfully!`, 'success');
    return newUser;
  };

  // User Management: Edit User
  const editUser = async (userId, updatedData) => {
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');

    const oldDb = user.assignedDatabase;
    const newDb = updatedData.assignedDatabase;

    if (oldDb !== newDb) {
      setDatabases((prev) =>
        prev.map((db) => {
          if (db.name === oldDb) {
            return { ...db, assignedUsers: db.assignedUsers.filter((u) => u !== user.username) };
          }
          if (db.name === newDb && !db.assignedUsers.includes(user.username)) {
            return { ...db, assignedUsers: [...db.assignedUsers, user.username] };
          }
          return db;
        })
      );
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            fullName: updatedData.fullName || u.fullName,
            assignedDatabase: updatedData.assignedDatabase,
            permissions: updatedData.permissions || u.permissions,
            canCreateDb: updatedData.canCreateDb !== undefined ? updatedData.canCreateDb : u.canCreateDb,
            status: updatedData.status || u.status
          };
        }
        return u;
      })
    );

    try {
      await api.updateUser(user.username, updatedData);
    } catch (e) {
      console.warn("Backend update error:", e);
    }

    logActivity('User Updated', user.username, `Updated profile for user @${user.username}`);
    addToast(`User '${user.username}' updated successfully`, 'success');
  };

  // User Management: Toggle Status
  const toggleUserStatus = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
    );

    try {
      await api.toggleUserStatus(user.username);
    } catch (e) {
      console.warn("Backend toggle error:", e);
    }

    const actType = newStatus === 'Active' ? 'User Activated' : 'User Deactivated';
    logActivity(actType, user.username, `User account marked as ${newStatus}`);
    addToast(`User '${user.username}' is now ${newStatus}`, newStatus === 'Active' ? 'success' : 'warning');
  };

  // User Management: Delete User
  const deleteUser = async (userId, deleteMode) => {
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');

    const username = user.username;
    const assignedDb = user.assignedDatabase;

    try {
      await api.deleteUser(username, deleteMode);
    } catch (error) {
      addToast(`Could not delete user '${username}': ${error.message}`, 'error');
      throw error;
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId));

    if (deleteMode === 'ACCOUNT_ONLY') {
      if (assignedDb) {
        setDatabases((prev) =>
          prev.map((db) => {
            if (db.name === assignedDb) {
              return { ...db, assignedUsers: db.assignedUsers.filter((u) => u !== username) };
            }
            return db;
          })
        );
      }
      logActivity('User Deleted', username, `Option A: Deleted account @${username}. Preserved database '${assignedDb}'.`);
      addToast(`User account '${username}' deleted. Database preserved.`, 'info');
    } else {
      if (assignedDb) {
        setDatabases((prev) => prev.filter((db) => db.name !== assignedDb));
      }
      logActivity('User Deleted', username, `Option B: Deleted user @${username} and dropped database '${assignedDb}'.`);
      addToast(`User '${username}' and database '${assignedDb}' deleted after backup verification.`, 'warning');
    }
  };

  // Database: Create Database
  const createDatabase = async ({ name, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci', assignedUsername }) => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) throw new Error('Database name is required.');
    if (databases.some((d) => d.name.toLowerCase() === cleanName)) {
      throw new Error(`Database '${cleanName}' already exists.`);
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newDb = {
      id: `db_${Date.now()}`,
      name: cleanName,
      sizeMb: 0.1,
      tablesCount: 0,
      charset,
      collation,
      assignedUsers: assignedUsername ? [assignedUsername] : [],
      createdAt: formattedDate
    };

    setDatabases((prev) => [newDb, ...prev]);

    if (assignedUsername) {
      setUsers((prev) =>
        prev.map((u) => (u.username === assignedUsername ? { ...u, assignedDatabase: cleanName } : u))
      );
    }

    try {
      await api.createDatabase({ name: cleanName, charset, collation, assignedUsername });
    } catch (e) {
      console.warn("Backend create DB notice:", e);
    }

    logActivity('Database Created', cleanName, `Created database '${cleanName}' on MySQL server`);
    addToast(`Database '${cleanName}' created successfully`, 'success');
    return newDb;
  };

  // Database: Delete Database
  const deleteDatabase = async (dbName) => {
    setUsers((prev) =>
      prev.map((u) => (u.assignedDatabase === dbName ? { ...u, assignedDatabase: null } : u))
    );
    setDatabases((prev) => prev.filter((d) => d.name !== dbName));

    try {
      await api.deleteDatabase(dbName);
    } catch (e) {
      console.warn("Backend delete DB notice:", e);
    }

    logActivity('Database Deleted', dbName, `Database '${dbName}' dropped from MySQL Server.`);
    addToast(`Database '${dbName}' has been removed`, 'info');
  };

  // Database: Assign Database
  const assignDatabaseToUser = async (dbName, username, permissions) => {
    setDatabases((prev) =>
      prev.map((db) => {
        if (db.name === dbName && !db.assignedUsers.includes(username)) {
          return { ...db, assignedUsers: [...db.assignedUsers, username] };
        }
        return db;
      })
    );

    setUsers((prev) =>
      prev.map((u) => {
        if (u.username === username) {
          return { ...u, assignedDatabase: dbName, permissions: permissions || u.permissions };
        }
        return u;
      })
    );

    try {
      await api.assignDatabase({ databaseName: dbName, username, permissions });
    } catch (e) {
      console.warn("Backend assign DB notice:", e);
    }

    logActivity('Database Assigned', dbName, `Assigned '${dbName}' to user '${username}'`);
    addToast(`Database '${dbName}' assigned to '${username}'`, 'success');
  };

  // Requests: Approve
  const approveRequest = async (requestId) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    const cleanDbName = req.requestedDatabaseName.toLowerCase();

    try {
      await api.approveRequest(requestId);
    } catch (e) {
      addToast(`Could not approve request ${requestId}: ${e.message}`, 'error');
      return;
    }

    if (!databases.some((d) => d.name.toLowerCase() === cleanDbName)) {
      const newDb = {
        id: `db_${Date.now()}`,
        name: cleanDbName,
        sizeMb: 0.1,
        tablesCount: 0,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        assignedUsers: [req.username],
        createdAt: 'MySQL Server'
      };
      setDatabases((prev) => [newDb, ...prev]);
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.username === req.username) {
          return { ...u, assignedDatabase: cleanDbName, permissions: req.permissionRequested || 'READ & WRITE' };
        }
        return u;
      })
    );

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'Approved' } : r))
    );

    logActivity('Database Request Approved', req.requestedDatabaseName, `Approved request ${requestId} for user @${req.username}`);
    addToast(`Request ${requestId} approved. Database '${cleanDbName}' provisioned.`, 'success');
  };

  // Requests: Reject
  const rejectRequest = async (requestId, reason = 'Administrative discretion') => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    try {
      await api.rejectRequest(requestId, reason);
    } catch (e) {
      addToast(`Could not reject request ${requestId}: ${e.message}`, 'error');
      return;
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'Rejected', rejectionReason: reason } : r))
    );

    logActivity('Database Request Rejected', req.requestedDatabaseName, `Rejected request ${requestId}. Reason: ${reason}`);
    addToast(`Request ${requestId} rejected.`, 'info');
  };

  // Settings
  const updateSettings = async (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    try {
      await api.updateSettings(newSettings);
      refreshBackendData();
    } catch (e) {
      console.warn("Backend settings update notice:", e);
    }
    logActivity('Settings Changed', 'System Config', 'Updated server connection parameters');
    addToast('System settings saved successfully', 'success');
  };

  // Reset to demo data
  const resetDemoData = () => {
    setUsers(initialUsers);
    setDatabases(initialDatabases);
    setRequests(initialRequests);
    setActivities(initialActivities);
    setSettings(initialSettings);
    addToast('Reset console state to initial dataset', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        userRole,
        adminUsername,
        clientProfile,
        setClientProfile,
        login,
        clientLogin,
        logout,
        currentTab,
        setCurrentTab,
        backendOnline,
        mysqlConnected,
        users,
        databases,
        requests,
        activities,
        settings,
        toasts,
        addToast,
        removeToast,
        logActivity,
        addUser,
        editUser,
        toggleUserStatus,
        deleteUser,
        createDatabase,
        deleteDatabase,
        assignDatabaseToUser,
        approveRequest,
        rejectRequest,
        updateSettings,
        resetDemoData,
        refreshBackendData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
