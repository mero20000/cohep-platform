import type { PendingItem } from '@/app/dashboard/assessments/pending-review/types'
import { waitingDays } from '@/app/dashboard/assessments/pending-review/types'

export async function exportPendingReviewXlsx(items: PendingItem[], lang: 'en' | 'ar') {
  const XLSX = await import('xlsx')
  const isAr = lang === 'ar'
  const headers = isAr
    ? ['كود الطالب', 'اسم الطالب', 'المجموعة', 'الصف', 'التقييم', 'تاريخ التسليم', 'أيام الانتظار', 'متأخر', 'الدرجة التلقائية', 'الدرجة الكاملة', 'يتضمن مقالاً', 'تسجيل صوتي']
    : ['Student Code', 'Student', 'Group', 'Grade', 'Assessment', 'Submitted', 'Days waiting', 'Late', 'Auto score', 'Total points', 'Has essay', 'Has recording']
  const yes = isAr ? 'نعم' : 'Yes'
  const no = isAr ? 'لا' : 'No'

  const rows = items.map(i => [
    i.student.studentCode || '',
    `${i.student.firstName} ${i.student.lastName}`,
    i.student.groupName || '',
    i.student.gradeName || '',
    isAr && i.assessment.titleAr ? i.assessment.titleAr : i.assessment.title,
    i.submittedAt.split('T')[0],
    waitingDays(i.submittedAt),
    i.isLate ? yes : no,
    i.autoScore,
    i.assessment.totalPoints,
    i.hasEssay ? yes : no,
    i.recording ? yes : no,
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, isAr ? 'بانتظار المراجعة' : 'Pending review')
  XLSX.writeFile(wb, `${isAr ? 'بانتظار-المراجعة' : 'pending-review'}-${new Date().toISOString().split('T')[0]}.xlsx`)
}
