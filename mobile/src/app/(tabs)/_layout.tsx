import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0f172a'
const GOLD = '#d4af37'

export default function TabsLayout() {
  return (
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
  )
}
