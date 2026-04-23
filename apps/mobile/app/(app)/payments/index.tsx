import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../../store/auth.store'
import { PaymentsAPI } from '../../../services/payments'
import BottomTabBar from '../../../components/BottomTabBar'
import { apiError } from '../../../services/api'
import type { Payment } from '@artisan/shared-types'

const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  succeeded: '#10b981',
  failed:    '#ef4444',
  refunded:  '#8b5cf6',
}
const STATUS_LABEL: Record<string, string> = {
  pending:   'In attesa',
  succeeded: 'Completato',
  failed:    'Fallito',
  refunded:  'Rimborsato',
}

export default function PaymentsScreen() {
  const insets    = useSafeAreaInsets()
  const user      = useAuthStore((s) => s.user)
  const isArtisan = user?.role === 'artisan'

  const { data: payments, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['payments'],
    queryFn:  PaymentsAPI.list,
  })

  const { mutate: onboard, isPending: onboarding } = useMutation({
    mutationFn: () => PaymentsAPI.onboard(user?.email ?? ''),
    onSuccess: (data: { accountId: string; mockMode?: boolean }) => {
      Alert.alert('Stripe', data.mockMode ? 'Account creato (mock mode)' : 'Onboarding completato!')
    },
    onError: (err) => Alert.alert('Errore', apiError(err)),
  })

  const totalCents = payments?.reduce((s, p) => p.status === 'succeeded' ? s + p.amount : s, 0) ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Pagamenti</Text>
      </View>

      {isArtisan && (
        <View style={styles.earningsCard}>
          <View>
            <Text style={styles.earningsLabel}>Guadagni totali</Text>
            <Text style={styles.earningsAmount}>€{(totalCents / 100).toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.onboardBtn} onPress={() => onboard()} disabled={onboarding}>
            {onboarding
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.onboardBtnText}>Stripe →</Text>}
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
      ) : (
        <FlatList
          data={payments ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>Nessun pagamento</Text>
            </View>
          }
          renderItem={({ item }: { item: Payment }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.amount}>€{(item.amount / 100).toFixed(2)}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                  <Text style={[styles.badgeTxt, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>
                {item.currency.toUpperCase()}  ·  {new Date(item.createdAt).toLocaleDateString('it-IT')}
              </Text>
              {isArtisan && (
                <Text style={styles.fee}>Fee piattaforma: €{(item.platformFee / 100).toFixed(2)}</Text>
              )}
            </View>
          )}
        />
      )}

      <BottomTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  header:         { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title:          { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  earningsCard:   { margin: 16, backgroundColor: '#2563eb', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earningsLabel:  { fontSize: 12, color: '#93c5fd', fontWeight: '500' },
  earningsAmount: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 4 },
  onboardBtn:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  onboardBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  amount:         { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt:       { fontSize: 11, fontWeight: '600' },
  cardSub:        { fontSize: 12, color: '#64748b' },
  fee:            { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  empty:          { alignItems: 'center', paddingTop: 80 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 16, color: '#64748b' },
})
