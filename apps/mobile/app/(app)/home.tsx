import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/auth.store'
import { JobsAPI } from '../../services/jobs'
import BottomTabBar from '../../components/BottomTabBar'
import type { Job } from '@artisan/shared-types'

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', accepted: '#3b82f6', in_progress: '#8b5cf6', completed: '#10b981', cancelled: '#94a3b8',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa', accepted: 'Accettato', in_progress: 'In corso', completed: 'Completato', cancelled: 'Annullato',
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{job.title}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[job.status] + '20' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[job.status] }]}>
            {STATUS_LABEL[job.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSub}>{job.category}  ·  {job.address}</Text>
      {job.estimatedPrice != null && (
        <Text style={styles.price}>~€{job.estimatedPrice}</Text>
      )}
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const user      = useAuthStore((s) => s.user)
  const isArtisan = user?.role === 'artisan'

  const { data: jobs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', 'home', user?.role],
    queryFn:  () => isArtisan
      ? JobsAPI.list({ status: 'pending' })
      : JobsAPI.list({ mine: true }),
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.greeting}>Ciao, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={styles.headerSub}>
          {isArtisan ? 'Lavori disponibili vicino a te' : 'I tuoi lavori recenti'}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
      ) : (
        <FlatList
          data={jobs ?? []}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{isArtisan ? '📋' : '🔧'}</Text>
              <Text style={styles.emptyText}>
                {isArtisan ? 'Nessun lavoro disponibile' : 'Nessun lavoro ancora'}
              </Text>
              {!isArtisan && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(app)/jobs/new' as never)}>
                  <Text style={styles.emptyBtnText}>Crea il primo lavoro</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <JobCard job={item} onPress={() => router.push(`/(app)/jobs/${item.id}` as never)} />
          )}
        />
      )}

      {!isArtisan && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 80 + insets.bottom }]}
          onPress={() => router.push('/(app)/jobs/new' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <BottomTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  header:       { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  greeting:     { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  headerSub:    { fontSize: 13, color: '#64748b', marginTop: 2 },
  card:         {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:    { fontSize: 15, fontWeight: '600', color: '#1e293b', flex: 1 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText:    { fontSize: 11, fontWeight: '600' },
  cardSub:      { fontSize: 12, color: '#64748b' },
  price:        { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 4 },
  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 16, color: '#64748b', marginBottom: 16 },
  emptyBtn:     { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '600' },
  fab:          {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  fabText:      { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
})
