'use client'
import { useState } from 'react'
import { Search, Loader2, ChevronDown, Sliders, Star, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Level, Group, ChurchItem } from './student-types'
import type { GradeItem } from '@/lib/grades'

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
  gradeOptions: GradeItem[]; churches: ChurchItem[]
  hasActiveFilters: boolean; onClearFilters: () => void
  showFavoritesOnly?: boolean; onFavoritesToggle?: () => void; favorites?: string[]
  showMyStudentsOnly?: boolean; onMyStudentsToggle?: () => void
  lang: 'en' | 'ar'
}

const sel = 'w-full sm:w-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500'

export function StudentFilters(p: Props) {
  const t = (en: string, ar: string) => p.lang === 'ar' ? ar : en
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasAdvancedFilters = p.filterChurch || p.filterGrade || p.filterGender
  const advancedFiltersCount = [p.filterChurch, p.filterGrade, p.filterGender].filter(Boolean).length

  return (
    <div className="space-y-3">
      {/* Primary filters - always visible */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            aria-label={t('Search students','بحث عن الطلاب')}
            placeholder={t('Search by name or code...','البحث بالاسم أو الرمز...')}
            value={p.search}
            onChange={e => p.onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white ps-10 pe-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
          {p.isSearching && <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gold-700 animate-spin" />}
        </div>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <select
            aria-label={t('Filter by level','تصفية حسب المستوى')}
            value={p.filterLevel}
            onChange={e => p.onLevelChange(e.target.value)}
            className={sel}
          >
            <option value="">{t('All Levels','جميع المستويات')}</option>
            {p.activeLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <select
            aria-label={t('Filter by group','تصفية حسب المجموعة')}
            value={p.filterGroup}
            onChange={e => p.onGroupChange(e.target.value)}
            className={sel}
          >
            <option value="">{t('All Groups','جميع المجموعات')}</option>
            {p.filterGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select
            aria-label={t('Filter by status','تصفية حسب الحالة')}
            value={p.filterStatus}
            onChange={e => p.onStatusChange(e.target.value)}
            className={sel}
          >
            <option value="">{t('All Status','جميع الحالات')}</option>
            <option value="active">{t('Active','نشط')}</option>
            <option value="inactive">{t('Inactive','غير نشط')}</option>
            <option value="graduated">{t('Graduated','متخرج')}</option>
          </select>

          {p.onFavoritesToggle && (
            <button
              onClick={p.onFavoritesToggle}
              aria-label={t('Filter by favorites','تصفية حسب المفضلة')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                p.showFavoritesOnly
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
              title={t('Show favorites only', 'اعرض المفضلة فقط')}
            >
              <Star className={`h-4 w-4 ${p.showFavoritesOnly ? 'fill-amber-500' : ''}`} />
              <span className="hidden sm:inline">{t('Favorites', 'المفضلة')}</span>
              <span className="text-xs ml-1">({p.favorites?.length || 0})</span>
            </button>
          )}

          {p.onMyStudentsToggle && (
            <button
              onClick={p.onMyStudentsToggle}
              aria-label={t('Filter by my students','تصفية حسب طلابي')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                p.showMyStudentsOnly
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
              title={t('Show only students assigned to me', 'اعرض الطلاب المسندين إلي فقط')}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t('My Students', 'طلابي')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced filters - collapsible on mobile */}
      <div className="md:flex gap-2 flex-wrap hidden">
        <select
          aria-label={t('Filter by grade','تصفية حسب المرحلة')}
          value={p.filterGrade}
          onChange={e => p.onGradeChange(e.target.value)}
          className={sel}
        >
          <option value="">{t('All Grades','جميع المراحل')}</option>
          {p.gradeOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select
          aria-label={t('Filter by gender','تصفية حسب الجنس')}
          value={p.filterGender}
          onChange={e => p.onGenderChange(e.target.value)}
          className={sel}
        >
          <option value="">{t('All Genders','جميع الجنسين')}</option>
          <option value="male">{t('Male','ذكر')}</option>
          <option value="female">{t('Female','أنثى')}</option>
        </select>

        <select
          aria-label={t('Filter by church','تصفية حسب الكنيسة')}
          value={p.filterChurch}
          onChange={e => p.onChurchChange(e.target.value)}
          className={sel}
        >
          <option value="">{t('All Churches','جميع الكنائس')}</option>
          {p.churches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        {p.hasActiveFilters && (
          <Button onClick={p.onClearFilters} variant="outline" size="sm" className="whitespace-nowrap text-red-700 border-red-200 bg-red-50 hover:bg-red-100">
            {t('Clear','مسح')}
          </Button>
        )}
      </div>

      {/* Advanced filters button for mobile */}
      <div className="md:hidden flex gap-2">
        <Button
          onClick={() => setShowAdvanced(!showAdvanced)}
          variant={showAdvanced ? 'default' : 'outline'}
          size="sm"
          className="inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Sliders className="h-4 w-4" />
          {t('Advanced','متقدم')}
          {advancedFiltersCount > 0 && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">{advancedFiltersCount}</span>}
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Button>

        {p.hasActiveFilters && (
          <Button onClick={p.onClearFilters} variant="outline" size="sm" className="whitespace-nowrap text-red-700 border-red-200 bg-red-50 hover:bg-red-100">
            {t('Clear','مسح')}
          </Button>
        )}
      </div>

      {/* Advanced filters panel on mobile */}
      {showAdvanced && (
        <div className="md:hidden flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50">
          <select
            aria-label={t('Filter by grade','تصفية حسب المرحلة')}
            value={p.filterGrade}
            onChange={e => p.onGradeChange(e.target.value)}
            className={sel}
          >
            <option value="">{t('All Grades','جميع المراحل')}</option>
            {p.gradeOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <select
            aria-label={t('Filter by gender','تصفية حسب الجنس')}
            value={p.filterGender}
            onChange={e => p.onGenderChange(e.target.value)}
            className={sel}
          >
            <option value="">{t('All Genders','جميع الجنسين')}</option>
            <option value="male">{t('Male','ذكر')}</option>
            <option value="female">{t('Female','أنثى')}</option>
          </select>

          <select
            aria-label={t('Filter by church','تصفية حسب الكنيسة')}
            value={p.filterChurch}
            onChange={e => p.onChurchChange(e.target.value)}
            className={sel}
          >
            <option value="">{t('All Churches','جميع الكنائس')}</option>
            {p.churches.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
