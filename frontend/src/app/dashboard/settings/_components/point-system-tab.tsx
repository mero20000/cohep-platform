'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Loader2, Save } from 'lucide-react'

interface PointRules {
  presentPoints: number
  latePoints: number
  excusedPoints: number
  liturgyPoints: number
  behaviorMultiplier: number
  participationMultiplier: number
}

const DEFAULTS: PointRules = { presentPoints: 5, latePoints: 2, excusedPoints: 1, liturgyPoints: 3, behaviorMultiplier: 2, participationMultiplier: 2 }

export function PointSystemTab() {
  const lang = useLanguage()
  const { toast } = useToast()
  const schoolId = getSchoolId()
  const [rules, setRules] = useState<PointRules>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!schoolId) return
    setLoading(true)
    http.get<{ value: PointRules }[] | { value: PointRules }>(`/users/schools/${schoolId}/config`, { key: 'point_rules' })
      .then(data => {
        const cfg = Array.isArray(data) ? data?.[0] : data
        if (cfg?.value) setRules({ ...DEFAULTS, ...cfg.value })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [schoolId])

  const save = async () => {
    setSaving(true)
    try {
      await http.post(`/users/schools/${schoolId}/config`, {
        key: 'point_rules',
        value: rules,
        description: lang === 'ar' ? 'إعدادات نظام النقاط' : 'Point system rules',
      })
      toast('success', lang === 'ar' ? 'تم الحفظ' : 'Saved')
    } catch {
      toast('error', lang === 'ar' ? 'فشل الحفظ' : 'Failed to save')
    }
    setSaving(false)
  }

  if (loading) return <div className="py-16 px-4"><TableSkeleton rows={6} cols={2} /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'نظام النقاط' : 'Point System'}</h2>
        <p className="text-sm text-gray-500">{lang === 'ar' ? 'تحديد عدد النقاط الممنوحة للطلاب بناءً على الحضور والسلوك والمشاركة والقداس' : 'Configure points awarded to students based on attendance, behavior, participation, and liturgy'}</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {/* Present */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-900">{lang === 'ar' ? 'الحضور (حاضر)' : 'Attendance (Present)'}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? 'نقاط ثابتة لكل طالب حضوره مسجل كـ "حاضر"' : 'Fixed points per student marked Present'}</div>
          </div>
          <input type="number" min={0} max={100} value={rules.presentPoints} onChange={e => setRules({ ...rules, presentPoints: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-gold-500 focus:outline-none" />
        </div>

        {/* Late */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-900">{lang === 'ar' ? 'الحضور (متأخر)' : 'Attendance (Late)'}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? 'نقاط ثابتة للطالب المتأخر — أفضل من الغياب' : 'Fixed points for a late student — better than absent'}</div>
          </div>
          <input type="number" min={0} max={100} value={rules.latePoints} onChange={e => setRules({ ...rules, latePoints: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-gold-500 focus:outline-none" />
        </div>

        {/* Excused */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-900">{lang === 'ar' ? 'الحضور (معذور)' : 'Attendance (Excused)'}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? 'نقاط ثابتة للعذر المقبول — لا يُعاقب الطالب' : 'Fixed points for a valid excuse — student not penalized'}</div>
          </div>
          <input type="number" min={0} max={100} value={rules.excusedPoints} onChange={e => setRules({ ...rules, excusedPoints: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-gold-500 focus:outline-none" />
        </div>

        {/* Behavior */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-900">{lang === 'ar' ? 'مضاعف السلوك' : 'Behavior Multiplier'}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? `تقييم السلوك (0-5) × ${rules.behaviorMultiplier} = 0-${5 * rules.behaviorMultiplier} نقاط` : `Behavior score (0-5) × ${rules.behaviorMultiplier} = 0-${5 * rules.behaviorMultiplier} points`}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">×</span>
            <input type="number" min={1} max={10} value={rules.behaviorMultiplier} onChange={e => setRules({ ...rules, behaviorMultiplier: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-gold-500 focus:outline-none" />
          </div>
        </div>

        {/* Participation */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-900">{lang === 'ar' ? 'مضاعف المشاركة' : 'Participation Multiplier'}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? `تقييم المشاركة (0-5) × ${rules.participationMultiplier} = 0-${5 * rules.participationMultiplier} نقاط` : `Participation score (0-5) × ${rules.participationMultiplier} = 0-${5 * rules.participationMultiplier} points`}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">×</span>
            <input type="number" min={1} max={10} value={rules.participationMultiplier} onChange={e => setRules({ ...rules, participationMultiplier: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-gold-500 focus:outline-none" />
          </div>
        </div>

        {/* Liturgy */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-900">{lang === 'ar' ? 'حضور القداس' : 'Liturgy Attendance'}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? 'نقاط ثابتة عند حضور القداس' : 'Fixed points when liturgy is attended'}</div>
          </div>
          <input type="number" min={0} max={100} value={rules.liturgyPoints} onChange={e => setRules({ ...rules, liturgyPoints: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-center focus:border-gold-500 focus:outline-none" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-indigo-50 px-5 py-4">
        <h4 className="text-sm font-semibold text-indigo-900 mb-1">{lang === 'ar' ? 'ملخص طريقة الاحتساب' : 'Calculation Summary'}</h4>
        <p className="text-xs text-indigo-700 leading-relaxed">
          {lang === 'ar'
            ? `النقاط الإجمالية = (حاضر × ${rules.presentPoints}) + (متأخر × ${rules.latePoints}) + (معذور × ${rules.excusedPoints}) + (سلوك × ${rules.behaviorMultiplier}) + (مشاركة × ${rules.participationMultiplier}) + (قداس × ${rules.liturgyPoints})`
            : `Total = (Present × ${rules.presentPoints}) + (Late × ${rules.latePoints}) + (Excused × ${rules.excusedPoints}) + (Behavior × ${rules.behaviorMultiplier}) + (Participation × ${rules.participationMultiplier}) + (Liturgy × ${rules.liturgyPoints})`}
        </p>
        <p className="text-xs text-indigo-600 mt-1">
          {lang === 'ar'
            ? `الحد الأقصى لكل حصة = ${rules.presentPoints} + ${5 * rules.behaviorMultiplier} + ${5 * rules.participationMultiplier} + ${rules.liturgyPoints} = ${rules.presentPoints + 5 * rules.behaviorMultiplier + 5 * rules.participationMultiplier + rules.liturgyPoints} نقطة`
            : `Max per session = ${rules.presentPoints} + ${5 * rules.behaviorMultiplier} + ${5 * rules.participationMultiplier} + ${rules.liturgyPoints} = ${rules.presentPoints + 5 * rules.behaviorMultiplier + 5 * rules.participationMultiplier + rules.liturgyPoints} pts`}
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
