import api from './axios'

export const getClients = (params) => api.get('/clients/', { params })
export const getClient = (id) => api.get(`/clients/${id}/`)
export const createClient = (data) => api.post('/clients/', data)
export const updateClient = (id, data) => api.patch(`/clients/${id}/`, data)
export const deleteClient = (id) => api.delete(`/clients/${id}/`)
export const getClientNotes = (id) => api.get(`/clients/${id}/notes/`)
export const addClientNote = (id, text) => api.post(`/clients/${id}/add_note/`, { text })
export const getProviders = () => api.get('/clients/providers/')
export const createProvider = (data) => api.post('/clients/providers/', data)
