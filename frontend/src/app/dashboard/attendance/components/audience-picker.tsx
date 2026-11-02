'use client'
import { FormField } from '@/components/ui/form-field'
import type { AudienceValue } from '../lib/audience'

interface Opt { id: string; name: string }

/**
 * Who a liturgy/event is for.
 * - `multi` (admins, principals, level leaders): tick one or more groups, or "All groups".
 * - otherwise (group staff): their own group by default, or pick one.
 */
export function AudiencePicker({
  value, onChange, groups, levels, grades, multi, lang, error,
}: {
  value: AudienceValue
  onChange: (v: AudienceValue) => void
  groups: Opt[]
  levels: Array<{ id: string; number: number }>
  grades: Array<{ id: string; name: string; groupId?: string }>
  multi: boolean
  lang: 'en' | 'ar'
  error?: string
}) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  if (!multi) {
    return (
      <FormField
        as="select"
        label={t('Group', 'المجموعة')}
        value={value.groupIds[0] ?? ''}
        onChange={e => onChange({ ...value, groupIds: e.target.value ? [e.target.value] : [] })}
        error={error}
      >
        <option value="">{t('My group', 'مجموعتي')}</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </FormField>
    )
  }

  const toggle = (id: string) =>
    onChange({
      ...value,
      groupIds: value.groupIds.includes(id) ? value.groupIds.filter(x => x !== id) : [...value.groupIds, id],
      gradeId: '',
    })
  const onlyGroup = value.groupIds.length === 1 ? value.groupIds[0] : null

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-gray-700">{t('Audience *', 'الفئة المستهدفة *')}</legend>
      <label className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={value.allGroups}
          onChange={e => onChange({ ...value, allGroups: e.target.checked, groupIds: e.target.checked ? [] : value.groupIds, gradeId: '' })}
          className="h-5 w-5 rounded border-gray-300"
        />
        {t('All groups', 'كل المجموعات')}
      </label>
      {!value.allGroups && (
        <div role="group" aria-label={t('Groups', 'المجموعات')} className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-2 sm:grid-cols-2">
          {groups.map(g => (
            <label key={g.id} className="flex min-h-[40px] items-center gap-2 rounded px-2 text-sm text-gray-800 hover:bg-gray-50">
              <input type="checkbox" checked={value.groupIds.includes(g.id)} onChange={() => toggle(g.id)} className="h-4 w-4 rounded border-gray-300" />
              {g.name}
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField as="select" label={t('Level', 'المستوى')} value={value.levelId} onChange={e => onChange({ ...value, levelId: e.target.value })}>
          <option value="">{t('All levels', 'جميع المستويات')}</option>
          {levels.map(l => <option key={l.id} value={l.id}>{t(`Level ${l.number}`, `المستوى ${l.number}`)}</option>)}
        </FormField>
        <FormField
          as="select"
          label={t('Grade', 'الصف')}
          value={value.gradeId}
          disabled={!onlyGroup}
          onChange={e => onChange({ ...value, gradeId: e.target.value })}
        >
          <option value="">{onlyGroup ? t('All grades', 'جميع الصفوف') : t('Pick one group', 'اختر مجموعة واحدة')}</option>
          {onlyGroup && grades.filter(g => g.groupId === onlyGroup).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </FormField>
        <FormField as="select" label={t('Gender', 'الجنس')} value={value.gender} onChange={e => onChange({ ...value, gender: e.target.value })}>
          <option value="">{t('Everyone', 'الكل')}</option>
          <option value="male">{t('Male', 'ذكور')}</option>
          <option value="female">{t('Female', 'إناث')}</option>
        </FormField>
      </div>
    </fieldset>
  )
}
