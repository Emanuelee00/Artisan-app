import { View, Text, StyleSheet } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trova un artigiano</Text>
      {/* TODO: mappa + lista artigiani vicini */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  title:     { fontSize: 22, fontWeight: '700', marginBottom: 16 },
})
