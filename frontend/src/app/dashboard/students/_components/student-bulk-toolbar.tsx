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
    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 animate-[slideUp_150ms_ease-out] overflow-x-auto">
      <span className="text-sm font-medium text-blue-700 whitespace-nowrap">{selectedCount} {t('selected','محدد')}</span>
      <div className="h-4 w-px bg-blue-200" />

      <div className="flex items-center gap-2 overflow-x-auto flex-1">
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-100 whitespace-nowrap text-xs sm:text-sm">{t('Delete','حذف')}</Button>
        <Button variant="ghost" size="sm" onClick={onChangeStatus} className="whitespace-nowrap text-xs sm:text-sm">{t('Status','الحالة')}</Button>
        <Button variant="ghost" size="sm" onClick={onChangeLevel} className="whitespace-nowrap text-xs sm:text-sm">{t('Level','المستوى')}</Button>
        <Button variant="ghost" size="sm" onClick={onChangeGrade} className="whitespace-nowrap text-xs sm:text-sm">{t('Grade','المرحلة')}</Button>

        <div className="h-4 w-px bg-blue-200 hidden sm:block" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onAssignServant}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm text-purple-600 hover:bg-purple-100"
          title={t('Assign to servant','تعيين لخادم')}
        >
          <Users className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('Assign','تعيين')}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm text-green-600 hover:bg-green-100"
          title={t('Export to CSV','تصدير إلى CSV')}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('Export','تصدير')}</span>
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-gray-500 hover:bg-gray-200 whitespace-nowrap text-xs sm:text-sm">{t('Clear','مسح')}</Button>
    </div>
  )
}
