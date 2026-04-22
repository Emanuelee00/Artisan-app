import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/auth.store'

export default function LoginScreen() {
  const router  = useRouter()
  const { login } = useAuthStore()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Artisan App</Text>
      {/* TODO: aggiungere form completo */}
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(app)/home')}>
        <Text style={styles.btnText}>Accedi</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 28, fontWeight: '700', marginBottom: 32, textAlign: 'center' },
  btn:       { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText:   { color: '#fff', fontWeight: '600', fontSize: 16 },
})
