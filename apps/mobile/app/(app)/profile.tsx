import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/auth.store'
import { UsersAPI } from '../../services/auth'
import BottomTabBar from '../../components/BottomTabBar'
import type { ArtisanProfile } from '@artisan/shared-types'

export default function ProfileScreen() {
  const router           = useRouter()
  const insets           = useSafeAreaInsets()
  const { user, logout } = useAuthStore()
  const isArtisan        = user?.role === 'artisan'

  const { data: artisan } = useQuery<ArtisanProfile>({
    queryKey: ['artisan-profile'],
    queryFn:  UsersAPI.artisanProfile,
    enabled:  isArtisan,
  })

  async function handleLogout() {
    Alert.alert('Esci', 'Vuoi davvero uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Profilo</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user?.role === 'artisan' ? '🔧 Artigiano' : '👤 Cliente'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow icon="✉️" label="Email"    value={user?.email ?? ''} />
          <InfoRow icon="📞" label="Telefono" value={user?.phone ?? ''} />
        </View>

        {isArtisan && artisan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profilo artigiano</Text>
            <InfoRow icon="🔧" label="Categoria"  value={artisan.category} />
            {artisan.hourlyRate != null && (
              <InfoRow icon="💶" label="Tariffa/h"  value={`€${artisan.hourlyRate}`} />
            )}
            <InfoRow
              icon="⭐"
              label="Valutazione"
              value={`${artisan.rating.toFixed(1)} (${artisan.reviewCount} rec.)`}
            />
            {artisan.radiusKm != null && (
              <InfoRow icon="📍" label="Raggio" value={`${artisan.radiusKm} km`} />
            )}
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowIcon}>✅</Text>
              <View>
                <Text style={styles.rowLabel}>Stato</Text>
                <Text style={[styles.rowValue, { color: artisan.isVerified ? '#10b981' : '#f59e0b' }]}>
                  {artisan.isVerified ? 'Verificato' : 'In attesa di verifica'}
                </Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Esci dall'account</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomTabBar />
    </View>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header:        { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title:         { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar:        { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:    { fontSize: 32, color: '#fff', fontWeight: '700' },
  name:          { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  roleBadge:     { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  card:          { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  row:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowIcon:       { fontSize: 18, width: 32 },
  rowLabel:      { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue:      { fontSize: 14, color: '#1e293b', marginTop: 1 },
  logoutBtn:     { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ef4444', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  logoutText:    { color: '#ef4444', fontWeight: '700', fontSize: 16 },
})
