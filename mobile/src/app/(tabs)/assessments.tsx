import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { ScreenFrame } from '@/components/screen-frame'
import { fetchPortalData } from '@/lib/api'
import type { PortalData } from '@/lib/types'

type A = PortalData['assessments'][number]

function split(a: A[]) {
  const done = a.filter(x => x.submissionStatus === 'completed')
  const overdue = a.filter(
    x => x.submissionStatus !== 'completed' && x.dueDate && new Date(x.dueDate) < new Date(),
  )
  const pending = a.filter(
    x => x.submissionStatus !== 'completed' && !(x.dueDate && new Date(x.dueDate) < new Date()),
  )
  return { done, overdue, pending }
}

function dueLabel(dueDate?: string): string | null {
  if (!dueDate) return null
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today!'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

// NOTE: every className below must be a complete literal string —
// NativeWind compiles Tailwind classes statically and cannot see
// dynamically constructed names.
const SECTION_STYLES = {
  overdue: { title: 'Overdue — needs attention', tint: 'text-red-400', barLeft: 'border-l-red-400', chip: 'bg-red-400/20' },
  pending: { title: 'Upcoming', tint: 'text-sky-400', barLeft: 'border-l-sky-400', chip: 'bg-sky-400/20' },
  done: { title: 'Completed 🎉', tint: 'text-green-400', barLeft: 'border-l-green-400', chip: 'bg-green-400/20' },
} as const

function Card({ item, kind }: { item: A; kind: keyof typeof SECTION_STYLES }) {
  const s = SECTION_STYLES[kind]
  const label = dueLabel(item.dueDate)
  return (
    <View className={`mb-2 rounded-2xl border border-white/10 bg-white/5 border-l-4 ${s.barLeft} px-4 py-3.5`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text numberOfLines={1} className={`font-semibold text-white ${kind === 'done' ? 'line-through opacity-60' : ''}`}>
            {item.titleAr ?? item.title}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
            <View className={`rounded-full px-2 py-0.5 ${s.chip}`}>
              <Text className={`text-[10px] font-medium ${s.tint}`}>{item.subject.nameAr ?? item.subject.name}</Text>
            </View>
            <Text className="text-[11px] text-gray-400">{item.totalPoints} pts</Text>
            {label && kind !== 'done' && <Text className={`text-[11px] font-medium ${kind === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}>{label}</Text>}
          </View>
        </View>
        {kind === 'done' && <Text className="text-green-400 text-lg">✓</Text>}
      </View>
    </View>
  )
}

export default function Assessments() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchPortalData())
    } catch (e) {
      setError(e instanceof Error && e.message.includes('connection')
        ? 'No connection — check your internet and try again.'
        : 'Could not load your assessments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const { overdue, pending, done } = data ? split(data.assessments) : { overdue: [], pending: [], done: [] }
  const total = overdue.length + pending.length + done.length
  const pct = total ? Math.round((done.length / total) * 100) : 0

  return (
    <ScreenFrame loading={loading} error={error} onRetry={() => void load()}>
      <Text className="text-xl font-bold text-white">Assigned Assessments</Text>
      {total > 0 && (
        <View className="my-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Text className="text-sm text-gray-300">
            {pct === 100 ? '🌟 All done — amazing!' : `${done.length}/${total} completed`}
          </Text>
          <View className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <View className={`h-full rounded-full ${pct === 100 ? 'bg-green-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
          </View>
        </View>
      )}
      {total === 0 ? (
        <View className="mt-6 rounded-2xl border border-dashed border-white/20 p-8 items-center">
          <Text className="text-center text-gray-400">
            Nothing assigned right now — keep practicing!
          </Text>
        </View>
      ) : (
        (['overdue', 'pending', 'done'] as const).map(kind => {
          const list = kind === 'overdue' ? overdue : kind === 'pending' ? pending : done
          if (!list.length) return null
          return (
            <View key={kind} className="mt-4">
              <Text className={`mb-2 text-xs font-bold uppercase tracking-wide ${SECTION_STYLES[kind].tint}`}>
                {SECTION_STYLES[kind].title}
              </Text>
              {list.map(item => <Card key={item.id} item={item} kind={kind} />)}
            </View>
          )
        })
      )}
    </ScreenFrame>
  )
}
