import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { DemoBanner } from '@/components/demo-banner'

const NAVY = '#0f172a'
const GOLD = '#d4af37'

export default function TabsLayout() {
  const { session, logout } = useAuth()
  const router = useRouter()

  const handleExit = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <View style={{ flex: 1 }}>
      {session?.isDemo ? <DemoBanner onExit={handleExit} /> : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: GOLD,
          tabBarInactiveTintColor: '#64748b',
          tabBarStyle: { backgroundColor: NAVY, borderTopColor: '#1e293b' },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="practice"
          options={{ title: 'Practice', tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="assessments"
          options={{ title: 'Assessments', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" color={color} size={size} /> }}
        />
      </Tabs>
    </View>
  )
}
