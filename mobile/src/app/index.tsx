import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useAuth } from '@/lib/auth'

export default function Index() {
  const { session, ready } = useAuth()
  if (!ready) return <View className="flex-1 bg-[#0f172a]" />
  return <Redirect href={session ? '/(tabs)' : '/login'} />
}
