'use client'
import { Loader2, Shield, ChevronDown } from 'lucide-react'
import { photoSrc } from './student-types'

export interface Servant { id: string; firstName: string; lastName: string; avatarUrl?: string; userRoles?: {role:{name:string;displayName:string}}[]; metadata?: {teachingSubjects?:string[]} }
interface Props { servants: Servant[]; loading: boolean; show: boolean; onToggle: () => void; lang: 'en'|'ar' }

const SUBJ: Record<string,{en:string;ar:string}> = { coptic_hymns:{en:'Hymns',ar:'تسابيح'}, coptic_rites:{en:'Rites',ar:'طقوس'}, coptic_language:{en:'Language',ar:'لغة'} }

export function AssignedServants({ servants, loading, show, onToggle, lang }: Props) {
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button onClick={onToggle} className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">
        <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-gold-500"/>{t('Assigned Servants','الخدم المعينون')}<span className="text-xs text-gray-400 font-normal">({servants.length})</span>{loading&&<Loader2 className="h-3 w-3 animate-spin text-gray-400"/>}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${show?'':'-rotate-90'}`}/>
      </button>
      {show&&(<div className="px-4 pb-3">
        {loading?<div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400"/></div>
        :servants.length===0?<p className="text-xs text-gray-400 py-2">{t('No servants assigned to this level/group','لا يوجد خدم معينون لهذا المستوى/المجموعة')}</p>
        :<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {servants.map(s=>{
            const role=s.userRoles?.find(ur=>['servant','group_leader','level_leader'].includes(ur.role.name))
            const subjects=s.metadata?.teachingSubjects??[]
            const roleBg=role?.role?.name==='level_leader'?'bg-purple-50 text-purple-700 border-purple-200':role?.role?.name==='group_leader'?'bg-amber-50 text-amber-700 border-amber-200':'bg-blue-50 text-blue-700 border-blue-200'
            return <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 overflow-hidden flex-shrink-0">
                {s.avatarUrl?<img src={photoSrc(s.avatarUrl)} alt="" className="h-8 w-8 object-cover"/>:<span className="text-xs font-bold text-blue-700">{s.firstName?.[0]}{s.lastName?.[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${roleBg}`}>{role?.role?.displayName||t('Servant','خادم')}</span>
                  {subjects.slice(0,2).map((sub:string)=><span key={sub} className="text-[11px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">{SUBJ[sub]?(lang==='ar'?SUBJ[sub].ar:SUBJ[sub].en):sub}</span>)}
                </div>
              </div>
            </div>
          })}
        </div>}
      </div>)}
    </div>
  )
}
