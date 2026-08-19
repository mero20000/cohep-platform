'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Baby, Trash2, Loader2, AlertCircle, Crown, Link2, UserPlus, Search, Edit3, Check, X } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

const RELATIONSHIPS = [
  { value: 'father', en: 'Father', ar: 'أب' },
  { value: 'mother', en: 'Mother', ar: 'أم' },
  { value: 'guardian', en: 'Guardian', ar: 'ولي أمر' },
]

interface ChildInfo {
  id: string
  studentCode: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  photoUrl?: string
  levelNumber: number
  levelName: string
  groupName: string
  status: string
}

interface LinkedChild {
  relationship: string
  isPrimary: boolean
  student: ChildInfo
}

export function ChildrenTab() {
  const lang = useLanguage()
  const { toast } = useToast()
  const [children, setChildren] = useState<LinkedChild[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [linkCode, setLinkCode] = useState('')
  const [linkRel, setLinkRel] = useState('father')
  const [linking, setLinking] = useState(false)

  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ id: string; name: string } | null>(null)

  const [editingRel, setEditingRel] = useState<{ studentId: string; relationship: string } | null>(null)
  const [savingRel, setSavingRel] = useState(false)

  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    http.get<LinkedChild[]>('/parents/me/children')
      .then(d => { setChildren(d || []); setLoading(false) })
      .catch(() => { setError(t('Failed to load children', 'تعذر تحميل الأبناء')); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const handleLink = async () => {
    const code = linkCode.trim()
    if (!code) return
    setLinking(true)
    try {
      const d = await http.post<LinkedChild[]>('/parents/me/children/link', { studentCode: code, relationship: linkRel })
      setChildren(d || [])
      setLinkCode('')
      toast('success', t('Child linked successfully', 'تم ربط الطالب بنجاح'))
    } catch (e: any) {
      toast('error', e?.message || t('Failed to link child', 'تعذر ربط الطالب'))
    }
    setLinking(false)
  }

  const handleUnlink = async () => {
    if (!unlinkConfirm) return
    const studentId = unlinkConfirm.id
    setUnlinking(studentId)
    setUnlinkConfirm(null)
    try {
      const d = await http.delete<LinkedChild[]>(`/parents/me/children/${studentId}`)
      setChildren(d || [])
      toast('success', t('Child unlinked', 'تم فك الربط'))
    } catch (e: any) {
      toast('error', e?.message || t('Failed to unlink', 'تعذر فك الربط'))
    }
    setUnlinking(null)
  }

  const handleSaveRelationship = async (studentId: string) => {
    if (!editingRel) return
    setSavingRel(true)
    try {
      const d = await http.patch<LinkedChild[]>(`/parents/me/children/${studentId}/relationship`, { relationship: editingRel.relationship })
      setChildren(d || [])
      setEditingRel(null)
      toast('success', t('Relationship updated', 'تم تحديث صلة القرابة'))
    } catch (e: any) {
      toast('error', e?.message || t('Failed to update', 'تعذر التحديث'))
    }
    setSavingRel(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-700" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
          <Button onClick={load} variant="link" className="ml-auto text-sm text-blue-700">{t('Retry', 'إعادة المحاولة')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Link form */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-4 w-4 text-blue-700" />
          <h3 className="font-semibold text-blue-800">{t('Link a New Child', 'ربط طالب جديد')}</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={linkCode}
              onChange={e => setLinkCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLink() }}
              placeholder={t('Student code (e.g. STU-0001)', 'كود الطالب (مثال STU-0001)')}
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
            />
          </div>
          <select
            value={linkRel}
            onChange={e => setLinkRel(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-200"
          >
            {RELATIONSHIPS.map(r => (
              <option key={r.value} value={r.value}>{t(r.en, r.ar)}</option>
            ))}
          </select>
          <Button
            onClick={handleLink}
            disabled={linking || !linkCode.trim()}
          >
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t('Link', 'ربط')}
          </Button>
        </div>
      </div>

      {/* Children list */}
      {children && children.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 mb-4">
            <Baby className="h-7 w-7 text-gray-400" />
          </div>
          <h4 className="text-base font-semibold text-gray-900">{t('No children linked', 'لا يوجد أبناء مرتبطون')}</h4>
          <p className="mt-1 text-sm text-gray-500">{t('Use the form above to link your children by student code.', 'استخدم النموذج أعلاه لربط أبنائك بكود الطالب.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {children?.map(c => {
            const s = c.student
            const initials = `${s.firstName[0] || ''}${s.lastName[0] || ''}`
            const name = `${s.firstName} ${s.lastName}`
            const relLabel = RELATIONSHIPS.find(r => r.value === c.relationship)
            return (
              <div key={s.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold overflow-hidden">
                  {s.photoUrl ? (
                    <Image src={s.photoUrl.startsWith('http') ? s.photoUrl : API_ORIGIN + s.photoUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{name}</span>
                    {c.isPrimary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        <Crown className="h-3 w-3" />{t('Primary', 'أساسي')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500">
                    <span>{t('Code', 'كود')}: {s.studentCode}</span>
                    <span>L{s.levelNumber} — {s.groupName}</span>
                  </div>
                </div>

                {/* Relationship */}
                {editingRel?.studentId === s.id ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={editingRel.relationship}
                      onChange={e => setEditingRel({ ...editingRel, relationship: e.target.value })}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-gold-400 focus:outline-none"
                      autoFocus
                    >
                      {RELATIONSHIPS.map(r => (
                        <option key={r.value} value={r.value}>{t(r.en, r.ar)}</option>
                      ))}
                    </select>
                    <Button onClick={() => handleSaveRelationship(s.id)} disabled={savingRel}
                      variant="ghost"
                      size="icon"
                      className="text-green-600 hover:bg-green-50">
                      {savingRel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button onClick={() => setEditingRel(null)} variant="ghost" size="icon" className="text-gray-400 hover:bg-gray-100">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setEditingRel({ studentId: s.id, relationship: c.relationship })}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                    {relLabel ? t(relLabel.en, relLabel.ar) : c.relationship}
                    <Edit3 className="h-3 w-3 text-gray-400" />
                  </Button>
                )}

                <Button
                  onClick={() => setUnlinkConfirm({ id: s.id, name })}
                  disabled={unlinking === s.id}
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                  title={t('Unlink', 'فك الربط')}
                >
                  {unlinking === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!unlinkConfirm}
        onClose={() => setUnlinkConfirm(null)}
        variant="danger"
        title={t('Unlink Student', 'فك رابط الطالب')}
        message={unlinkConfirm ? t(`Are you sure you want to unlink ${unlinkConfirm.name}?`, `هل أنت متأكد من فك رابط ${unlinkConfirm.name}؟`) : ''}
        confirmLabel={t('Unlink', 'فك الربط')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={unlinking === unlinkConfirm?.id}
        onConfirm={handleUnlink}
      />
    </div>
  )
}
