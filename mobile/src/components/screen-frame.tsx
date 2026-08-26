import React from 'react'
import { ActivityIndicator, Pressable, RefreshControlProps, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface Props {
  loading: boolean
  error: string | null
  onRetry: () => void
  refreshControl?: React.ReactElement<RefreshControlProps>
  children: React.ReactNode
}

export function ScreenFrame({ loading, error, onRetry, refreshControl, children }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#0f172a]" edges={['top']}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#d4af37" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-gray-300">{error}</Text>
          <Pressable onPress={onRetry} className="mt-4 rounded-full bg-gold-500 px-6 py-2.5">
            <Text className="font-semibold text-[#0f172a]">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView refreshControl={refreshControl} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
