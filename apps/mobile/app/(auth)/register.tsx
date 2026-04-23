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

const CATEGORIES = ['Elettricista', 'Idraulico', 'Falegname', 'Muratore', 'Pittore', 'Giardiniere', 'Pulizie', 'Altro']

const step1Schema = z.object({
  name:     z.string().min(2, 'Min 2 caratteri'),
  email:    z.string().email('Email non valida'),
  password: z.string().min(6, 'Min 6 caratteri'),
  phone:    z.string().min(8, 'Numero non valido'),
})

export default function RegisterScreen() {
  const router    = useRouter()
  const { login } = useAuthStore()

  const [step,     setStep]     = useState<1 | 2>(1)
  const [role,     setRole]     = useState<'client' | 'artisan'>('client')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [phone,    setPhone]    = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [hourly,   setHourly]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  function handleStep1() {
    const result = step1Schema.safeParse({ name, email, password, phone })
    if (!result.success) { setError(result.error.issues[0].message); return }
    setError(null)
    if (role === 'artisan') { setStep(2); return }
    submit()
  }

  async function submit(artisanFields?: { category: string; hourlyRate?: number }) {
    setLoading(true)
    try {
      const { user, accessToken, refreshToken } = await UsersAPI.register({
        name: name.trim(), email: email.trim(), password, phone: phone.trim(), role,
        ...artisanFields,
      })
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
        <Text style={styles.title}>Crea account</Text>
        <Text style={styles.subtitle}>
          {step === 1 ? 'Inserisci i tuoi dati' : 'Profilo artigiano'}
        </Text>

        {step === 1 && (
          <>
            <View style={styles.roleRow}>
              {(['client', 'artisan'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleTxt, role === r && styles.roleTxtActive]}>
                    {r === 'client' ? '👤 Cliente' : '🔧 Artigiano'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="Nome completo" value={name} onChangeText={setName} />
            <TextInput
              style={styles.input} placeholder="Email" value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address"
            />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.btn} onPress={handleStep1} disabled={loading} activeOpacity={0.8}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{role === 'artisan' ? 'Avanti →' : 'Registrati'}</Text>}
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.link}>
                <Text style={styles.linkText}>
                  Hai già un account? <Text style={styles.linkBold}>Accedi</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, category === cat && styles.catBtnActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catTxt, category === cat && styles.catTxtActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder="Tariffa oraria (€)"
              value={hourly}
              onChangeText={setHourly}
              keyboardType="decimal-pad"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={styles.btn}
              onPress={() => submit({ category, hourlyRate: hourly ? parseFloat(hourly) : undefined })}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Registrati</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => setStep(1)}>
              <Text style={styles.linkText}>← Indietro</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:     { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  logo:          { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title:         { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#1e293b' },
  subtitle:      { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, marginTop: 4 },
  roleRow:       { flexDirection: 'row', gap: 8, marginBottom: 20 },
  roleBtn:       { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  roleBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  roleTxt:       { fontSize: 14, color: '#64748b', fontWeight: '500' },
  roleTxtActive: { color: '#2563eb', fontWeight: '700' },
  label:         { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  catBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', marginRight: 8 },
  catBtnActive:  { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  catTxt:        { fontSize: 13, color: '#64748b' },
  catTxtActive:  { color: '#2563eb', fontWeight: '600' },
  input:         {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    padding: 14, marginBottom: 12, fontSize: 15, backgroundColor: '#f8fafc',
  },
  error:         { color: '#ef4444', marginBottom: 12, textAlign: 'center', fontSize: 13 },
  btn:           { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  link:          { marginTop: 20, alignItems: 'center' },
  linkText:      { color: '#64748b', fontSize: 14 },
  linkBold:      { color: '#2563eb', fontWeight: '600' },
})
