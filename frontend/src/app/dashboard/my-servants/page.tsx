'use client'

import { useCallback, useEffect, useState } from 'react'
import { Heart, Mail, Phone, Calendar, Users, AlertCircle, Loader2 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { getSchoolId } from '@/lib/school'
import { assetUrl } from '@/lib/asset-url'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

interface ServantStats {
  id: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  email?: string
  phone?: string
  photoUrl?: string
  groupId?: string
  groupName?: string
  groupNameAr?: string
  levelId?: string
  levelName?: string
  attendanceRate: number
  studentsManaged: number
  role?: string
}

export default function MyServantsPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [servants, setServants] = useState<ServantStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const schoolId = getSchoolId()
      if (!schoolId) throw new Error('No school ID')
      const data = await http.get<ServantStats[]>('/servants', {
        schoolId,
        levelScoped: 'true'
      })
      setServants(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load servants:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 h-64 animate-pulse">
              <div className="h-12 w-12 bg-gray-200 rounded-full mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
              <div className="h-3 bg-gray-100 rounded mb-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">
          {t('My Servants', 'خدامي')}
        </h1>
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title={t("Couldn't load servants", 'تعذر تحميل الخدام')}
            description={t('Something went wrong. Please try again.', 'حدث خطأ ما. حاول مرة أخرى.')}
            action={
              <Button onClick={load} className="bg-gold-500 hover:bg-gold-600 text-gray-950">
                {t('Retry', 'إعادة المحاولة')}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  if (servants.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">
          {t('My Servants', 'خدامي')}
        </h1>
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title={t('No servants yet', 'لا يوجد خدام بعد')}
            description={t('Servants assigned to your level will appear here', 'سيظهر الخدام المعينون لمستواك هنا')}
          />
        </div>
      </div>
    )
  }

  const groupedByGroup = servants.reduce((acc, servant) => {
    const groupId = servant.groupId || 'unassigned'
    if (!acc[groupId]) {
      acc[groupId] = {
        groupName: servant.groupName || t('Unassigned', 'بدون تعيين'),
        groupNameAr: servant.groupNameAr || t('Unassigned', 'بدون تعيين'),
        servants: [],
      }
    }
    acc[groupId].servants.push(servant)
    return acc
  }, {} as Record<string, { groupName: string; groupNameAr: string; servants: ServantStats[] }>)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('My Servants', 'خدامي')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t(`${servants.length} servants in your level`, `${servants.length} خدام في مستواك`)}
        </p>
      </div>

      {Object.entries(groupedByGroup).map(([groupId, { groupName, groupNameAr, servants: groupServants }]) => (
        <div key={groupId} className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {lang === 'ar' ? groupNameAr : groupName}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {t(`${groupServants.length} servants`, `${groupServants.length} خدام`)}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupServants.map(servant => (
              <div
                key={servant.id}
                className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-100">
                      {servant.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetUrl(servant.photoUrl)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Heart className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {lang === 'ar'
                          ? `${servant.firstNameAr || servant.firstName} ${servant.lastNameAr || servant.lastName}`
                          : `${servant.firstName} ${servant.lastName}`
                        }
                      </h3>
                      {servant.role && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {servant.role === 'group_leader' ? t('Group Leader', 'رئيس مجموعة') : t('Servant', 'خادم')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {servant.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 min-w-0">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <a href={`mailto:${servant.email}`} className="truncate text-blue-600 hover:underline">
                        {servant.email}
                      </a>
                    </div>
                  )}

                  {servant.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <a href={`tel:${servant.phone}`} className="text-blue-600 hover:underline">
                        {servant.phone}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    <span>{t(`${servant.studentsManaged} students`, `${servant.studentsManaged} طالب`)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <div className="flex-1">
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${servant.attendanceRate}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {Math.round(servant.attendanceRate)}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => window.location.href = `/dashboard/servants/${servant.id}/profile`}
                  >
                    {t('View', 'عرض')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
