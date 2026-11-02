'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { http } from '@/lib/http-client'
import type { PendingItem } from './types'

interface Props {
  item: PendingItem | null
  onClose: () => void
  onReturned: (submissionId: string) => void
}

/** Sends a submission back to the student to redo. Nothing is deleted. */
export function ReturnModal({ item, onClose, onReturned }: Props) {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!item) return
    setBusy(true)
    try {
      await http.post(`/assessments/${item.assessment.id}/students/${item.student.id}/return`, { note: note.trim() || undefined })
      toast('success', t('Returned to the student', 'تمت الإعادة إلى الطالب'))
      onReturned(item.submissionId)
      setNote('')
    } catch {
      toast('error', t('Could not return the submission', 'تعذرت إعادة التسليم'))
    }
    setBusy(false)
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={t('Return to student', 'إعادة إلى الطالب')}
      description={item ? `${item.student.firstName} ${item.student.lastName} · ${item.assessment.title}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('Return', 'إعادة')}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        {t(
          'The student keeps their previous answers on record and can submit again. They are notified with your note.',
          'يحتفظ الطالب بإجاباته السابقة ويمكنه التسليم مرة أخرى. سيتم إشعاره بملاحظتك.',
        )}
      </p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        maxLength={300}
        placeholder={t('What should the student fix? (optional)', 'ما الذي يجب على الطالب تصحيحه؟ (اختياري)')}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </Modal>
  )
}
