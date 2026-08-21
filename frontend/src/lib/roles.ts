export const ROLES = [
  { value: 'super_admin',       label: 'Super Admin',       labelAr: 'مشرف عام',       category: 'management' as const, level: 0 },
  { value: 'admin',             label: 'Admin',             labelAr: 'مدير',            category: 'management' as const, level: 1 },
  { value: 'principal',         label: 'Principal',         labelAr: 'مدير المدرسة',    category: 'management' as const, level: 2 },
  { value: 'curriculum_manager', label: 'Curriculum',       labelAr: 'منسق المنهج',     category: 'management' as const, level: 3 },
  { value: 'level_leader',      label: 'Level Leader',      labelAr: 'رئيس مرحلة',      category: 'ministry' as const,   level: 4 },
  { value: 'group_leader',      label: 'Group Leader',      labelAr: 'رئيس مجموعة',     category: 'ministry' as const,   level: 5 },
  { value: 'servant',           label: 'Servant',           labelAr: 'خادم',            category: 'ministry' as const,   level: 6 },
  { value: 'parent',            label: 'Parent',            labelAr: 'ولي أمر',         category: 'parent' as const,     level: 7 },
] as const

export type RoleValue = (typeof ROLES)[number]['value']
export type RoleCategory = (typeof ROLES)[number]['category']

export const SERVANT_ROLES: readonly string[] = ['servant', 'group_leader', 'level_leader']

export const ROLE_PERMISSIONS: Record<RoleValue, { label: string; labelAr: string; permissions: { action: string; actionAr: string }[] }> = {
  super_admin: {
    label: 'Super Admin', labelAr: 'مشرف عام',
    permissions: [
      { action: 'Manage all schools & churches', actionAr: 'إدارة جميع المدارس والكنائس' },
      { action: 'Approve pending registrations', actionAr: 'الموافقة على التسجيلات المعلقة' },
      { action: 'Create/Edit/Delete any user', actionAr: 'إنشاء/تعديل/حذف أي مستخدم' },
      { action: 'Switch between roles & schools', actionAr: 'التبديل بين الأدوار والمدارس' },
      { action: 'Full access to all modules', actionAr: 'وصول كامل لجميع الوحدات' },
    ],
  },
  admin: {
    label: 'Admin', labelAr: 'مدير',
    permissions: [
      { action: 'Manage school settings', actionAr: 'إدارة إعدادات المدرسة' },
      { action: 'Create/Edit/Delete teachers & servants', actionAr: 'إنشاء/تعديل/حذف المدرسين والخدام' },
      { action: 'Manage curriculum & assessments', actionAr: 'إدارة المنهج والتقييمات' },
      { action: 'View all students & reports', actionAr: 'عرض جميع الطلاب والتقارير' },
      { action: 'Manage attendance sessions', actionAr: 'إدارة جلسات الحضور' },
    ],
  },
  principal: {
    label: 'Principal', labelAr: 'مدير المدرسة',
    permissions: [
      { action: 'Oversee all school operations', actionAr: 'الإشراف على جميع عمليات المدرسة' },
      { action: 'Manage teachers & curriculum', actionAr: 'إدارة المدرسين والمنهج' },
      { action: 'View student performance reports', actionAr: 'عرض تقارير أداء الطلاب' },
      { action: 'Manage attendance & discipline', actionAr: 'إدارة الحضور والانضباط' },
    ],
  },
  curriculum_manager: {
    label: 'Curriculum', labelAr: 'منسق المنهج',
    permissions: [
      { action: 'Create & edit curriculum content', actionAr: 'إنشاء وتعديل محتوى المنهج' },
      { action: 'Manage lessons & topics', actionAr: 'إدارة الدروس والمواضيع' },
      { action: 'Assign curriculum to levels', actionAr: 'تخصيص المنهج للمراحل' },
      { action: 'View curriculum progress', actionAr: 'عرض تقدم المنهج' },
    ],
  },
  level_leader: {
    label: 'Level Leader', labelAr: 'رئيس مرحلة',
    permissions: [
      { action: 'Manage groups within their level', actionAr: 'إدارة المجموعات ضمن مرحلته' },
      { action: 'Assign servants to groups', actionAr: 'تعيين الخدام للمجموعات' },
      { action: 'View students in their level', actionAr: 'عرض الطلاب في مرحلته' },
      { action: 'Track attendance & assessments', actionAr: 'متابعة الحضور والتقييمات' },
    ],
  },
  group_leader: {
    label: 'Group Leader', labelAr: 'رئيس مجموعة',
    permissions: [
      { action: 'Manage their assigned group', actionAr: 'إدارة مجموعته المخصصة' },
      { action: 'Record attendance for their group', actionAr: 'تسجيل حضور مجموعته' },
      { action: 'View group student profiles', actionAr: 'عرض ملفات طلاب المجموعة' },
      { action: 'Submit assessments & feedback', actionAr: 'تقديم التقييمات والملاحظات' },
    ],
  },
  servant: {
    label: 'Servant', labelAr: 'خادم',
    permissions: [
      { action: 'View assigned students', actionAr: 'عرض الطلاب المعينين' },
      { action: 'Record attendance', actionAr: 'تسجيل الحضور' },
      { action: 'Submit student assessments', actionAr: 'تقديم تقييمات الطلاب' },
      { action: 'View curriculum & lesson plans', actionAr: 'عرض المنهج وخطط الدروس' },
    ],
  },
  parent: {
    label: 'Parent', labelAr: 'ولي أمر',
    permissions: [
      { action: 'View their children\'s profiles', actionAr: 'عرض ملفات أطفالهم' },
      { action: 'View attendance records', actionAr: 'عرض سجلات الحضور' },
      { action: 'View assessment results', actionAr: 'عرض نتائج التقييمات' },
      { action: 'View gamification progress', actionAr: 'عرض تقدم الألعاب التحفيزية' },
    ],
  },
}

export function getRoleByValue(value: string) {
  return ROLES.find(r => r.value === value)
}

export function roleCategory(role: string): RoleCategory {
  if (['super_admin', 'admin', 'principal', 'curriculum_manager'].includes(role)) return 'management'
  if (['servant', 'group_leader', 'level_leader'].includes(role)) return 'ministry'
  return 'parent'
}
