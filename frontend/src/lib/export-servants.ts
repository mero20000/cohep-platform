export type ServantRow = {
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  email?: string
  phone?: string
  roles: string[]
  groupName?: string
  levelName?: string
  isActive: boolean
  joinedAt?: string
}

function buildHeaders(lang: string) {
  return lang === 'ar'
    ? ['الاسم', 'الاسم (عربي)', 'البريد الإلكتروني', 'الهاتف', 'الأدوار', 'المجموعة', 'المستوى', 'الحالة', 'تاريخ الانضمام']
    : ['Name', 'Name (Ar)', 'Email', 'Phone', 'Roles', 'Group', 'Level', 'Status', 'Joined']
}

function buildRows(rows: ServantRow[], lang: string) {
  return rows.map(r => [
    `${r.firstName} ${r.lastName}`.trim(),
    r.firstNameAr && r.lastNameAr ? `${r.firstNameAr} ${r.lastNameAr}`.trim() : '',
    r.email || '',
    r.phone || '',
    r.roles.join(', '),
    r.groupName || '',
    r.levelName || '',
    r.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive'),
    r.joinedAt?.split('T')[0] || '',
  ])
}

function filename(lang: string, ext: string) {
  const base = lang === 'ar' ? 'بيانات-الخدام' : 'servants-data'
  const date = new Date().toISOString().split('T')[0]
  return `${base}-${date}.${ext}`
}

export async function exportServantsXlsx(rows: ServantRow[], lang: string) {
  const XLSX = await import('xlsx')
  const headers = buildHeaders(lang)
  const data = buildRows(rows, lang)
  const wsData = [headers, ...data]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الخدام' : 'Servants')
  XLSX.writeFile(wb, filename(lang, 'xlsx'))
}

export async function exportServantsPdf(rows: ServantRow[], lang: string) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const isAr = lang === 'ar'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const title = isAr ? 'بيانات الخدام' : 'Servants Report'
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
