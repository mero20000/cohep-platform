'use client'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Level, Group, ChurchItem } from './student-types'

interface Props {
  search: string; onSearchChange: (v: string) => void
  isSearching?: boolean
  filterLevel: string; onLevelChange: (v: string) => void
  filterGroup: string; onGroupChange: (v: string) => void
  filterStatus: string; onStatusChange: (v: string) => void
  filterChurch: string; onChurchChange: (v: string) => void
  filterGrade: string; onGradeChange: (v: string) => void
  filterGender: string; onGenderChange: (v: string) => void
  activeLevels: Level[]; filterGroups: Group[]
  gradeOptions: string[]; churches: ChurchItem[]
  hasActiveFilters: boolean; onClearFilters: () => void
  lang: 'en' | 'ar'
}

const sel = 'w-full sm:w-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none'

export function StudentFilters(p: Props) {
  const t = (en: string, ar: string) => p.lang === 'ar' ? ar : en
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder={t('Search by name or code...','البحث بالاسم أو الرمز...')} value={p.search}
          onChange={e => p.onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm placeholder:text-gray-400 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        {p.isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gold-500 animate-spin" />}
      </div>
      <select value={p.filterLevel} onChange={e => p.onLevelChange(e.target.value)} className={sel}>
        <option value="">{t('All Levels','جميع المستويات')}</option>
        {p.activeLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <select value={p.filterGroup} onChange={e => p.onGroupChange(e.target.value)} disabled={!p.filterLevel} title={p.filterLevel?'':t('Select a level first','اختر مستوى أولاً')} className={`${sel} disabled:bg-gray-50 disabled:text-gray-400`}>
        <option value="">{p.filterLevel?t('All Groups','جميع المجموعات'):t('Select level first','اختر المستوى أولاً')}</option>
        {p.filterGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <select value={p.filterStatus} onChange={e => p.onStatusChange(e.target.value)} className={sel}>
        <option value="">{t('All Status','جميع الحالات')}</option>
        <option value="active">{t('Active','نشط')}</option>
        <option value="inactive">{t('Inactive','غير نشط')}</option>
        <option value="graduated">{t('Graduated','متخرج')}</option>
      </select>
      <select value={p.filterGrade} onChange={e => p.onGradeChange(e.target.value)} className={sel}>
        <option value="">{t('All Grades','جميع المراحل')}</option>
        {p.gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select value={p.filterGender} onChange={e => p.onGenderChange(e.target.value)} className={sel}>
        <option value="">{t('All Genders','جميع الجنسين')}</option>
        <option value="male">{t('Male','ذكر')}</option>
        <option value="female">{t('Female','أنثى')}</option>
      </select>
      <select value={p.filterChurch} onChange={e => p.onChurchChange(e.target.value)} className={sel}>
        <option value="">{t('All Churches','جميع الكنائس')}</option>
        {p.churches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
      </select>
      {p.hasActiveFilters && (
        <Button onClick={p.onClearFilters} variant="outline" size="sm" className="whitespace-nowrap text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
          {t('Clear Filters','مسح الفلتر')}
        </Button>
      )}
    </div>
  )
}
