import React from 'react'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '@/lib/auth'
import { setUnauthorizedHandler } from '@/lib/api'
import '../../global.css'

void SplashScreen.preventAutoHideAsync()

function Routes() {
  const { ready } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/login'))
  }, [router])

  React.useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}

export default function Layout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Routes />
    </AuthProvider>
  )
}
