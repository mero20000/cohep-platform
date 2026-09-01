'use client'
import { useState, useEffect, useCallback } from 'react'
import { Mail, Trash2 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'

interface Subscriber {
  id: string
  email: string
  isActive: boolean
  createdAt: string
}

interface PaginatedSubscribers {
  data: Subscriber[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const LIMIT = 20

export default function SubscribersPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [list, setList] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchList = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const data = await http.get<PaginatedSubscribers>('/newsletter/subscribers', { page: String(p), limit: String(LIMIT) })
      setList(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تحميل المشتركين' : 'Failed to load subscribers', e?.message || '')
      setList([])
      setTotalPages(1)
      setTotal(0)
    }
    setLoading(false)
  }, [toast, lang])

  useEffect(() => { fetchList(page) }, [page, fetchList])

  const handleUnsubscribe = async (email: string) => {
    if (!confirm(t('Remove this subscriber?', 'إزالة هذا المشترك؟'))) return
    try {
      await http.post('/newsletter/unsubscribe', { email })
      toast('success', t('Subscriber removed', 'تم إزالة المشترك'))
      fetchList(page)
    } catch (e: any) {
      toast('error', t('Failed to remove', 'فشل الإزالة'), e?.message || '')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Newsletter Subscribers', 'مشتركين النشرة الإخبارية')}</h1>
        <p className="text-sm text-gray-500">{total} {t('subscribers', 'مشترك')}</p>
      </div>

      {loading ? (
        <div className="px-4 py-16"><TableSkeleton rows={6} cols={3} /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Mail className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('No subscribers yet', 'لا يوجد مشتركين بعد')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Email', 'البريد الإلكتروني')}</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Status', 'الحالة')}</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('Subscribed At', 'تاريخ الاشتراك')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('Actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-gold-700">
                        <Mail className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{s.email}</span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3">
                    {s.isActive
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />{t('Active', 'نشط')}</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{t('Inactive', 'غير نشط')}</span>
                    }
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">
                    {new Date(s.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleUnsubscribe(s.email)}
                      className="text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
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
    </div>
  )
}
