import { useState, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../../store/auth.store'
import { getSocket, onNewMessage } from '../../../services/chat'

interface Message {
  id:        string
  senderId:  string
  text?:     string | null
  type:      string
  createdAt: string | Date
}

export default function ChatScreen() {
  const { jobId }  = useLocalSearchParams<{ jobId: string }>()
  const router     = useRouter()
  const insets     = useSafeAreaInsets()
  const user       = useAuthStore((s) => s.user)
  const listRef    = useRef<FlatList>(null)

  const [chatId,   setChatId]   = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const socket = getSocket()

    socket.emit('join_chat', { jobId }, (data: { chatId: string; messages: Message[] }) => {
      setChatId(data.chatId)
      setMessages([...data.messages].reverse())
      setLoading(false)
    })

    const cleanup = onNewMessage((msg: Message) => {
      setMessages((prev) => [...prev, msg])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    })

    return () => { cleanup() }
  }, [jobId])

  function handleSend() {
    if (!text.trim() || !chatId || !user) return
    getSocket().emit('send_message', { chatId, senderId: user.id, text: text.trim() })
    setText('')
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={{ width: 80 }} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                {item.text}
              </Text>
              <Text style={[styles.bubbleTime, isMe && { color: '#93c5fd' }]}>
                {new Date(item.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )
        }}
      />

      <View style={[styles.inputRow, { paddingBottom: insets.bottom || 12 }]}>
        <TextInput
          style={styles.input}
          placeholder="Scrivi un messaggio..."
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={styles.sendIcon}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header:         { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back:           { width: 80 },
  backText:       { fontSize: 15, color: '#2563eb', fontWeight: '500' },
  headerTitle:    { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  bubble:         { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  bubbleMe:       { alignSelf: 'flex-end', backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleThem:     { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleText:     { fontSize: 15 },
  bubbleTextMe:   { color: '#fff' },
  bubbleTextThem: { color: '#1e293b' },
  bubbleTime:     { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  inputRow:       { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'flex-end', gap: 8 },
  input:          { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, backgroundColor: '#f8fafc' },
  sendBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ backgroundColor: '#cbd5e1' },
  sendIcon:       { color: '#fff', fontSize: 18, fontWeight: '700' },
})
