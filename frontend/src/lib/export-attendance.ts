export type AttendanceRow = {
  studentCode: string
  studentName: string
  studentNameAr?: string
  sessionDate: string
  sessionTitle?: string
  status: string
  attendedLiturgy?: boolean
  groupName?: string
  levelName?: string
  servantName?: string
}

function buildHeaders(lang: string) {
  return lang === 'ar'
    ? ['كود الطالب', 'اسم الطالب', 'التاريخ', 'عنوان الجلسة', 'الحالة', 'حضور القداس', 'المجموعة', 'المستوى', 'الخادم']
    : ['Student Code', 'Student Name', 'Date', 'Session Title', 'Status', 'Liturgy', 'Group', 'Level', 'Servant']
}

function statusLabel(status: string, lang: string) {
  const map: Record<string, [string, string]> = {
    present: ['Present', 'حاضر'],
    absent: ['Absent', 'غائب'],
    late: ['Late', 'متأخر'],
    excused: ['Excused', 'مبرر'],
  }
  const pair = map[status] || [status, status]
  return lang === 'ar' ? pair[1] : pair[0]
}

function buildRows(rows: AttendanceRow[], lang: string) {
  return rows.map(r => [
    r.studentCode,
    lang === 'ar' ? (r.studentNameAr || r.studentName) : r.studentName,
    r.sessionDate?.split('T')[0] || '',
    r.sessionTitle || '',
    statusLabel(r.status, lang),
    r.attendedLiturgy ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No'),
    r.groupName || '',
    r.levelName || '',
    r.servantName || '',
  ])
}

function filename(lang: string, ext: string) {
  const base = lang === 'ar' ? 'سجل-الحضور' : 'attendance-records'
  const date = new Date().toISOString().split('T')[0]
  return `${base}-${date}.${ext}`
}

export async function exportAttendanceXlsx(rows: AttendanceRow[], lang: string) {
  const XLSX = await import('xlsx')
  const headers = buildHeaders(lang)
  const data = buildRows(rows, lang)
  const wsData = [headers, ...data]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 14 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 10 },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الحضور' : 'Attendance')
  XLSX.writeFile(wb, filename(lang, 'xlsx'))
}

export async function exportAttendancePdf(rows: AttendanceRow[], lang: string) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const isAr = lang === 'ar'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const title = isAr ? 'سجل الحضور' : 'Attendance Records'
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

export type SessionSummaryRow = {
  date: string
  levelName: string
  groupName: string
  servantName: string
  status: string
  present: number
  absent: number
  late: number
  excused: number
  total: number
}

function sessionHeaders(lang: string) {
  return lang === 'ar'
    ? ['التاريخ', 'المستوى', 'المجموعة', 'الخادم', 'الحالة', 'حاضر', 'غائب', 'متأخر', 'مبرر', 'الإجمالي', 'نسبة الحضور']
    : ['Date', 'Level', 'Group', 'Servant', 'Status', 'Present', 'Absent', 'Late', 'Excused', 'Total', 'Rate']
}

function sessionStatusLabel(status: string, lang: string) {
  const map: Record<string, [string, string]> = {
    completed: ['Completed', 'مكتمل'],
    scheduled: ['Scheduled', 'مجدول'],
    in_progress: ['In Progress', 'قيد التنفيذ'],
    cancelled: ['Cancelled', 'ملغي'],
    postponed: ['Postponed', 'مؤجل'],
  }
  const pair = map[status] || [status, status]
  return lang === 'ar' ? pair[1] : pair[0]
}

function sessionRows(rows: SessionSummaryRow[], lang: string) {
  return rows.map(r => {
    const rate = r.total > 0 ? `${Math.round(((r.present + r.late) / r.total) * 100)}%` : '0%'
    return [
      r.date?.split('T')[0] || '',
      r.levelName,
      r.groupName,
      r.servantName,
      sessionStatusLabel(r.status, lang),
      String(r.present),
      String(r.absent),
      String(r.late),
      String(r.excused),
      String(r.total),
      rate,
    ]
  })
}

function sessionFilename(lang: string, ext: string) {
  const base = lang === 'ar' ? 'ملخص-الجلسات' : 'attendance-sessions'
  const date = new Date().toISOString().split('T')[0]
  return `${base}-${date}.${ext}`
}

export async function exportSessionsXlsx(rows: SessionSummaryRow[], lang: string) {
  const XLSX = await import('xlsx')
  const headers = sessionHeaders(lang)
  const data = sessionRows(rows, lang)
  const wsData = [headers, ...data]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الجلسات' : 'Sessions')
  XLSX.writeFile(wb, sessionFilename(lang, 'xlsx'))
}

export async function exportSessionsPdf(rows: SessionSummaryRow[], lang: string) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const isAr = lang === 'ar'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const title = isAr ? 'ملخص جلسات الحضور' : 'Attendance Sessions Summary'
  doc.setFontSize(16)
  doc.text(title, isAr ? doc.internal.pageSize.getWidth() - 14 : 14, 15, { align: isAr ? 'right' : 'left' })

  const dateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')
  doc.setFontSize(10)
  doc.text(dateStr, isAr ? 14 : doc.internal.pageSize.getWidth() - 14, 15, { align: isAr ? 'left' : 'right' })

  const headers = sessionHeaders(lang)
  const body = sessionRows(rows, lang)

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

  doc.save(sessionFilename(lang, 'pdf'))
}
