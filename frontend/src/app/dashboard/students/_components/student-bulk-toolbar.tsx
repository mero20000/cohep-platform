'use client'
import { Button } from '@/components/ui/button'
interface Props {
  selectedCount: number; onDelete: () => void; onChangeStatus: () => void
  onChangeLevel: () => void; onChangeGrade: () => void; onClear: () => void
  lang: 'en' | 'ar'
}
export function StudentBulkToolbar({ selectedCount, onDelete, onChangeStatus, onChangeLevel, onChangeGrade, onClear, lang }: Props) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 animate-[slideUp_150ms_ease-out]">
      <span className="text-sm font-medium text-blue-700">{selectedCount} {t('selected','محدد')}</span>
      <div className="h-4 w-px bg-gold-200" />
      <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-100">{t('Delete','حذف')}</Button>
      <Button variant="ghost" size="sm" onClick={onChangeStatus}>{t('Change Status','تغيير الحالة')}</Button>
      <Button variant="ghost" size="sm" onClick={onChangeLevel}>{t('Change Level','تغيير المستوى')}</Button>
      <Button variant="ghost" size="sm" onClick={onChangeGrade}>{t('Change Grade','تغيير المرحلة')}</Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-gray-500 hover:bg-gray-200">{t('Clear','مسح')}</Button>
    </div>
  )
}
