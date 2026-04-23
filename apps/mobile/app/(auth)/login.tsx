import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useRouter, Link } from 'expo-router'
import { z } from 'zod'
import { UsersAPI } from '../../services/auth'
import { useAuthStore } from '../../store/auth.store'
import { apiError } from '../../services/api'

const schema = z.object({
  email:    z.string().email('Email non valida'),
  password: z.string().min(6, 'Min 6 caratteri'),
})

export default function LoginScreen() {
  const router    = useRouter()
  const { login } = useAuthStore()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin() {
    const result = schema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { user, accessToken, refreshToken } = await UsersAPI.login(email.trim(), password)
      await login(user, { accessToken, refreshToken })
      router.replace('/(app)/home')
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🔧</Text>
        <Text style={styles.title}>Artisan App</Text>
        <Text style={styles.subtitle}>Accedi al tuo account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Accedi</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>
              Non hai un account? <Text style={styles.linkBold}>Registrati</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  logo:      { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title:     { fontSize: 30, fontWeight: '700', textAlign: 'center', color: '#1e293b' },
  subtitle:  { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32, marginTop: 4 },
  input:     {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    padding: 14, marginBottom: 12, fontSize: 15, backgroundColor: '#f8fafc',
  },
  error:     { color: '#ef4444', marginBottom: 12, textAlign: 'center', fontSize: 13 },
  btn:       { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  link:      { marginTop: 20, alignItems: 'center' },
  linkText:  { color: '#64748b', fontSize: 14 },
  linkBold:  { color: '#2563eb', fontWeight: '600' },
})
