import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/auth.store'

const TABS = [
  { label: 'Home',      icon: '🏠', path: '/(app)/home'              },
  { label: 'Lavori',    icon: '🔧', path: '/(app)/jobs'               },
  { label: 'Pagamenti', icon: '💳', path: '/(app)/payments'           },
  { label: 'Profilo',   icon: '👤', path: '/(app)/profile'            },
]

export default function BottomTabBar() {
  const router   = useRouter()
  const pathname = usePathname()
  const insets   = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.path.replace('/(app)', ''))
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={() => router.push(tab.path as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
            {active && <View style={styles.dot} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: '#ffffff',
    borderTopWidth:  1,
    borderTopColor:  '#e2e8f0',
    paddingTop:      8,
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    gap:            2,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize:   10,
    color:      '#94a3b8',
    fontWeight: '500',
  },
  labelActive: {
    color: '#2563eb',
  },
  dot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#2563eb',
    marginTop:       2,
  },
})
