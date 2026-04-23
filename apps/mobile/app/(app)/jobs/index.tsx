import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../../store/auth.store'
import { JobsAPI } from '../../../services/jobs'
import BottomTabBar from '../../../components/BottomTabBar'
import type { Job, JobStatus } from '@artisan/shared-types'

const FILTERS: { label: string; status?: JobStatus }[] = [
  { label: 'Tutti' },
  { label: 'Attivi',     status: 'pending' },
  { label: 'Accettati',  status: 'accepted' },
  { label: 'In corso',   status: 'in_progress' },
  { label: 'Completati', status: 'completed' },
]

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', accepted: '#3b82f6', in_progress: '#8b5cf6', completed: '#10b981', cancelled: '#94a3b8',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa', accepted: 'Accettato', in_progress: 'In corso', completed: 'Completato', cancelled: 'Annullato',
}

export default function JobsScreen() {
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const user      = useAuthStore((s) => s.user)
  const isArtisan = user?.role === 'artisan'
  const [filter, setFilter] = useState<JobStatus | undefined>()

  const { data: jobs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', 'list', user?.role, filter],
    queryFn:  () => JobsAPI.list({
      mine:   !isArtisan || undefined,
      status: filter,
    }),
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Lavori</Text>
        {!isArtisan && (
          <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/(app)/jobs/new' as never)}>
            <Text style={styles.newBtnText}>+ Nuovo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterBtn, filter === f.status && styles.filterBtnActive]}
            onPress={() => setFilter(f.status)}
          >
            <Text style={[styles.filterTxt, filter === f.status && styles.filterTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
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
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Nessun lavoro trovato</Text>
            </View>
          }
          renderItem={({ item }: { item: Job }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/jobs/${item.id}` as never)}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                  <Text style={[styles.badgeTxt, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>{item.category}  ·  {item.address}</Text>
              {item.estimatedPrice != null && (
                <Text style={styles.price}>~€{item.estimatedPrice}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <BottomTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  header:          { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:           { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  newBtn:          { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnText:      { color: '#fff', fontWeight: '600', fontSize: 13 },
  filters:         { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filterBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filterBtnActive: { backgroundColor: '#2563eb' },
  filterTxt:       { fontSize: 12, color: '#64748b', fontWeight: '500' },
  filterTxtActive: { color: '#fff', fontWeight: '700' },
  card:            { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:       { fontSize: 15, fontWeight: '600', color: '#1e293b', flex: 1 },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt:        { fontSize: 11, fontWeight: '600' },
  cardSub:         { fontSize: 12, color: '#64748b' },
  price:           { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 4 },
  empty:           { alignItems: 'center', paddingTop: 80 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 16, color: '#64748b' },
})
