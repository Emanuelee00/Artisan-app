import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/auth.store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 })

api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { error?: string })?.error ?? error.message
  }
  return 'Errore sconosciuto'
}
