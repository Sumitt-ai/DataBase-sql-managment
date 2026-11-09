// Dynamic backend URL based on host accessed (localhost or LAN IP)
const getApiBaseUrl = () => {
  const host = window.location.hostname || '127.0.0.1';
  return `http://${host}:8000/api`;
};

const request = async (endpoint, options = {}) => {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const token = sessionStorage.getItem('mysql_admin_token');
  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (token) defaultHeaders.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new Event('mysql-admin-session-expired'));
    }
    const errorMsg = data?.detail || `HTTP Error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};

const download = async (endpoint) => {
  const token = sessionStorage.getItem('mysql_admin_token');
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401) window.dispatchEvent(new Event('mysql-admin-session-expired'));
    throw new Error(data?.detail || `HTTP Error ${response.status}`);
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: await response.blob(),
    filename: encodedName ? decodeURIComponent(encodedName) : quotedName || 'download',
  };
};

export const api = {
  // System & Connection
  getStatus: () => request('/system/status'),

  // Auth
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  clientLogin: (username, password) =>
    request('/client/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  clientLogout: () => request('/client/auth/logout', { method: 'POST' }),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Users
  getUsers: () => request('/users'),
  createUser: (userData) =>
    request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  updateUser: (username, userData) =>
    request(`/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  toggleUserStatus: (username) =>
    request(`/users/${username}/status`, {
      method: 'PATCH',
    }),
  deleteUser: (username, deleteMode) =>
    request(`/users/${username}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteMode }),
    }),

  // Databases
  getDatabases: () => request('/databases'),
  createDatabase: (dbData) =>
    request('/databases', {
      method: 'POST',
      body: JSON.stringify(dbData),
    }),
  deleteDatabase: (dbName) =>
    request(`/databases/${dbName}`, {
      method: 'DELETE',
    }),
  assignDatabase: (data) =>
    request('/databases/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Requests
  getRequests: () => request('/requests'),
  approveRequest: (requestId) =>
    request(`/requests/${requestId}/approve`, {
      method: 'POST',
    }),
  rejectRequest: (requestId, reason) =>
    request(`/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Activities
  getActivities: () => request('/activities'),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (settingsData) =>
    request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    }),

  // Client Portal enrollments and permissions for existing MySQL users
  getClients: () => request('/admin/clients'),
  createClient: (clientData) => request('/admin/clients', { method: 'POST', body: JSON.stringify(clientData) }),
  setClientStatus: (clientId, isActive) =>
    request(`/admin/clients/${clientId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  removeClient: (clientId) => request(`/admin/clients/${clientId}`, { method: 'DELETE' }),
  updateClientPermissions: (clientId, permissions) =>
    request(`/admin/clients/${clientId}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  getAdminClientFiles: (clientId) => request(`/admin/clients/${clientId}/files`),
  getAdminClientActivity: (clientId) => request(`/admin/clients/${clientId}/activity`),
  downloadAdminClientFile: (clientId, fileId) => download(`/admin/clients/${clientId}/files/${fileId}/download`),

  // Client Portal
  getClientMe: () => request('/client/me'),
  getClientDashboard: () => request('/client/dashboard'),
  updateClientProfile: (clientName) =>
    request('/client/profile', { method: 'PUT', body: JSON.stringify({ clientName }) }),
  getClientFiles: () => request('/client/files'),
  uploadClientFile: (formData) => request('/client/files/upload', { method: 'POST', body: formData }),
  downloadClientFile: (fileId) => download(`/client/files/${fileId}/download`),
  recycleClientFile: (fileId) => request(`/client/files/${fileId}/recycle`, { method: 'POST' }),
  getClientRecycleBin: () => request('/client/recycle-bin'),
  restoreClientFile: (fileId) => request(`/client/recycle-bin/${fileId}/restore`, { method: 'POST' }),
  getClientWorkbook: (fileId) => request(`/client/workbook/${fileId}`),
  saveClientWorkbook: (fileId, workbook) =>
    request(`/client/workbook/${fileId}`, { method: 'PUT', body: JSON.stringify(workbook) }),
  getClientActivity: () => request('/client/activity'),
};
