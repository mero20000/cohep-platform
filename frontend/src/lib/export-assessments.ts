export type AssessmentRow = {
  studentCode: string
  studentName: string
  studentNameAr?: string
  assessmentTitle: string
  assessmentTitleAr?: string
  score: number | null
  maxScore: number
  percentage?: number
  status: string
  submittedAt?: string
  gradedAt?: string
  groupName?: string
  levelName?: string
}

function buildHeaders(lang: string) {
  return lang === 'ar'
    ? ['كود الطالب', 'اسم الطالب', 'عنوان التقييم', 'الدرجة', 'الحد الأقصى', 'النسبة %', 'الحالة', 'تاريخ التسليم', 'تاريخ التصحيح', 'المجموعة', 'المستوى']
    : ['Student Code', 'Student Name', 'Assessment', 'Score', 'Max Score', 'Percentage', 'Status', 'Submitted', 'Graded', 'Group', 'Level']
}

function statusLabel(status: string, lang: string) {
  const map: Record<string, [string, string]> = {
    submitted: ['Submitted', 'تم التسليم'],
    graded: ['Graded', 'تم التصحيح'],
    pending: ['Pending', 'قيد الانتظار'],
    draft: ['Draft', 'مسودة'],
  }
  const pair = map[status] || [status, status]
  return lang === 'ar' ? pair[1] : pair[0]
}

function buildRows(rows: AssessmentRow[], lang: string) {
  return rows.map(r => [
    r.studentCode,
    lang === 'ar' ? (r.studentNameAr || r.studentName) : r.studentName,
    lang === 'ar' ? (r.assessmentTitleAr || r.assessmentTitle) : r.assessmentTitle,
    r.score !== null ? String(r.score) : '',
    String(r.maxScore),
    r.percentage !== undefined ? `${r.percentage}%` : (r.score !== null ? `${Math.round((r.score / r.maxScore) * 100)}%` : ''),
    statusLabel(r.status, lang),
    r.submittedAt?.split('T')[0] || '',
    r.gradedAt?.split('T')[0] || '',
    r.groupName || '',
    r.levelName || '',
  ])
}

function filename(lang: string, ext: string) {
  const base = lang === 'ar' ? 'درجات-التقييمات' : 'assessment-grades'
  const date = new Date().toISOString().split('T')[0]
  return `${base}-${date}.${ext}`
}

export async function exportAssessmentsXlsx(rows: AssessmentRow[], lang: string) {
  const XLSX = await import('xlsx')
  const headers = buildHeaders(lang)
  const data = buildRows(rows, lang)
  const wsData = [headers, ...data]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 14 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الدرجات' : 'Grades')
  XLSX.writeFile(wb, filename(lang, 'xlsx'))
}

export async function exportAssessmentsPdf(rows: AssessmentRow[], lang: string) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const isAr = lang === 'ar'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const title = isAr ? 'تقرير الدرجات' : 'Assessment Grades Report'
  doc.setFontSize(16)
  doc.text(title, isAr ? doc.internal.pageSize.getWidth() - 14 : 14, 15, { align: isAr ? 'right' : 'left' })

  const dateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')
  doc.setFontSize(10)
  doc.text(dateStr, isAr ? 14 : doc.internal.pageSize.getWidth() - 14, 15, { align: isAr ? 'left' : 'right' })

  const headers = buildHeaders(lang)
  const body = buildRows(rows, lang)

  autoTable(doc, {
    head: [headers],
    body,
    startY: 22,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [180, 120, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { top: 22, left: 8, right: 8 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' },
    )
  }

  doc.save(filename(lang, 'pdf'))
}
