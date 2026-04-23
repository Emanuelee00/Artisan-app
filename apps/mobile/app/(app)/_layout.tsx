import { Stack, Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuthStore } from '../../store/auth.store'

export default function AppLayout() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!user) return <Redirect href="/(auth)/login" />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home"           />
      <Stack.Screen name="jobs/index"     />
      <Stack.Screen name="jobs/new"       options={{ presentation: 'modal' }} />
      <Stack.Screen name="jobs/[id]"      />
      <Stack.Screen name="chat/[jobId]"   />
      <Stack.Screen name="payments/index" />
      <Stack.Screen name="profile"        />
    </Stack>
  )
}
