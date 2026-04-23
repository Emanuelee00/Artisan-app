import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User } from '@artisan/shared-types'

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
}

interface AuthState {
  user:       User | null
  tokens:     AuthTokens | null
  isLoading:  boolean

  login:      (user: User, tokens: AuthTokens) => Promise<void>
  logout:     () => Promise<void>
  initialize: () => Promise<void>
}

const KEYS = { tokens: 'artisan_tokens', user: 'artisan_user' }

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  tokens:    null,
  isLoading: true,

  login: async (user, tokens) => {
    await SecureStore.setItemAsync(KEYS.tokens, JSON.stringify(tokens))
    await SecureStore.setItemAsync(KEYS.user,   JSON.stringify(user))
    set({ user, tokens })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(KEYS.tokens)
    await SecureStore.deleteItemAsync(KEYS.user)
    set({ user: null, tokens: null })
  },

  initialize: async () => {
    try {
      const [tokensJson, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.tokens),
        SecureStore.getItemAsync(KEYS.user),
      ])
      if (tokensJson && userJson) {
        set({ tokens: JSON.parse(tokensJson), user: JSON.parse(userJson) })
      }
    } catch {
      // SecureStore non disponibile (simulator senza keychain) — ignora
    } finally {
      set({ isLoading: false })
    }
  },
}))
