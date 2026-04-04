import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // Refresh token при 401
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh/', { refresh })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }

    // Retry при сетевых ошибках и 5xx (не для POST/PATCH/DELETE и не для upload)
    const isIdempotent = ['get', 'GET'].includes(original.method)
    const isServerError = error.response?.status >= 500
    const isNetworkError = !error.response

    if ((isServerError || isNetworkError) && isIdempotent && !original._retryCount) {
      original._retryCount = 1
      await sleep(1000)
      return api(original)
    }

    return Promise.reject(error)
  }
)

export default api
