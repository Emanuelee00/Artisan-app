import axios from 'axios'
import { useAuthStore } from '../store/auth.store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export const api = axios.create({ baseURL: BASE_URL })

// Aggiunge il token JWT a ogni richiesta
api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})
