import { api } from './api'
import type { User, UserRole } from '@artisan/shared-types'
import type { AuthTokens } from '../store/auth.store'

export interface LoginResponse {
  user:         User
  accessToken:  string
  refreshToken: string
}

export interface RegisterDto {
  email:      string
  password:   string
  name:       string
  phone:      string
  role:       UserRole
  // artisan only
  category?:   string
  bio?:        string
  hourlyRate?: number
  lat?:        number
  lng?:        number
  radiusKm?:   number
}

export const UsersAPI = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    api.post('/users/login', { email, password }).then((r) => r.data),

  register: (data: RegisterDto): Promise<LoginResponse> =>
    api.post('/users/register', data).then((r) => r.data),

  me: (): Promise<User> =>
    api.get('/users/me').then((r) => r.data),

  logout: (): Promise<void> =>
    api.post('/users/logout').then((r) => r.data),

  artisanProfile: () =>
    api.get('/users/me/artisan-profile').then((r) => r.data),

  updateProfile: (data: Partial<RegisterDto>) =>
    api.put('/users/me', data).then((r) => r.data),
}
