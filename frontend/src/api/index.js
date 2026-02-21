import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Автоматически добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Автообновление токена при 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', { refresh });
          localStorage.setItem('access_token', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  login: (email, password) => api.post('/auth/token/', { email, password }),
  me: () => api.get('/auth/users/me/'),
};

export const clientsAPI = {
  list: (params) => api.get('/clients/', { params }),
  get: (id) => api.get(`/clients/${id}/`),
  create: (data) => api.post('/clients/', data),
  update: (id, data) => api.patch(`/clients/${id}/`, data),
  delete: (id) => api.delete(`/clients/${id}/`),
  getNotes: (id) => api.get(`/clients/${id}/notes/`),
  addNote: (id, text) => api.post(`/clients/${id}/notes/`, { text }),
  createDraft: () => api.post('/clients/create_draft/'),
  discardDraft: (id) => api.delete(`/clients/${id}/discard_draft/`),
  getFiles: (id) => api.get(`/clients/${id}/files/`),
  uploadFile: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/clients/${id}/files/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteFile: (clientId, fileId) => api.delete(`/clients/${clientId}/files/${fileId}/`),
};

export const usersAPI = {
  list: () => api.get('/auth/users/'),
  create: (data) => api.post('/auth/users/', data),
  update: (id, data) => api.patch(`/auth/users/${id}/`, data),
  delete: (id) => api.delete(`/auth/users/${id}/`),
};

export const rolesAPI = {
  list: () => api.get('/auth/roles/'),
  update: (id, data) => api.patch(`/auth/roles/${id}/`, data),
};

export const customFieldsAPI = {
  list: () => api.get('/clients/custom-fields/'),
  create: (data) => api.post('/clients/custom-fields/', data),
  update: (id, data) => api.patch(`/clients/custom-fields/${id}/`, data),
  delete: (id) => api.delete(`/clients/custom-fields/${id}/`),
};

export const settingsAPI = {
  get: () => api.get('/clients/system-settings/'),
  save: (data) => api.post('/clients/system-settings/', data),
};
