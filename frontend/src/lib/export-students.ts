type StudentRow = {
  studentCode: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  dateOfBirth: string
  gender?: string
  level?: { name: string } | null
  group?: { name: string } | null
  churchName?: string
  grade?: { name: string } | null
  status: string
  enrollmentDate: string
  metadata?: {
    phone?: string
    email?: string
    churchToolId?: string
    tags?: string[]
    assignedServantIds?: string[]
  }
}

function buildHeaders(lang: string) {
  return lang === 'ar'
    ? ['كود الطالب', 'الاسم', 'الاسم الأول (عربي)', 'اسم العائلة (عربي)', 'تاريخ الميلاد', 'الجنس', 'المستوى', 'المجموعة', 'الكنيسة', 'المرحلة', 'الهاتف', 'البريد', 'معرف أداة الكنيسة', 'الحالة', 'تاريخ التسجيل']
    : ['Student Code', 'Name', 'First Name (Ar)', 'Last Name (Ar)', 'Date of Birth', 'Gender', 'Level', 'Group', 'Church', 'Grade', 'Phone', 'Email', 'Church Tool ID', 'Status', 'Enrollment Date']
}

function buildRows(students: StudentRow[]) {
  return students.map(s => [
    s.studentCode,
    `${s.firstName} ${s.lastName}`.trim(),
    s.firstNameAr || '',
    s.lastNameAr || '',
    s.dateOfBirth?.split('T')[0] || '',
    s.gender || '',
    s.level?.name || '',
    s.group?.name || '',
    s.churchName || '',
    s.grade?.name || '',
    s.metadata?.phone || '',
    s.metadata?.email || '',
    s.metadata?.churchToolId || '',
    s.status,
    s.enrollmentDate?.split('T')[0] || '',
  ])
}

function filename(lang: string, filtered: boolean, ext: string) {
  const base = lang === 'ar' ? 'طلاب-نيانجلوس' : 'niangelos-students'
  const suffix = filtered ? (lang === 'ar' ? '-مصفى' : '-filtered') : ''
  const date = new Date().toISOString().split('T')[0]
  return `${base}${suffix}-${date}.${ext}`
}

export async function exportStudentsXlsx(students: StudentRow[], lang: string, filtered: boolean) {
  const XLSX = await import('xlsx')
  const headers = buildHeaders(lang)
  const rows = buildRows(students)
  const wsData = [headers, ...rows]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
    { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
    { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الطلاب' : 'Students')
  XLSX.writeFile(wb, filename(lang, filtered, 'xlsx'))
}

export async function exportStudentsPdf(students: StudentRow[], lang: string, filtered: boolean) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const isAr = lang === 'ar'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const title = isAr ? 'قائمة الطلاب' : 'Student List'
  doc.setFontSize(16)
  doc.text(title, isAr ? doc.internal.pageSize.getWidth() - 14 : 14, 15, { align: isAr ? 'right' : 'left' })

  const dateStr = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')
  doc.setFontSize(10)
  doc.text(dateStr, isAr ? 14 : doc.internal.pageSize.getWidth() - 14, 15, { align: isAr ? 'left' : 'right' })

  const headers = [
    isAr ? 'كود' : 'Code',
    isAr ? 'الاسم' : 'Name',
    isAr ? 'تاريخ الميلاد' : 'DOB',
    isAr ? 'الجنس' : 'Gender',
    isAr ? 'المستوى' : 'Level',
    isAr ? 'المجموعة' : 'Group',
    isAr ? 'المرحلة' : 'Grade',
    isAr ? 'الحالة' : 'Status',
    isAr ? 'الهاتف' : 'Phone',
  ]

  const body = students.map(s => [
    s.studentCode,
    `${s.firstName} ${s.lastName}`.trim(),
    s.dateOfBirth?.split('T')[0] || '',
    s.gender || '',
    s.level?.name || '',
    s.group?.name || '',
    s.grade?.name || '',
    s.status,
    s.metadata?.phone || '',
  ])

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

  doc.save(filename(lang, filtered, 'pdf'))
}
