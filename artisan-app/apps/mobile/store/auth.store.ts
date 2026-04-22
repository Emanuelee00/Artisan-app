import { create } from 'zustand'
import type { User, AuthTokens } from '@artisan/shared-types'

interface AuthState {
  user:   User | null
  tokens: AuthTokens | null
  login:  (user: User, tokens: AuthTokens) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:   null,
  tokens: null,
  login:  (user, tokens) => set({ user, tokens }),
  logout: () => set({ user: null, tokens: null }),
}))
