import React from 'react'
import { Pressable, Text, View } from 'react-native'

export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <View className="bg-amber-500 px-4 py-2 flex-row items-center justify-between">
      <Text className="text-white text-sm">Demo Mode — data is not saved</Text>
      <Pressable onPress={onExit}>
        <Text className="text-white underline text-sm">Exit Demo</Text>
      </Pressable>
    </View>
  )
}
