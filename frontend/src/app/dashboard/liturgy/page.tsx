'use client'

import { useState, useEffect, useCallback } from 'react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { Church, CheckCircle, XCircle } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'

interface PendingLiturgy {
  id: string
  student: { id: string; firstName: string; lastName: string; firstNameAr: string; lastNameAr: string }
  parent: { id: string; firstName: string; lastName: string } | null
  date: string
  notes: string | null
  createdAt: string
}

export default function LiturgyVerificationPage() {
  const language = useLanguage()
  const t = (en: string, ar: string) => language === 'ar' ? ar : en
  const [records, setRecords] = useState<PendingLiturgy[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const res = await http.get('/servants/liturgy-pending') as PendingLiturgy[]
      setRecords(res || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const handleVerify = async (id: string) => {
    try {
      const res = await http.patch(`/servants/liturgy/${id}/verify`) as { badgeAwarded: boolean }
      setRecords(prev => prev.filter(r => r.id !== id))
      const msg = res.badgeAwarded
        ? t('Verified! +30 XP & Faithful Worshipper badge awarded!', 'تم التحقق! +30 XP وتم منح شارة المُصَلّي الأمين!')
        : t('Verified! +30 XP', 'تم التحقق! +30 XP')
      setActionFeedback(msg)
      setTimeout(() => setActionFeedback(null), 3000)
    } catch {
      setActionFeedback(t('Error verifying', 'خطأ في التحقق'))
    }
  }

  const handleReject = async (id: string) => {
    // Rejection used to DELETE the claim outright — no reason, nobody told, gone for the
    // student and the parent who filed it. It is now a status change, and the family sees
    // whatever is typed here, so a reason is required rather than optional.
    const reason = window.prompt(
      t(
        'Why are you rejecting this? The student and their parent will see this.',
        'لماذا ترفض هذا؟ سيرى الطالب ووالداه هذا السبب.',
      ),
    )
    if (reason === null) return
    if (reason.trim().length < 3) {
      setActionFeedback(t('Please give a reason the family can understand', 'يرجى إعطاء سبب يمكن للأسرة فهمه'))
      setTimeout(() => setActionFeedback(null), 3000)
      return
    }
    try {
      await http.patch(`/servants/liturgy/${id}/reject`, { reason: reason.trim() })
      setRecords(prev => prev.filter(r => r.id !== id))
      setActionFeedback(t('Rejected — the family can see your reason', 'تم الرفض — يمكن للأسرة رؤية سببك'))
      setTimeout(() => setActionFeedback(null), 3000)
    } catch {
      setActionFeedback(t('Error rejecting', 'خطأ في الرفض'))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Church className="w-6 h-6 text-amber-700" />
        <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Verification', 'التحقق من القداسات')}</h1>
      </div>

      {actionFeedback && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium animate-pulse">{actionFeedback}</div>
      )}

      {loading ? (
        <div className="px-4 py-12"><TableSkeleton rows={5} cols={3} /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('No pending liturgy verifications', 'لا توجد طلبات تحقق معلقة')}</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-gray-200">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">
                  {language === 'ar' ? `${r.student.firstNameAr} ${r.student.lastNameAr}` : `${r.student.firstName} ${r.student.lastName}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('Reported by', 'تم الإبلاغ بواسطة')}: {r.parent ? `${r.parent.firstName} ${r.parent.lastName}` : '-'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(r.date).toLocaleDateString('en-GB')}
                  {r.notes && ` · ${r.notes}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => handleVerify(r.id)} className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title={t('Verify', 'تحقق')}>
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button onClick={() => handleReject(r.id)} className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title={t('Reject', 'رفض')}>
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
