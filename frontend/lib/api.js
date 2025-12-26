import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
  : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/checkin/')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Teams API
export const teamsAPI = {
  getAll: () => api.get('/teams'),
  getById: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post('/teams', data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  delete: (id) => api.delete(`/teams/${id}`),
  generateToken: (id, expiresAt) => api.post(`/teams/${id}/token`, { expires_at: expiresAt }),
  getTokens: (id) => api.get(`/teams/${id}/tokens`),
};

// Check-in API
export const checkinAPI = {
  submit: (data) => api.post('/checkin/submit', data),
  verifyToken: (token) => api.get(`/checkin/verify/${token}`),
};

// Public check-in API (no auth)
export const publicCheckinAPI = {
  validate: (teamToken) => api.get(`/public/checkin/${teamToken}`),
  submit: (teamToken, data) => api.post(`/public/checkin/${teamToken}`, data),
  getByTeam: (teamCode) => api.get(`/public/checkin/by-team/${teamCode}`),
};

// Dashboard API
export const dashboardAPI = {
  getOverview: (teamId, params) => api.get(`/dashboard/team/${teamId}/overview`, { params }),
  getCorrelation: (teamId, params) => api.get(`/dashboard/team/${teamId}/correlation`, { params }),
  getActivity: (teamId, params) => api.get(`/dashboard/team/${teamId}/activity`, { params }),
};

// Attendance API
export const attendanceAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/attendance/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getTemplate: () => api.get('/attendance/template'),
  getStats: (teamId, params) => api.get(`/attendance/team/${teamId}/stats`, { params }),
};

// Manager API
export const managerAPI = {
  getRecommendations: (teamId, params) => api.get(`/manager/recommendations/${teamId}`, { params }),
  uploadAttendance: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/manager/attendance/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getRecentAttendanceUploads: (params) => api.get('/manager/attendance/uploads/recent', { params }),
  getTeamAttendanceRecords: (teamId, params) =>
    api.get(`/manager/attendance/team/${teamId}/records`, { params }),
  getAttendanceRecords: (params) => api.get('/manager/attendance/records', { params }),
};

// HR API
export const hrAPI = {
  getDashboard: (params) => api.get('/hr/dashboard', { params }),
};

// Export API
export const exportAPI = {
  exportCSV: (teamId, params) => api.get(`/export/team/${teamId}/csv`, { params, responseType: 'blob' }),
  exportExcel: (teamId, params) => api.get(`/export/team/${teamId}/excel`, { params, responseType: 'blob' }),
  exportPDF: (teamId, params) => api.get(`/export/team/${teamId}/pdf`, { params, responseType: 'blob' }),
};

// Admin API
export const adminAPI = {
  createManager: (data) => api.post('/admin/managers', data),
  listManagers: () => api.get('/admin/managers'),
  deactivateManager: (id) => api.delete(`/admin/managers/${id}`),
  assignManagerToTeam: (teamId, managerId) =>
    api.put(
      `/admin/teams/${teamId}/manager`,
      managerId === null || managerId === undefined ? {} : { manager_id: managerId }
    ),
  createHR: (data) => api.post('/admin/hr', data),
  listHR: () => api.get('/admin/hr'),
  deactivateHR: (id) => api.delete(`/admin/hr/${id}`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  recalculateBurnout: () => api.post('/admin/maintenance/recalculate-burnout'),
  listCheckins: (params) => api.get('/admin/checkins', { params }),
  updateCheckin: (id, data) => api.put(`/admin/checkins/${id}`, data),
  deleteCheckin: (id) => api.delete(`/admin/checkins/${id}`),
};

export default api;

