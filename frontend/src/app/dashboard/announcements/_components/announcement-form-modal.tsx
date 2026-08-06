'use client'
import { useState } from 'react'
import { X, Loader2, Megaphone, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'
import { emptyAnnouncement, ROLE_OPTIONS, type Announcement, type AnnouncementForm } from './announcement-types'

interface Props {
  announcement: Announcement | null
  onClose: () => void
  onSuccess: () => void
  lang: 'en' | 'ar'
}

export function AnnouncementFormModal({ announcement, onClose, onSuccess, lang }: Props) {
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [form, setForm] = useState<AnnouncementForm>(announcement
    ? { title: announcement.title, titleAr: announcement.titleAr || '', body: announcement.body, bodyAr: announcement.bodyAr || '', priority: announcement.priority, targetRoles: announcement.targetRoles }
    : { ...emptyAnnouncement }
  )
  const [publishNow, setPublishNow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAi, setShowAi] = useState(false)

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const result = await http.post<{ title: string; titleAr?: string; body: string; bodyAr?: string; error?: string }>('/announcements/draft', { prompt: aiPrompt })
      if (result.error) throw new Error(result.error)
      setForm(prev => ({
        ...prev,
        title: result.title || '',
        titleAr: result.titleAr || '',
        body: result.body || '',
        bodyAr: result.bodyAr || '',
      }))
      setShowAi(false)
      setAiPrompt('')
      toast('success', t('AI draft generated!', 'تم إنشاء المسودة بالذكاء الاصطناعي!'))
    } catch (e: any) {
      toast('error', t('AI draft failed', 'فشل إنشاء المسودة'), e?.message || '')
    }
    setAiLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError(t('Title and body are required', 'العنوان والنص مطلوبان'))
      return
    }
    setSaving(true)
    setError('')
    const payload = publishNow ? { ...form, publishedAt: new Date().toISOString() } : { ...form }
    try {
      if (announcement) {
        await http.put(`/announcements/${announcement.id}`, payload, { schoolId: getSchoolId() })
      } else {
        await http.post('/announcements', payload, { schoolId: getSchoolId() })
      }
      toast('success', announcement ? t('Announcement updated', 'تم تحديث الإعلان') : t('Announcement created', 'تم إنشاء الإعلان'))
      setSaving(false)
      onSuccess()
    } catch (e: any) {
      setError(e?.message || t('Failed to save announcement', 'فشل حفظ الإعلان'))
      setSaving(false)
    }
  }

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">{announcement ? t('Edit Announcement', 'تعديل الإعلان') : t('New Announcement', 'إعلان جديد')}</h2>
          <Button variant="ghost" size="icon" type="button" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {!announcement && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <button type="button" onClick={() => setShowAi(!showAi)}
                className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-800">
                <Sparkles className="h-4 w-4" />
                {showAi ? t('Hide AI draft', 'إخفاء المسودة بالذكاء الاصطناعي') : t('Draft with AI', 'كتابة مسودة بالذكاء الاصطناعي')}
              </button>
              {showAi && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    placeholder={t('Describe the announcement topic...', 'صف موضوع الإعلان...')}
                    className="flex-1 rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                  <Button type="button" size="sm" onClick={handleAiDraft} disabled={aiLoading || !aiPrompt.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap">
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {t('Generate', 'إنشاء')}
                  </Button>
                </div>
              )}
            </div>
          )}
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('Title *', 'العنوان *')}</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={t('Announcement title', 'عنوان الإعلان')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('Title (Arabic)', 'العنوان (عربي)')}</label>
            <input type="text" value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })}
              placeholder={t('Announcement title in Arabic', 'عنوان الإعلان بالعربية')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('Body *', 'النص *')}</label>
            <textarea rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder={t('Announcement text', 'نص الإعلان')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('Body (Arabic)', 'النص (عربي)')}</label>
            <textarea rows={4} value={form.bodyAr} onChange={e => setForm({ ...form, bodyAr: e.target.value })}
              placeholder={t('Announcement text in Arabic', 'نص الإعلان بالعربية')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Priority', 'الأولوية')}</label>
            <div className="flex gap-2">
              {[
                { value: 'normal', label: t('Normal', 'عادي'), color: 'border-blue-300 bg-blue-50 text-blue-700' },
                { value: 'important', label: t('Important', 'هام'), color: 'border-amber-300 bg-amber-50 text-amber-700' },
                { value: 'urgent', label: t('Urgent', 'عاجل'), color: 'border-red-300 bg-red-50 text-red-700' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setForm({ ...form, priority: opt.value as AnnouncementForm['priority'] })}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${form.priority === opt.value ? opt.color + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Target Audience', 'الجمهور المستهدف')}</label>
            <p className="text-xs text-gray-500 mb-2">{t('Leave empty to send to everyone', 'اتركه فارغاً للإرسال للجميع')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(role => (
                <label key={role.value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition-colors ${form.targetRoles.includes(role.value) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={form.targetRoles.includes(role.value)} onChange={() => toggleRole(role.value)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  {lang === 'ar' ? role.labelAr : role.label}
                </label>
              ))}
            </div>
          </div>
          {!announcement && (
            <label className="flex items-center gap-2.5 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={publishNow} onChange={e => setPublishNow(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t('Publish immediately', 'نشر فوراً')}</p>
                <p className="text-xs text-gray-500">{t('The announcement will be visible to all targeted users right away', 'سيكون الإعلان مرئياً لجميع المستخدمين المستهدفين فوراً')}</p>
              </div>
            </label>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <Button variant="outline" type="button" onClick={onClose}
            >{t('Cancel', 'إلغاء')}</Button>
          <Button type="button" disabled={saving} onClick={handleSubmit}
            >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Megaphone className="h-4 w-4" />{announcement ? t('Save Changes', 'حفظ التغييرات') : t('Create', 'إنشاء')}
          </Button>
        </div>
      </div>
    </div>
  )
}
