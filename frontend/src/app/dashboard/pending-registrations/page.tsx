'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { http } from '@/lib/http-client'
import { Loader2, CheckCircle2, XCircle, Clock, Mail, Building2, MapPin, Phone, User, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface PendingRegistration {
  id: string
  schoolName: string
  churchName: string
  country: string
  city: string
  educationLanguage: string
  users: { id: string; email: string; firstName: string; lastName: string; phone: string; createdAt: string }[]
  createdAt: string
}

export default function PendingRegistrationsPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null)

  const fetchRegistrations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await http.get<PendingRegistration[]>('/admin/pending-registrations')
      setRegistrations(data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load pending registrations')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRegistrations()
  }, [fetchRegistrations])

  const handleApprove = async (id: string) => {
    setProcessing(id)
    try {
      await http.post(`/admin/pending-registrations/${id}/approve`)
      setRegistrations((prev) => prev.filter((r) => r.id !== id))
      toast('success', lang === 'ar' ? 'تم الموافقة على التسجيل' : 'Registration approved')
    } catch (e: any) {
      toast('error', e?.message || 'Failed to approve')
    }
    setProcessing(null)
  }

  const handleReject = async (id: string) => {
    setConfirmRejectId(null)
    setProcessing(id)
    try {
      await http.post(`/admin/pending-registrations/${id}/reject`)
      setRegistrations((prev) => prev.filter((r) => r.id !== id))
      toast('success', lang === 'ar' ? 'تم رفض التسجيل' : 'Registration rejected')
    } catch (e: any) {
      toast('error', e?.message || 'Failed to reject')
    }
    setProcessing(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {lang === 'ar' ? 'العودة' : 'Back'}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === 'ar' ? 'تسجيلات قيد المراجعة' : 'Pending Registrations'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === 'ar'
            ? 'قم بمراجعة واعتماد طلبات تسجيل الكنائس الجديدة'
            : 'Review and approve new church registration requests'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && registrations.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-50 mb-4">
            <CheckCircle2 className="h-7 w-7 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {lang === 'ar' ? 'لا توجد طلبات معلقة' : 'No Pending Requests'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {lang === 'ar' ? 'جميع طلبات التسجيل تمت معالجتها' : 'All registration requests have been processed'}
          </p>
        </div>
      )}

      {!loading && !error && registrations.length > 0 && (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <div key={reg.id} className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{reg.churchName}</h3>
                      <p className="text-sm text-gray-500">{reg.schoolName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      {lang === 'ar' ? 'قيد المراجعة' : 'Pending Review'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {reg.users[0] && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{reg.users[0].firstName} {reg.users[0].lastName}</span>
                    </div>
                  )}
                  {reg.users[0]?.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{reg.users[0].email}</span>
                    </div>
                  )}
                  {reg.country && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{reg.city}, {reg.country}</span>
                    </div>
                  )}
                  {reg.users[0]?.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{reg.users[0].phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    {lang === 'ar' ? 'تم التقديم: ' : 'Submitted: '}
                    {new Date(reg.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    {confirmRejectId === reg.id ? (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
                        <span className="text-xs font-medium text-red-700">
                          {lang === 'ar' ? 'تأكيد رفض هذا التسجيل؟' : 'Confirm rejection?'}
                        </span>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setConfirmRejectId(null)}
                          disabled={processing === reg.id}
                          className="text-gray-600 hover:bg-red-100"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                          variant="destructive" size="sm"
                          onClick={() => handleReject(reg.id)}
                          disabled={processing === reg.id}
                        >
                          {processing === reg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {lang === 'ar' ? 'تأكيد الرفض' : 'Confirm'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="destructive" size="sm"
                        onClick={() => setConfirmRejectId(reg.id)}
                        disabled={processing === reg.id}
                      >
                        {processing === reg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {lang === 'ar' ? 'رفض' : 'Reject'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleApprove(reg.id)}
                      disabled={processing === reg.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing === reg.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {lang === 'ar' ? 'اعتماد' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
