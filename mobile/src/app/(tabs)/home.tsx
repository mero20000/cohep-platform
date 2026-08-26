import React, { useCallback, useEffect, useState } from 'react'
import { Image, RefreshControl, Text, View } from 'react-native'
import { ScreenFrame } from '@/components/screen-frame'
import { fetchPortalData } from '@/lib/api'
import type { PortalData } from '@/lib/types'

const NETWORK_MSG = 'No connection — check your internet and try again.'

export default function Home() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      setData(await fetchPortalData())
    } catch (e) {
      setError(e instanceof Error && e.message.includes('connection') ? NETWORK_MSG : 'Could not load your dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const initials = (data?.student.name ?? '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <ScreenFrame
      loading={loading}
      error={error}
      onRetry={() => void load()}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#d4af37" />
      }
    >
      {!data ? null : (
      <>
      {/* Church & School identity */}
      {data.school && (
        <View className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-xl border border-gold-500/40 bg-white/10 overflow-hidden">
              {data.school.churchLogoUrl ? (
                <Image source={{ uri: data.school.churchLogoUrl }} className="h-full w-full" resizeMode="contain" />
              ) : (
                <Text className="text-gold-500 text-lg">✝</Text>
              )}
            </View>
            <View className="flex-1 items-center">
              <Text numberOfLines={1} className="font-bold text-white">
                {data.school.churchName ?? data.school.name}
              </Text>
              {!!data.school.name && (
                <Text numberOfLines={1} className="text-xs text-gold-500 mt-0.5">{data.school.name}</Text>
              )}
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 overflow-hidden">
              {data.school.logoUrl ? (
                <Image source={{ uri: data.school.logoUrl }} className="h-full w-full" resizeMode="contain" />
              ) : (
                <Text className="text-gray-400 text-lg">♪</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Student hero */}
      <View className="mb-5 flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/20 border border-gold-500/40 overflow-hidden">
          {data.student.photoUrl ? (
            <Image source={{ uri: data.student.photoUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-xl font-bold text-gold-500">{initials}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-2xl font-bold text-white">{data.student.name}</Text>
          <Text className="text-sm text-gray-400">
            Level {data.student.level.number}
            {data.student.group?.name ? ` · ${data.student.group.name}` : ''}
          </Text>
        </View>
      </View>

      {/* XP */}
      <View className="mb-5 rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4">
        <Text className="text-xs uppercase tracking-wide text-gold-500">Total XP</Text>
        <Text className="text-3xl font-bold text-white tabular-nums">{data.totalXp}</Text>
        {!!data.badges.length && (
          <Text className="text-xs text-gray-400 mt-1">
            🏅 {data.badges.length} badge{data.badges.length === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      {/* Attendance */}
      <Text className="mb-2 font-semibold text-white">Attendance</Text>
      <View className="mb-5 flex-row gap-2">
        {([
          ['Present', data.attendance.present, 'text-green-400'],
          ['Late', data.attendance.late, 'text-amber-400'],
          ['Absent', data.attendance.absent, 'text-red-400'],
          ['Excused', data.attendance.excused, 'text-sky-400'],
        ] as const).map(([label, count, tint]) => (
          <View key={label} className="flex-1 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <Text className={`text-lg font-bold ${tint} text-center`}>{count}</Text>
            <Text className="text-[10px] text-gray-400 text-center">{label}</Text>
          </View>
        ))}
      </View>

      {/* Upcoming */}
      {!!data.upcomingSessions?.length && (
        <>
          <Text className="mb-2 font-semibold text-white">Upcoming</Text>
          {data.upcomingSessions.slice(0, 3).map(s => (
            <View key={s.id} className="mb-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Text className="text-white">{s.topic ?? 'Class session'}</Text>
              {!!s.date && (
                <Text className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              )}
            </View>
          ))}
        </>
      )}
      </>
      )}
    </ScreenFrame>
  )
}
