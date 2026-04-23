import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '../../store/auth.store'

export default function AuthLayout() {
  const { user, isLoading } = useAuthStore()

  // Una volta che lo store è inizializzato e l'utente è loggato → vai all'app
  if (!isLoading && user) return <Redirect href="/(app)/home" />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login"    />
      <Stack.Screen name="register" />
    </Stack>
  )
}
