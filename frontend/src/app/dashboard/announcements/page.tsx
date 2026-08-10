'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Megaphone, Filter, X, Loader2 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { AnnouncementFormModal } from './_components/announcement-form-modal'
import { type Announcement, type PaginatedAnnouncements, PRIORITY_STYLE } from './_components/announcement-types'

const LIMIT = 20

export default function AnnouncementsPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [list, setList] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchList = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(p), limit: String(LIMIT), schoolId: getSchoolId() }
      if (filterPriority) params.priority = filterPriority
      if (filterStatus) params.status = filterStatus
      const data = await http.get<PaginatedAnnouncements>('/announcements', params)
      setList(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تحميل الإعلانات' : 'Failed to load announcements', e?.message || '')
      setList([])
      setTotalPages(1)
      setTotal(0)
    }
    setLoading(false)
  }, [filterPriority, filterStatus, toast, lang])

  useEffect(() => { fetchList(page) }, [page, fetchList])

  const handleDelete = async (id: string) => {
    if (!confirm(t('Delete this announcement?', 'حذف هذا الإعلان؟'))) return
    try {
      await http.delete(`/announcements/${id}`, { schoolId: getSchoolId() })
      toast('success', t('Announcement deleted', 'تم حذف الإعلان'))
    } catch (e: any) {
      toast('error', t('Failed to delete', 'فشل الحذف'), e?.message || '')
    }
    fetchList(page)
  }

  const handlePublish = async (id: string) => {
    try {
      await http.patch(`/announcements/${id}/publish`, null, { schoolId: getSchoolId() })
      toast('success', t('Announcement published', 'تم نشر الإعلان'))
    } catch (e: any) {
      toast('error', t('Failed to publish', 'فشل النشر'), e?.message || '')
    }
    fetchList(page)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Announcements', 'الإعلانات')}</h1>
          <p className="text-sm text-gray-500">{total} {t('announcements', 'إعلان')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="h-4 w-4" />{t('New Announcement', 'إعلان جديد')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500"><Filter className="h-4 w-4" />{t('Filters', 'فلتر')}</div>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">{t('All priorities', 'كل الأولويات')}</option>
          <option value="normal">{t('Normal', 'عادي')}</option>
          <option value="important">{t('Important', 'هام')}</option>
          <option value="urgent">{t('Urgent', 'عاجل')}</option>
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">{t('All status', 'كل الحالات')}</option>
          <option value="draft">{t('Draft', 'مسودة')}</option>
          <option value="published">{t('Published', 'منشور')}</option>
        </select>
        {(filterPriority || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterPriority(''); setFilterStatus(''); setPage(1) }}
            className="text-red-500 hover:text-red-700">
            <X className="h-3.5 w-3.5" />{t('Clear', 'مسح')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Megaphone className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('No announcements yet', 'لا توجد إعلانات بعد')}</p>
          <Button variant="link" size="sm" onClick={() => { setEditing(null); setShowForm(true) }}
            className="text-blue-600 hover:text-blue-700">{t('Create the first one', 'إنشاء أول إعلان')}</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Title', 'العنوان')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Priority', 'الأولوية')}</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Target', 'المستهدف')}</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Status', 'الحالة')}</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Created By', 'المنشئ')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('Actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(a => {
                const ps = PRIORITY_STYLE[a.priority]
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${ps.dot}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{lang === 'ar' ? (a.titleAr || a.title) : a.title}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{lang === 'ar' ? (a.bodyAr || a.body) : a.body}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.priority === 'urgent' ? 'bg-red-50 text-red-700' : a.priority === 'important' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}>{lang === 'ar' ? ps.labelAr : ps.label}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-600">
                      {a.targetRoles.length === 0 && !a.targetSubscribers ? (
                        <span className="text-gray-400">{t('Everyone', 'الكل')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.targetSubscribers && (
                            <span className="inline-flex items-center rounded-full bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-700">
                              {t('Subscribers', 'المشتركين')}
                            </span>
                          )}
                          {a.targetRoles.map(r => (
                            <span key={r} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{r}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      {a.publishedAt
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />{t('Published', 'منشور')}</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{t('Draft', 'مسودة')}</span>
                      }
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">{a.createdBy?.firstName} {a.createdBy?.lastName}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setShowForm(true) }}
                          className="text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </Button>
                        {!a.publishedAt && (
                          <Button variant="ghost" size="icon" onClick={() => handlePublish(a.id)}
                            className="text-gray-400 hover:bg-green-50 hover:text-green-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}
                          className="text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="text-gray-600 disabled:opacity-30">{t('Previous', 'السابق')}</Button>
              <span className="text-sm text-gray-500">{t('Page', 'صفحة')} {page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="text-gray-600 disabled:opacity-30">{t('Next', 'التالي')}</Button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <AnnouncementFormModal
          announcement={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => { setShowForm(false); setEditing(null); fetchList(page) }}
          lang={lang}
        />
      )}
    </div>
  )
}
