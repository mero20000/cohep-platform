'use client'
import { Button } from '@/components/ui/button'
import { Download, Users } from 'lucide-react'

interface Props {
  selectedCount: number; onDelete: () => void; onChangeStatus: () => void
  onChangeLevel: () => void; onChangeGrade: () => void; onAssignServant: () => void
  onExport: () => void; onClear: () => void
  lang: 'en' | 'ar'
}

export function StudentBulkToolbar({ selectedCount, onDelete, onChangeStatus, onChangeLevel, onChangeGrade, onAssignServant, onExport, onClear, lang }: Props) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  return (
    <div className="flex items-center gap-2 rounded-xl border border-semantic-toolbar-border bg-semantic-toolbar px-4 py-3 animate-slideUp overflow-x-auto">
      <span className="text-sm font-medium text-white/90 whitespace-nowrap">{selectedCount} {t('selected','محدد')}</span>
      <div className="h-4 w-px bg-semantic-toolbar-border" />

      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 px-1 sm:px-0">
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-semantic-status-inactive hover:bg-red-100 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9">{t('Delete','حذف')}</Button>
        <Button variant="ghost" size="sm" onClick={onChangeStatus} className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9">{t('Status','الحالة')}</Button>
        <Button variant="ghost" size="sm" onClick={onChangeLevel} className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9">{t('Level','المستوى')}</Button>
        <Button variant="ghost" size="sm" onClick={onChangeGrade} className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9">{t('Grade','المرحلة')}</Button>

        <div className="h-4 w-px bg-semantic-toolbar-border hidden sm:block" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onAssignServant}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm text-semantic-role-servant hover:bg-purple-100 px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9"
          title={t('Assign to servant','تعيين لخادم')}
        >
          <Users className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">{t('Assign','تعيين')}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm text-semantic-activity-create hover:bg-green-100 px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9"
          title={t('Export to CSV','تصدير إلى CSV')}
        >
          <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">{t('Export','تصدير')}</span>
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-gray-500 hover:bg-gray-200 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto sm:h-9">{t('Clear','مسح')}</Button>
    </div>
  )
}
