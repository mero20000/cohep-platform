'use client'
import { useState } from 'react'
import { Tag, Plus, X, Loader2 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'

const TAG_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
]

export function tagColor(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[hash % TAG_COLORS.length]
}

export function TagBadge({ tag, size = 'sm' }: { tag: string; size?: 'sm'|'xs' }) {
  const c = tagColor(tag)
  return <span className={`inline-flex items-center rounded-full border font-medium ${c.bg} ${c.text} ${c.border} ${size==='xs'?'text-[10px] px-1.5 py-0.5':'text-xs px-2 py-0.5'}`}>{tag}</span>
}

interface Props { studentId: string; tags: string[]; onChanged: (tags: string[]) => void; lang: 'en'|'ar' }

export function StudentTagEditor({ studentId, tags, onChanged, lang }: Props) {
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const saveTags = async (next: string[]) => {
    setSaving(true)
    try {
      await http.patch(`/students/${studentId}/tags`, { tags: next }, { schoolId: getSchoolId() })
      onChanged(next)
    } catch (e: any) {
      toast('error', e?.message || t('Failed to update tags', 'فشل تحديث التصنيفات'))
    }
    setSaving(false)
  }

  const handleAdd = () => {
    const v = input.trim()
    if (!v || tags.includes(v)) { setInput(''); setAdding(false); return }
    saveTags([...tags, v])
    setInput('')
    setAdding(false)
  }

  const handleRemove = (tag: string) => {
    saveTags(tags.filter(t2 => t2 !== tag))
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Tag className="h-3.5 w-3.5 text-gray-400" />
      {tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1">
          <TagBadge tag={tag} />
          <button onClick={() => handleRemove(tag)} disabled={saving} className="text-gray-400 hover:text-red-500 -ms-1">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setInput('') } }}
          onBlur={handleAdd}
          placeholder={t('Tag name...', 'اسم التصنيف...')}
          className="w-24 text-xs rounded-full border border-gray-200 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <button onClick={() => setAdding(true)} disabled={saving} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 rounded-full border border-dashed border-gray-300 px-2 py-0.5 hover:border-gray-400">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          {t('Add tag', 'إضافة تصنيف')}
        </button>
      )}
    </div>
  )
}
