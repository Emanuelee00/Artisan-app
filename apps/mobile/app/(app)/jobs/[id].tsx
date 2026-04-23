import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../../store/auth.store'
import { JobsAPI } from '../../../services/jobs'
import { apiError } from '../../../services/api'
import type { JobStatus } from '@artisan/shared-types'

const STATUS_LABEL: Record<JobStatus, string> = {
  pending:     'In attesa di artigiano',
  accepted:    'Artigiano in arrivo',
  in_progress: 'Lavoro in corso',
  completed:   'Completato',
  cancelled:   'Annullato',
}
const STATUS_COLOR: Record<JobStatus, string> = {
  pending: '#f59e0b', accepted: '#3b82f6', in_progress: '#8b5cf6', completed: '#10b981', cancelled: '#94a3b8',
}
const STEPS: JobStatus[] = ['pending', 'accepted', 'in_progress', 'completed']

export default function JobDetailScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>()
  const router      = useRouter()
  const insets      = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const user        = useAuthStore((s) => s.user)
  const isArtisan   = user?.role === 'artisan'

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn:  () => JobsAPI.get(id),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'accept')   return JobsAPI.accept(id)
      if (action === 'start')    return JobsAPI.start(id)
      if (action === 'complete') return JobsAPI.complete(id, job?.finalPrice ?? job?.estimatedPrice ?? 0)
      if (action === 'cancel')   return JobsAPI.cancel(id)
      throw new Error('unknown action')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job', id] })
    },
    onError: (err) => Alert.alert('Errore', apiError(err)),
  })

  function confirmAction(action: string, label: string) {
    Alert.alert('Conferma', `${label}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Conferma', onPress: () => mutate(action) },
    ])
  }

  if (isLoading || !job) {
    return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
  }

  const stepIndex = STEPS.indexOf(job.status)

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[job.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[job.status] }]}>
            {STATUS_LABEL[job.status]}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.jobTitle}>{job.title}</Text>
        <Text style={styles.category}>{job.category}</Text>

        <View style={styles.timeline}>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.timelineRow}>
              <View style={{ alignItems: 'center', width: 20 }}>
                <View style={[styles.dot, i <= stepIndex && styles.dotActive]} />
                {i < STEPS.length - 1 && (
                  <View style={[styles.line, i < stepIndex && styles.lineActive]} />
                )}
              </View>
              <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>
                {STATUS_LABEL[step]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettagli</Text>
          <InfoRow label="Indirizzo"   value={job.address} />
          <InfoRow label="Descrizione" value={job.description} />
          {job.estimatedPrice != null && <InfoRow label="Prezzo stimato" value={`€${job.estimatedPrice}`} />}
          {job.finalPrice != null     && <InfoRow label="Prezzo finale"  value={`€${job.finalPrice}`} />}
          {job.scheduledAt != null    && (
            <InfoRow label="Data prevista" value={new Date(job.scheduledAt).toLocaleDateString('it-IT')} />
          )}
        </View>

        <View style={styles.actions}>
          {isArtisan && job.status === 'pending' && (
            <ActionBtn label="Accetta lavoro" color="#2563eb" onPress={() => confirmAction('accept', 'Accettare il lavoro')} loading={isPending} />
          )}
          {isArtisan && job.status === 'accepted' && (
            <ActionBtn label="Inizia lavoro" color="#8b5cf6" onPress={() => confirmAction('start', 'Iniziare il lavoro')} loading={isPending} />
          )}
          {isArtisan && job.status === 'in_progress' && (
            <ActionBtn label="Completa lavoro" color="#10b981" onPress={() => confirmAction('complete', 'Completare il lavoro')} loading={isPending} />
          )}
          {!isArtisan && ['pending', 'accepted'].includes(job.status) && (
            <ActionBtn label="Annulla lavoro" color="#ef4444" onPress={() => confirmAction('cancel', 'Annullare il lavoro')} loading={isPending} />
          )}
          {['accepted', 'in_progress'].includes(job.status) && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#0ea5e9' }]}
              onPress={() => router.push(`/(app)/chat/${job.id}` as never)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>💬 Apri chat</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function ActionBtn({ label, color, onPress, loading }: {
  label: string; color: string; onPress: () => void; loading: boolean
}) {
  return (
    <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={onPress} disabled={loading} activeOpacity={0.8}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{label}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  header:          { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back:            { padding: 4 },
  backText:        { fontSize: 15, color: '#2563eb', fontWeight: '500' },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText:      { fontSize: 12, fontWeight: '600' },
  jobTitle:        { fontSize: 24, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  category:        { fontSize: 14, color: '#64748b', marginBottom: 24 },
  timeline:        { marginBottom: 24 },
  timelineRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  dot:             { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e2e8f0', marginTop: 2, flexShrink: 0 },
  dotActive:       { backgroundColor: '#2563eb' },
  line:            { width: 2, height: 28, backgroundColor: '#e2e8f0', marginTop: 2 },
  lineActive:      { backgroundColor: '#2563eb' },
  stepLabel:       { fontSize: 13, color: '#94a3b8', paddingBottom: 20, marginLeft: 12 },
  stepLabelActive: { color: '#1e293b', fontWeight: '500' },
  section:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  row:             { marginBottom: 10 },
  rowLabel:        { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue:        { fontSize: 14, color: '#1e293b', marginTop: 2 },
  actions:         { gap: 10 },
  btn:             { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 15 },
})
