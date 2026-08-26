import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Cross } from 'lucide-react-native'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const { login, loggingIn, loginError } = useAuth()
  const router = useRouter()
  const [key, setKey] = useState('')

  const submit = async () => {
    if (await login(key)) router.replace('/(tabs)')
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-8"
      >
        <View className="items-center mb-10">
          <View className="h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/40 bg-white/5 mb-4">
            <Cross size={28} color="#d4af37" />
          </View>
          <Text className="text-white text-2xl font-bold">COHEP</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Enter the access key from your servant
          </Text>
        </View>

        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="Access key"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loggingIn}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-white"
        />

        {loginError ? (
          <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">
            {loginError}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={loggingIn || key.trim().length === 0}
          className="mt-6 flex-row items-center justify-center rounded-xl bg-gold-500 py-4 disabled:opacity-50"
        >
          {loggingIn ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text className="font-bold text-[#0f172a]">Sign in</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
