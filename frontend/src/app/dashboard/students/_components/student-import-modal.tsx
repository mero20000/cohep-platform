'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'

interface Props { onClose: () => void; onSuccess: () => void; levelNameMap: Record<string,string>; lang: 'en'|'ar' }
type RowStatus = 'valid' | 'warning' | 'error'
interface RowValidation { status: RowStatus; issues: string[] }

const GENDERS = ['male', 'female']

export function StudentImportModal({ onClose, onSuccess, levelNameMap, lang }: Props) {
  const { toast } = useToast()
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState<Record<string,string>[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{imported:number}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const [duplicateWarnings, setDuplicateWarnings] = useState<{name:string;reason:string}[]>([])
  const [rowValidations, setRowValidations] = useState<RowValidation[]>([])
  const [skipInvalid, setSkipInvalid] = useState(true)
  const csvFields = (line:string) => {
    const result:string[]=[]; let cur='', inQ=false
    for(let i=0;i<line.length;i++){
      const ch=line[i]
      if(inQ){if(ch==='"'){if(line[i+1]==='"'){cur+='"';i++}else inQ=false}else cur+=ch}
      else{if(ch==='"')inQ=true;else if(ch===','){result.push(cur);cur=''}else cur+=ch}
    }
    result.push(cur)
    return result
  }
  const sanitize = (v:string) => v.replace(/<[^>]*>/g,'').replace(/\0/g,'').trim()

  const parse = (text: string) => {
    // Strip UTF-8 BOM so the header row is matched cleanly
    const clean = text.replace(/^\uFEFF/,'')
    const lines = clean.split('\n').filter(l=>l.trim())
    if (lines.length<2){setError(t('CSV must have a header row and at least one data row','يجب أن يحتوي CSV على صف رأس وصف بيانات'));return}
    const headers = csvFields(lines[0]).map(h=>h.trim().toLowerCase().replace(/^"+|"+$/g,''))
    if (!headers.includes('name')&&!(headers.includes('firstname')&&headers.includes('lastname'))){setError(t('CSV must have a "name" or "firstName"+"lastName" columns','CSV يحتاج عمود name أو firstName+lastName'));return}
    const missing = ['dateofbirth','gender','levelid'].filter(r=>!headers.includes(r))
    if (missing.length){setError(`${t('Missing columns:','أعمدة مفقودة:')} ${missing.join(', ')}`);return}
    const rows:Record<string,string>[]=[]; const skipped:string[]=[]
    lines.slice(1).forEach(line=>{
      const vals=csvFields(line).map(v=>sanitize(v.replace(/^"+|"+$/g,'')))
      const row:Record<string,string>={}
      headers.forEach((h,i)=>{row[h]=vals[i]||''})
      if(row.name&&!row.firstname){const p=row.name.trim().split(/\s+/);row.firstname=p[0]||'';row.lastname=p.slice(1).join(' ')||''}
      // M8: surface rows without a full name instead of silently dropping them
      if(!row.firstname||!row.lastname){skipped.push(row.name||row.firstname||row.lastname||`#${lines.slice(1).indexOf(line)+2}`);return}
      rows.push(row)
    })
    if(skipped.length)setError(`${t('Rows skipped (missing name):','صفوف تم تخطيها (اسم غير مكتمل):')} ${skipped.length}`)
    else if(rows.length)setError('')
    const dups:{name:string;reason:string}[]=[]
    const dupRowIdx=new Set<number>()
    const seen=new Map<string,number[]>()
    rows.forEach((r,i)=>{
      const key=`${r.firstname}|${r.lastname}`.toLowerCase()
      if(seen.has(key)){dups.push({name:`${r.firstname} ${r.lastname}`,reason:t('Same name','اسم مكرر')});dupRowIdx.add(i)}
      else seen.set(key,[i])
      if(r.email&&[...seen.entries()].some(([k])=>k===`email:${r.email}`)){dups.push({name:r.email,reason:t('Same email','بريد مكرر')});dupRowIdx.add(i)}
      else if(r.email)seen.set(`email:${r.email}`,[i])
      if(r.phone&&[...seen.entries()].some(([k])=>k===`phone:${r.phone}`)){dups.push({name:r.phone,reason:t('Same phone','هاتف مكرر')});dupRowIdx.add(i)}
      else if(r.phone)seen.set(`phone:${r.phone}`,[i])
    })

    // Row-by-row validation
    const validations:RowValidation[]=rows.map((r,i)=>{
      const issues:string[]=[]
      let status:RowStatus='valid'
      const dob=r.dateofbirth?new Date(r.dateofbirth):null
      if(!r.dateofbirth||!dob||isNaN(dob.getTime())){issues.push(t('Invalid date of birth','تاريخ ميلاد غير صالح'));status='error'}
      else if(dob.getTime()>Date.now()){issues.push(t('Date of birth is in the future','تاريخ الميلاد في المستقبل'));status='error'}
      if(!r.gender||!GENDERS.includes(r.gender.toLowerCase())){issues.push(t('Gender must be male or female','الجنس يجب أن يكون ذكر أو أنثى'));status='error'}
      if(!r.levelid){issues.push(t('Missing level','المستوى مفقود'));status='error'}
      else if(!levelNameMap[r.levelid]){issues.push(t('Unrecognized level ID','معرف مستوى غير معروف'));if(status!=='error')status='warning'}
      if(r.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)){issues.push(t('Invalid email format','صيغة بريد إلكتروني غير صالحة'));if(status!=='error')status='warning'}
      if(dupRowIdx.has(i)){issues.push(t('Duplicate row','صف مكرر'));if(status!=='error')status='warning'}
      return {status,issues}
    })

    setPreview(rows);setDuplicateWarnings(dups);setRowValidations(validations)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f=e.target.files?.[0]; if(!f)return
    setFile(f);setResult(null);setError('')
    const reader=new FileReader(); reader.onload=ev=>parse(ev.target?.result as string); reader.readAsText(f)
  }

  const handleImport = async () => {
    if(!preview.length)return; setImporting(true)
    try {
      const rowsToImport = skipInvalid ? preview.filter((_,i)=>rowValidations[i]?.status!=='error') : preview
      const students=rowsToImport.map(r=>({firstName:r.firstname,lastName:r.lastname,firstNameAr:r.firstnamear||undefined,lastNameAr:r.lastnamear||undefined,dateOfBirth:r.dateofbirth,gender:r.gender,levelId:r.levelid,grade:r.grade||undefined,churchName:r.churchname||undefined,phone:r.phone||undefined,email:r.email||undefined,address:r.address||undefined,notes:r.notes||undefined,churchToolId:r.churchtoolid||undefined}))
      const res:{imported:number}=await http.post('/students/bulk',{students},{schoolId:getSchoolId()})
      setResult({imported:res.imported}); setPreview([]); setFile(null); onSuccess()
      toast('success',t('Import complete','تم الاستيراد'),`${res.imported} ${t('students imported','طالب تم استيرادهم')}`)
    } catch(err:unknown){const msg=err instanceof Error?err.message:t('Connection error','خطأ في الاتصال');setError(msg);toast('error',t('Import failed','فشل الاستيراد'),msg)}
    setImporting(false)
  }

  const handleClose = () => { onClose(); setPreview([]); setFile(null); setResult(null); setError(''); setDuplicateWarnings([]); setRowValidations([]) }
  useEffect(() => { dialogRef.current?.focus() }, [])
  const downloadTemplate = () => {
    const h=['name','dateOfBirth','gender','levelId','grade','firstNameAr','lastNameAr','churchName','phone','email','address','notes','churchToolId']
    const s=['Malak Ahmed','2017-05-15','male','Level 1','Grade 4','ملك','أحمد','St. Mary Church','+201234567890','parent@example.com','123 Main St','Notes','CHR-12345']
    const csv='\uFEFF'+[h.join(','),s.join(',')].join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}))
    const a=document.createElement('a'); a.href=url; a.download='student-import-template.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Import Students from CSV','استيراد الطلاب من ملف CSV')} className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col outline-none">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">{t('Import Students from CSV','استيراد الطلاب من ملف CSV')}</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {result?(<div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center"><CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" /><p className="mt-2 text-sm font-medium text-green-800">{result.imported} {t('students imported successfully','طالب تم استيرادهم بنجاح')}</p><Button onClick={handleClose} className="mt-3">{t('Done','تم')}</Button></div>):(<>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-medium text-blue-800 mb-1">{t('Required CSV columns:','الأعمدة المطلوبة:')}</p>
              <code className="text-xs text-blue-700">name, dateOfBirth, gender, levelId, grade</code>
              <p className="mt-1 text-xs text-blue-600">{t('Group is auto-derived from grade.','يتم اشتقاق المجموعة تلقائياً من المرحلة.')}</p>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="inline-flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{t('Download Template','تحميل القالب')}</Button>
            {error&&<div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2"><AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0"/>{error}</div>}
            <div className="flex items-center gap-4">
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden"/>
              <Button variant="outline" onClick={()=>fileRef.current?.click()} className="inline-flex items-center gap-2 border-2 border-dashed border-gray-300 px-6 py-4 text-sm font-medium text-gray-600 hover:border-gold-400 hover:bg-blue-50 transition-colors"><FileSpreadsheet className="h-5 w-5"/>{file?file.name:t('Choose CSV file','اختيار ملف CSV')}</Button>
              {file&&<Button variant="ghost" size="sm" onClick={()=>{setFile(null);setPreview([]);setError('');setDuplicateWarnings([]);setRowValidations([])}} className="text-gray-500 hover:text-red-600">{t('Clear','مسح')}</Button>}
            </div>
            {preview.length>0&&(<div>
              {(()=>{
                const validCount=rowValidations.filter(v=>v.status==='valid').length
                const warningCount=rowValidations.filter(v=>v.status==='warning').length
                const errorCount=rowValidations.filter(v=>v.status==='error').length
                return (
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3.5 w-3.5"/>{validCount} {t('valid','صحيح')}</span>
                    {warningCount>0&&<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5"/>{warningCount} {t('warnings','تحذيرات')}</span>}
                    {errorCount>0&&<span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"><XCircle className="h-3.5 w-3.5"/>{errorCount} {t('errors','أخطاء')}</span>}
                    {errorCount>0&&(
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 ms-auto cursor-pointer">
                        <input type="checkbox" checked={skipInvalid} onChange={e=>setSkipInvalid(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 accent-gold-600"/>
                        {t('Skip rows with errors','تخطي الصفوف التي بها أخطاء')}
                      </label>
                    )}
                  </div>
                )
              })()}
              <p className="text-sm font-medium text-gray-700 mb-2">{t(`Preview (${preview.length} rows):`,`معاينة (${preview.length} صف):`)}</p>
              <div className="max-h-72 overflow-auto table-to-cards rounded-lg border border-gray-200"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b border-gray-200">{[t('Status','الحالة'),t('First','الاسم الأول'),t('Last','الأخير'),t('DOB','تاريخ الميلاد'),t('Gender','الجنس'),t('Level','المستوى'),t('Grade','المرحلة')].map(h=><th key={h} className="px-3 py-2 text-start font-medium text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">{preview.map((r,i)=>{
                const v=rowValidations[i]
                const rowBg=v?.status==='error'?'bg-red-50/50':v?.status==='warning'?'bg-amber-50/40':''
                const statusIcon=v?.status==='error'?<XCircle className="h-4 w-4 text-red-500"/>:v?.status==='warning'?<AlertTriangle className="h-4 w-4 text-amber-500"/>:<CheckCircle2 className="h-4 w-4 text-green-500"/>
                return <tr key={i} className={`hover:bg-gray-50 ${rowBg}`} title={v?.issues.join(', ')}>
                  <td data-label={t('Status','الحالة')} className="px-3 py-1.5">{statusIcon}</td>
                  <td data-label={t('First','الاسم الأول')} className="px-3 py-1.5 text-gray-900">{r.firstname}</td>
                  <td data-label={t('Last','الأخير')} className="px-3 py-1.5 text-gray-900">{r.lastname}</td>
                  <td data-label={t('DOB','تاريخ الميلاد')} className="px-3 py-1.5 text-gray-600">{r.dateofbirth}</td>
                  <td data-label={t('Gender','الجنس')} className="px-3 py-1.5 text-gray-600">{r.gender}</td>
                  <td data-label={t('Level','المستوى')} className="px-3 py-1.5 text-gray-900">{levelNameMap[r.levelid]||<span className="text-gray-400 font-mono">{r.levelid?.slice(0,8)}…</span>}</td>
                  <td data-label={t('Grade','المرحلة')} className="px-3 py-1.5 text-gray-900">{r.grade||<span className="text-gray-400">—</span>}</td>
                </tr>
              })}</tbody>
              </table></div>
              {rowValidations.some(v=>v.issues.length>0)&&(
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-600 mb-1.5">{t('Row issues:','مشاكل الصفوف:')}</p>
                  {preview.map((r,i)=>{
                    const v=rowValidations[i]
                    if(!v||v.issues.length===0)return null
                    return <p key={i} className={`text-xs mt-1 ${v.status==='error'?'text-red-700':'text-amber-700'}`}>&bull; {t(`Row ${i+2}`,`صف ${i+2}`)} ({r.firstname} {r.lastname}): {v.issues.join(', ')}</p>
                  })}
                </div>
              )}
            </div>)}
          </>)}
        </div>
        {preview.length>0&&!result&&(<div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <Button variant="outline" onClick={()=>{setPreview([]);setFile(null);setDuplicateWarnings([]);setRowValidations([])}}>{t('Cancel','إلغاء')}</Button>
          <Button onClick={handleImport} disabled={importing||(skipInvalid&&rowValidations.every(v=>v.status==='error'))} className="inline-flex items-center gap-2">
            {importing&&<Loader2 className="h-4 w-4 animate-spin"/>}{(()=>{
              const count = skipInvalid ? preview.filter((_,i)=>rowValidations[i]?.status!=='error').length : preview.length
              return t(`Import ${count} Students`,`استيراد ${count} طالب`)
            })()}
          </Button>
        </div>)}
      </div>
    </div>
  )
}
