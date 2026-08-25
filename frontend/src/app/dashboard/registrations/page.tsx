'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Loader2, CheckCircle2, XCircle, Pencil, Eye, Music, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { AudioPlayer } from '@/components/audio-player'
import { assetUrl } from '@/lib/asset-url'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'

export default function RegistrationsPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [status, setStatus] = useState('pending')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [levelId, setLevelId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [levels, setLevels] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const data = await http.get<any[]>(`/registrations`, { schoolId: getSchoolId(), status })
      setItems(data || [])
    } catch { setItems([]) }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [status])
  useEffect(() => {
    http.get<any[]>('/curriculum/levels', { schoolId: getSchoolId() }).then(setLevels).catch(()=>{})
    http.get<any[]>('/students/groups/all', { schoolId: getSchoolId() }).then(()=>{}).catch(()=>{})
    // grades
    import('@/lib/grades').then(m=> m.fetchActiveGrades().then(setGrades).catch(()=>{}))
  }, [])

  const handleApprove = async () => {
    if (!selected) return
    setApproving(true)
    try {
      await http.post(`/registrations/${selected.id}/approve`, { levelId: levelId||undefined, groupId: groupId||undefined, gradeId: gradeId||undefined })
      toast('success', t('Approved — student created', 'تمت الموافقة — تم إنشاء الطالب'))
      setSelected(null); fetchAll()
    } catch (e: any) { toast('error', e.message) }
    setApproving(false)
  }

  const handleReject = async () => {
    if (!selected) return
    const reason = prompt(t('Reason for rejection?', 'سبب الرفض؟')) || ''
    setRejecting(true)
    try {
      await http.post(`/registrations/${selected.id}/reject`, { reason })
      toast('success', t('Rejected', 'تم الرفض'))
      setSelected(null); fetchAll()
    } catch (e: any) { toast('error', e.message) }
    setRejecting(false)
  }

  const handleUpdate = async () => {
    if (!selected || !editData) return
    try {
      await http.patch(`/registrations/${selected.id}`, { studentData: editData })
      toast('success', t('Updated', 'تم التحديث'))
      setSelected({ ...selected, studentData: editData })
      fetchAll()
    } catch (e: any) { toast('error', e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Registrations','التسجيلات')}</h1>
          <p className="text-sm text-gray-500">{t('Review new joiners — edit before approve','مراجعة المتقدمين — يمكن التعديل قبل الموافقة')}</p>
        </div>
        <div className="text-xs text-gray-400">{t('Share link:','رابط المشاركة:')} <code className="bg-gray-100 px-2 py-1 rounded">/register/{typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('user')||'{}')?.schoolId || 'school-slug') : 'school-slug'}</code></div>
      </div>

      <div className="flex gap-2">
        {(['pending','approved','rejected'] as const).map(s=>(
          <button key={s} onClick={()=>setStatus(s)} className={`px-4 py-2 rounded-full text-sm font-medium border ${status===s ? 'bg-gold-500 border-gold-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s.charAt(0).toUpperCase()+s.slice(1)} {status===s && `(${items.length})`}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gold-600" /></div>
      : items.length===0 ? <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500">{t('No applications','لا توجد طلبات')}</div>
      : <div className="grid gap-4 md:grid-cols-2">
          {items.map(app=>{
            const sd: any = app.studentData || {}
            return (
              <div key={app.id} className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    {sd.photoUrl ? <Image src={assetUrl(sd.photoUrl)} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized /> : <div className="h-full w-full flex items-center justify-center text-gray-400">{(sd.name||'?')[0]}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{sd.name || sd.firstName}</div>
                    <div className="text-xs text-gray-500">{sd.dateOfBirth} · {sd.gender} · {sd.churchName || ''}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${app.hymnChoice==='amen_be_mawteka' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        <Music className="h-3 w-3" />{app.hymnChoice==='amen_be_mawteka' ? 'Amen be mawteka' : 'Be shafaat'}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                {app.voiceRecordingUrl && <div className="mt-3"><AudioPlayer src={assetUrl(app.voiceRecordingUrl)} /></div>}
                <div className="mt-3 text-xs text-gray-600 line-clamp-2">{sd.notes || sd.address || ''} · {sd.parentEmail}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={()=>{ setSelected(app); setEditData(app.studentData)}}><Eye className="h-3.5 w-3.5" />{t('View/Edit','عرض/تعديل')}</Button>
                  {app.status==='pending' && (
                    <>
                      <Button size="sm" onClick={()=>{ setSelected(app); setLevelId(''); setGroupId(''); setGradeId(sd.gradeId||'')}} className="bg-gold-500 hover:bg-gold-600 text-white"><CheckCircle2 className="h-3.5 w-3.5" />{t('Approve','موافقة')}</Button>
                      <Button size="sm" variant="outline" onClick={()=>{ setSelected(app); handleReject()}} className="text-red-600 border-red-200 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" />{t('Reject','رفض')}</Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>}

      {/* Detail / Edit Modal */}
      <Modal open={!!selected} onClose={()=>setSelected(null)} title={selected ? ((selected.studentData||{}).name || 'Application') : ''} size="lg"
        footer={selected?.status==='pending' ? (
          <>
            <Button variant="outline" onClick={()=>setSelected(null)}>{t('Close','إغلاق')}</Button>
            <Button variant="outline" onClick={handleUpdate}><Pencil className="h-4 w-4" />{t('Save Edits','حفظ التعديلات')}</Button>
            <Button onClick={handleApprove} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700 text-white">{approving && <Loader2 className="h-4 w-4 animate-spin" />}{t('Approve & Create Student','موافقة وإنشاء طالب')}</Button>
            <Button variant="outline" onClick={handleReject} disabled={rejecting} className="text-red-600 border-red-200 hover:bg-red-50">{t('Reject','رفض')}</Button>
          </>
        ) : <Button variant="outline" onClick={()=>setSelected(null)}>{t('Close','إغلاق')}</Button>
        }>
        {selected && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
              {Object.entries(selected.studentData||{}).map(([k,v])=>(
                <div key={k} className="flex gap-2"><span className="text-gray-500 w-32 shrink-0">{k}:</span><span className="font-medium text-gray-900 break-all">{String(v||'—')}</span></div>
              ))}
            </div>
            {selected.voiceRecordingUrl && <AudioPlayer src={assetUrl(selected.voiceRecordingUrl)} />}
            {selected.status==='pending' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">{t('Edit before approve — servant can update fields','تعديل قبل الموافقة — يمكن للخادم تحديث الحقول')}</p>
                <FormField label={t('Student Name','اسم الطالب')} value={editData?.name||''} onChange={e=>setEditData({...editData, name:e.target.value})} />
                <FormField label={t('Parent Email','بريد ولي الأمر')} value={editData?.parentEmail||''} onChange={e=>setEditData({...editData, parentEmail:e.target.value})} />
                <FormField label={t('Phone','الهاتف')} value={editData?.phone||''} onChange={e=>setEditData({...editData, phone:e.target.value})} />
                <FormField label={t('Address','العنوان')} value={editData?.address||''} onChange={e=>setEditData({...editData, address:e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <select value={gradeId} onChange={e=>setGradeId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                    <option value="">{t('Select grade (for group)','اختر المرحلة')}</option>
                    {grades.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <select value={levelId} onChange={e=>setLevelId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                    <option value="">{t('Select level','اختر المستوى')}</option>
                    {levels.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
