import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ScreenFrame } from '@/components/screen-frame'
import { fetchHymnMap, MASTERY_META } from '@/lib/api'
import type { HymnMapItem } from '@/lib/types'

const SUBJECT_ACCENTS: Record<string, string> = {
  hymns: 'border-l-amber-400',
  rites: 'border-l-purple-400',
  language: 'border-l-sky-400',
  coptic: 'border-l-sky-400',
  studies: 'border-l-emerald-400',
}

function accentFor(subjectName: string): string {
  const n = subjectName.toLowerCase()
  for (const [needle, cls] of Object.entries(SUBJECT_ACCENTS)) {
    if (n.includes(needle)) return cls
  }
  return 'border-l-indigo-400'
}

export default function Practice() {
  const [items, setItems] = useState<HymnMapItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchHymnMap())
    } catch (e) {
      setError(e instanceof Error && e.message.includes('connection')
        ? 'No connection — check your internet and try again.'
        : 'Could not load your hymns.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, HymnMapItem[]>()
    for (const item of items ?? []) {
      const key = item.subject.name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return [...map.entries()]
  }, [items])

  const toggle = (subject: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(subject) ? next.delete(subject) : next.add(subject)
      return next
    })

  return (
    <ScreenFrame loading={loading} error={error} onRetry={() => void load()}>
      <Text className="mb-4 text-xl font-bold text-white">Your Hymn Map</Text>
      {!items?.length ? (
        <View className="rounded-2xl border border-dashed border-white/20 p-8 items-center">
          <Text className="text-gray-400 text-center">
            No hymns allocated yet — your servant will add them soon.
          </Text>
        </View>
      ) : (
        grouped.map(([subject, hymns]) => {
          const open = expanded.has(subject)
          return (
            <View key={subject} className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <Pressable onPress={() => toggle(subject)} className="flex-row items-center px-4 py-3.5">
                <View className="flex-1">
                  <Text className="font-semibold text-white">{subject}</Text>
                  <Text className="text-xs text-gray-400">{hymns.length} hymns</Text>
                </View>
                <Text className="text-gray-400">{open ? '▾' : '▸'}</Text>
              </Pressable>
              {open &&
                hymns.map(h => {
                  const meta = h.masteryLevel ? MASTERY_META[h.masteryLevel] : null
                  return (
                    <View
                      key={h.id}
                      className={`border-l-4 ${accentFor(subject)} border-t border-white/5 px-4 py-3`}
                    >
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1">
                          {!!h.titleCoptic && <Text className="text-white font-medium">{h.titleCoptic}</Text>}
                          <Text className="text-gray-400 text-xs">
                            {h.titleAr ?? h.title} · L{h.level.number}
                          </Text>
                        </View>
                        {meta && (
                          <View
                            className="rounded-full px-2.5 py-1"
                            style={{ backgroundColor: `${meta.color}22` }}
                          >
                            <Text style={{ color: meta.color }} className="text-[10px] font-semibold">
                              {meta.label}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                })}
            </View>
          )
        })
      )}
    </ScreenFrame>
  )
}
