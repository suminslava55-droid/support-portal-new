import api from './axios'

export const getUsers = () => api.get('/accounts/users/')
export const createUser = (data) => api.post('/accounts/users/', data)
export const updateUser = (id, data) => api.patch(`/accounts/users/${id}/`, data)
export const deleteUser = (id) => api.delete(`/accounts/users/${id}/`)
export const setPassword = (id, password) =>
  api.post(`/accounts/users/${id}/set_password/`, { password })
export const getRoles = () => api.get('/accounts/roles/')
