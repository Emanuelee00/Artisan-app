import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { JobsAPI } from '../../../services/jobs'
import { apiError } from '../../../services/api'

const CATEGORIES = ['Elettricista', 'Idraulico', 'Falegname', 'Muratore', 'Pittore', 'Giardiniere', 'Pulizie', 'Altro']

const schema = z.object({
  title:       z.string().min(3, 'Titolo troppo corto'),
  description: z.string().min(10, 'Descrizione troppo corta'),
  address:     z.string().min(5, 'Indirizzo non valido'),
})

export default function NewJobScreen() {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState(CATEGORIES[0])
  const [address,     setAddress]     = useState('')
  const [price,       setPrice]       = useState('')
  const [error,       setError]       = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: JobsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      router.back()
    },
    onError: (err) => setError(apiError(err)),
  })

  function handleCreate() {
    const result = schema.safeParse({ title, description, address })
    if (!result.success) { setError(result.error.issues[0].message); return }
    setError(null)
    mutate({
      title:          title.trim(),
      description:    description.trim(),
      category,
      address:        address.trim(),
      lat:            41.9028,
      lng:            12.4964,
      estimatedPrice: price ? parseFloat(price) : undefined,
    })
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalHandle}>
        <View style={styles.handle} />
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Text style={styles.title}>Nuovo lavoro</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Titolo</Text>
        <TextInput
          style={styles.input}
          placeholder="es. Riparazione perdita acqua"
          value={title}
          onChangeText={setTitle}
        />

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

        <Text style={styles.label}>Descrizione</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Descrivi il problema..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Indirizzo</Text>
        <TextInput
          style={styles.input}
          placeholder="Via, città..."
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Prezzo stimato (€) — opzionale</Text>
        <TextInput
          style={styles.input}
          placeholder="es. 150"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={isPending} activeOpacity={0.8}>
          {isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Pubblica lavoro</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  modalHandle: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, backgroundColor: '#fff' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  container:   { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:       { fontSize: 22, fontWeight: '700', color: '#1e293b' },
  close:       { fontSize: 18, color: '#94a3b8', padding: 4 },
  label:       { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input:       {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    padding: 14, fontSize: 15, backgroundColor: '#f8fafc', marginBottom: 16,
  },
  multiline:   { height: 100, textAlignVertical: 'top' },
  catBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', marginRight: 8 },
  catBtnActive:{ borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  catTxt:      { fontSize: 13, color: '#64748b' },
  catTxtActive:{ color: '#2563eb', fontWeight: '600' },
  error:       { color: '#ef4444', marginBottom: 12, fontSize: 13 },
  btn:         { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
})
