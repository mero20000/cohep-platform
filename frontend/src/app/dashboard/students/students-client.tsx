'use client'
import { useState, useEffect, useCallback, useRef, useMemo, useOptimistic, startTransition } from 'react'
import { Download, Upload, Plus, X, AlertCircle, RefreshCw } from 'lucide-react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/use-language'
import { usePermission } from '@/lib/use-permission'
import { http } from '@/lib/http-client'
import { getSchoolId, fetchActiveGrades, type GradeItem } from '@/lib/school'
import { StudentStats }       from './_components/student-stats'
import { StudentFilters }     from './_components/student-filters'
import { StudentBulkToolbar } from './_components/student-bulk-toolbar'
import { StudentTable }       from './_components/student-table'
import { StudentFormModal }   from './_components/student-form-modal'
import { StudentDetailModal } from './_components/student-detail-modal'
import { StudentDeleteModal } from './_components/student-delete-modal'
import { StudentImportModal } from './_components/student-import-modal'
import { StudentBulkModals }  from './_components/student-bulk-modals'
import { AssignedServants, type Servant } from './_components/assigned-servants'
import { GRADE_OPTIONS, type Student, type LevelWithGroups, type Group, type ChurchItem, type PaginatedResponse, type StudentStats as StatsType } from './_components/student-types'

type BulkModal = 'delete'|'status'|'level'|'grade'

export default function StudentsClient() {
  const { toast } = useToast()
  const lang = useLanguage()
  const { can } = usePermission()
  // Data
  const [students, setStudents]     = useState<Student[]>([])
  const [optimisticStudents, addOptimisticStudent] = useOptimistic(students,
    (state, action: {type:'add';student:Student}|{type:'remove';id:string}) =>
      action.type==='add'?[...state,action.student]:state.filter(s=>s.id!==action.id))
  const [pagination, setPagination] = useState({page:1,limit:20,total:0,totalPages:0})
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState(false)
  // Filters
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChurch, setFilterChurch] = useState('')
  const [filterGrade, setFilterGrade]   = useState('')
  const [filterGender, setFilterGender] = useState('')
  // Sort
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  // Reference data
  const [levels, setLevels]             = useState<LevelWithGroups[]>([])
  const [allGroups, setAllGroups]       = useState<Group[]>([])
  const [churches, setChurches]         = useState<ChurchItem[]>([])
  const [gradeOptions, setGradeOptions] = useState<string[]>(GRADE_OPTIONS)
  const [studentStats, setStudentStats] = useState<StatsType|null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  // Servants
  const [assignedServants, setAssignedServants]     = useState<Servant[]>([])
  const [servantsLoading, setServantsLoading]       = useState(false)
  const [showAssignedServants, setShowAssignedServants] = useState(true)
  // Selection
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const lastClickedRef                  = useRef<string|null>(null)
  const deletingRef                     = useRef<Student|null>(null)
  // Modals
  const [selectedStudent, setSelectedStudent] = useState<Student|null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [bulkOpen, setBulkOpen]   = useState<Record<BulkModal,boolean>>({delete:false,status:false,level:false,grade:false})
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState('')

  // Derived
  const activeLevels     = useMemo(()=>levels.filter(l=>l.status!=='inactive'),[levels])
  const filterGroups     = useMemo(()=>filterLevel?allGroups.filter(g=>g.levelId===filterLevel):allGroups,[filterLevel,allGroups])
  const hasActiveFilters = !!(search||filterLevel||filterGroup||filterStatus||filterChurch||filterGrade||filterGender)
  const allSelected      = optimisticStudents.length>0&&selectedIds.size===optimisticStudents.length
  const levelNameMap     = useMemo(()=>{const m:Record<string,string>={};for(const l of activeLevels){m[l.id]=l.name;for(const g of l.groups)m[g.id]=g.name};return m},[activeLevels])
  const sortedStudents   = useMemo(()=>{
    if(!sortKey)return optimisticStudents
    return [...optimisticStudents].sort((a,b)=>{
      const v=(s:Student):string=>{switch(sortKey){case'name':return`${s.firstName} ${s.lastName}`;case'code':return s.studentCode;case'gender':return s.gender;case'phone':return s.metadata?.phone||'';case'level':return s.level?.name||'';case'group':return s.group?.name||'';case'age':return s.dateOfBirth;case'church':return s.churchName||'';case'grade':return s.schoolGrade||'';case'status':return s.status;default:return''}}
      const[va,vb]=[v(a),v(b)];return sortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va)
    })
  },[optimisticStudents,sortKey,sortDir])

  const fetchStudents = useCallback(async(page=1)=>{
    setLoading(true)
    try{
      const params:Record<string,string>={page:String(page),limit:'20',schoolId:getSchoolId()}
      if(debouncedSearch)params.search=debouncedSearch; if(filterLevel)params.levelId=filterLevel; if(filterGroup)params.groupId=filterGroup
      if(filterStatus)params.status=filterStatus; if(filterChurch)params.churchName=filterChurch; if(filterGrade)params.schoolGrade=filterGrade; if(filterGender)params.gender=filterGender
      const data=await http.get<PaginatedResponse>('/students',params)
      setStudents(data.data); setPagination(data.pagination); setFetchError(false)
    }catch{setFetchError(true)}
    setLoading(false)
  },[debouncedSearch,filterLevel,filterGroup,filterStatus,filterChurch,filterGrade,filterGender])

  useEffect(()=>{const t=setTimeout(()=>setDebouncedSearch(search),300);return ()=>clearTimeout(t)},[search])
  useEffect(()=>{fetchStudents(1)},[fetchStudents])
  useEffect(()=>{setSelectedIds(new Set())},[search,filterLevel,filterGroup,filterStatus,filterChurch,filterGrade,filterGender])
  useEffect(()=>{setFilterGroup('')},[filterLevel])
  useEffect(()=>{
    http.get<LevelWithGroups[]>('/students/groups/all',{schoolId:getSchoolId()}).then(d=>{setLevels(d);setAllGroups(d.flatMap(l=>l.groups.filter(g=>g.status!=='inactive')))}).catch(console.error)
    http.get<ChurchItem[]>('/churches').then(d=>setChurches(d.filter(c=>c.isActive!==false))).catch(console.error)
    http.get<{church?:{name:string}}>('/users/schools/me').then(s=>{if(s.church?.name)setFilterChurch(s.church.name)}).catch(console.error)
    fetchActiveGrades().then((grades:GradeItem[])=>{if(grades.length)setGradeOptions(grades.map(g=>g.name))}).catch(console.error)
    http.get<StatsType>('/students/stats',{schoolId:getSchoolId()}).then(setStudentStats).catch(console.error).finally(()=>setStatsLoading(false))
  },[])
  useEffect(()=>{
    if(!filterLevel||!filterGroup){setAssignedServants([]);return}
    setServantsLoading(true)
    http.get<Servant[]>('/users',{schoolId:getSchoolId(),roleIn:'servant,group_leader,level_leader',groupId:filterGroup,levelId:filterLevel}).then(setAssignedServants).catch(()=>setAssignedServants([])).finally(()=>setServantsLoading(false))
  },[filterLevel,filterGroup])
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setShowForm(false);setShowDetail(false);setShowDelete(false);setShowImport(false);return}
      if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();if(!showForm)openCreate()}
      if((e.ctrlKey||e.metaKey)&&e.key==='e'&&selectedIds.size===1){e.preventDefault();const s=optimisticStudents.find(st=>selectedIds.has(st.id));if(s&&!showForm)openEdit(s)}
    }
    window.addEventListener('keydown',fn); return ()=>window.removeEventListener('keydown',fn)
  },[showForm,selectedIds,optimisticStudents])

  const clearFilters = ()=>{setSearch('');setFilterLevel('');setFilterGroup('');setFilterStatus('');setFilterChurch('');setFilterGrade('');setFilterGender('')}
  const toggleSort   = (k:string)=>{if(sortKey===k)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortKey(k);setSortDir('asc')}}
  const toggleAll    = ()=>setSelectedIds(allSelected?new Set():new Set(optimisticStudents.map(s=>s.id)))
  const toggleId     = (id:string,shiftKey?:boolean)=>{
    if(shiftKey&&lastClickedRef.current&&lastClickedRef.current!==id){
      const idxs=optimisticStudents.map(s=>s.id);const[from,to]=[idxs.indexOf(lastClickedRef.current),idxs.indexOf(id)]
      if(from!==-1&&to!==-1){const[s,e]=from<to?[from,to]:[to,from];const next=new Set(selectedIds);idxs.slice(s,e+1).forEach(r=>next.add(r));setSelectedIds(next);lastClickedRef.current=id;return}
    }
    lastClickedRef.current=id;const next=new Set(selectedIds);if(next.has(id))next.delete(id);else next.add(id);setSelectedIds(next)
  }
  const openCreate = ()=>{setSelectedStudent(null);setShowForm(true)}
  const openEdit   = (s:Student)=>{setSelectedStudent(s);setShowForm(true)}
  const openDetail = (s:Student)=>{setSelectedStudent(s);setShowDetail(true)}
  const openDelete = (s:Student)=>{setSelectedStudent(s);setShowDelete(true)}
  const handleDelete = async()=>{
    if(!selectedStudent)return
    deletingRef.current = selectedStudent
    startTransition(()=>addOptimisticStudent({type:'remove',id:selectedStudent.id})); setShowDelete(false)
    try{await http.delete(`/students/${selectedStudent.id}`,{schoolId:getSchoolId()});fetchStudents(pagination.page);toast('success',lang==='ar'?'تم حذف الطالب':'Student deleted')}
    catch{toast('error',lang==='ar'?'فشل الحذف':'Delete failed');fetchStudents(pagination.page)}
    finally{deletingRef.current = null}
  }
  const handleExport = async()=>{
    try{
      const params:Record<string,string>={limit:String(pagination.total||2000),schoolId:getSchoolId()}
      if(search)params.search=search;if(filterLevel)params.levelId=filterLevel;if(filterGroup)params.groupId=filterGroup;if(filterStatus)params.status=filterStatus;if(filterChurch)params.churchName=filterChurch;if(filterGrade)params.schoolGrade=filterGrade;if(filterGender)params.gender=filterGender
      const data=await http.get<PaginatedResponse>('/students',params)
      const rows=[['Student Code','Name','First Name (Ar)','Last Name (Ar)','Date of Birth','Gender','Level','Group','Church','Grade','Phone','Email','Church Tool ID','Status','Enrollment Date'],...data.data.map(s=>[s.studentCode,`${s.firstName} ${s.lastName}`.trim(),s.firstNameAr||'',s.lastNameAr||'',s.dateOfBirth.split('T')[0],s.gender,s.level?.name||'',s.group?.name||'',s.churchName||'',s.schoolGrade||'',s.metadata?.phone||'',s.metadata?.email||'',s.metadata?.churchToolId||'',s.status,s.enrollmentDate.split('T')[0]])]
      const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob)
      const a=document.createElement('a'); a.href=url; a.download=`${lang==='ar'?`طلاب-نيانجلوس`:`niangelos-students`}${hasActiveFilters?`-${lang==='ar'?'مصفى':'filtered'}`:''}-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    }catch(err){console.error('Export failed',err)}
  }
  const t=(en:string,ar:string)=>lang==='ar'?ar:en

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Students','الطلاب')}</h1>
          <p className="text-sm text-gray-500">{pagination.total} {t('students enrolled','طالب مسجل')}</p>
        </div>
        <div className="flex items-center gap-3">
          {can('student:export')&&<Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4"/>{t('Export','تصدير')}</Button>}
          {can('student:import')&&<Button variant="outline" size="sm" onClick={()=>setShowImport(true)}><Upload className="h-4 w-4"/>{t('Import','استيراد')}</Button>}
          {can('student:create')&&<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4"/>{t('Add Student','إضافة طالب')}</Button>}
        </div>
      </div>

      <StudentStats stats={studentStats} loading={statsLoading} lang={lang} onGradeClick={g=>setFilterGrade(g)} onStatusClick={s=>setFilterStatus(s)}/>

      <StudentFilters
        search={search} onSearchChange={setSearch} isSearching={search !== debouncedSearch}
        filterLevel={filterLevel} onLevelChange={setFilterLevel} filterGroup={filterGroup} onGroupChange={setFilterGroup}
        filterStatus={filterStatus} onStatusChange={setFilterStatus} filterChurch={filterChurch} onChurchChange={setFilterChurch}
        filterGrade={filterGrade} onGradeChange={setFilterGrade} filterGender={filterGender} onGenderChange={setFilterGender}
        activeLevels={activeLevels} filterGroups={filterGroups} gradeOptions={gradeOptions} churches={churches}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} lang={lang}/>

      {selectedIds.size>0&&<StudentBulkToolbar
        selectedCount={selectedIds.size}
        onDelete={()=>setBulkOpen(b=>({...b,delete:true}))} onChangeStatus={()=>setBulkOpen(b=>({...b,status:true}))}
        onChangeLevel={()=>setBulkOpen(b=>({...b,level:true}))} onChangeGrade={()=>setBulkOpen(b=>({...b,grade:true}))}
        onClear={()=>setSelectedIds(new Set())} lang={lang}/>}

      <ErrorBoundary fallback={<div role="alert" className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center"><AlertCircle className="h-10 w-10 text-red-300 mb-3"/><p className="text-sm font-medium text-red-700">{t('Something went wrong','حدث خطأ ما')}</p><Button variant="ghost" size="sm" onClick={()=>fetchStudents(pagination.page)} className="mt-3"><RefreshCw className="h-3.5 w-3.5"/> {t('Retry','إعادة المحاولة')}</Button></div>}>
      <StudentTable
        students={sortedStudents} loading={loading} fetchError={fetchError}
        selectedIds={selectedIds} allSelected={allSelected} toggleId={toggleId} toggleAll={toggleAll}
        sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort}
        onView={openDetail} onEdit={openEdit} onDelete={openDelete} onRetry={()=>fetchStudents(1)}
        hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} onOpenCreate={openCreate}
        pagination={pagination} onPageChange={p=>{fetchStudents(p)}}
        onPreviewPhoto={setPreviewPhotoUrl} lang={lang}/>
      </ErrorBoundary>

      {filterLevel&&filterGroup&&<AssignedServants servants={assignedServants} loading={servantsLoading} show={showAssignedServants} onToggle={()=>setShowAssignedServants(v=>!v)} lang={lang}/>}

      {showForm&&<StudentFormModal student={selectedStudent} activeLevels={activeLevels} allGroups={allGroups} churches={churches} gradeOptions={gradeOptions}
        onClose={()=>setShowForm(false)} onSuccess={fetchStudents} currentPage={pagination.page}
        onOptimisticAdd={s=>startTransition(()=>addOptimisticStudent({type:'add',student:s}))} lang={lang}/>}

      {showDetail&&selectedStudent&&<StudentDetailModal student={selectedStudent} onClose={()=>setShowDetail(false)} onEdit={()=>{setShowDetail(false);openEdit(selectedStudent)}} onPreviewPhoto={setPreviewPhotoUrl} lang={lang}/>}

      {showDelete&&selectedStudent&&<StudentDeleteModal student={selectedStudent} onClose={()=>setShowDelete(false)} onConfirm={handleDelete} lang={lang}/>}

      {showImport&&<StudentImportModal onClose={()=>setShowImport(false)} onSuccess={()=>fetchStudents(1)} levelNameMap={levelNameMap} lang={lang}/>}

      <StudentBulkModals
        showBulkDelete={bulkOpen.delete} showBulkStatus={bulkOpen.status} showBulkLevel={bulkOpen.level} showBulkGrade={bulkOpen.grade}
        onClose={modal=>setBulkOpen(b=>({...b,[modal]:false}))}
        selectedIds={selectedIds} activeLevels={activeLevels} allGroups={allGroups} gradeOptions={gradeOptions}
        onSuccess={page=>{setSelectedIds(new Set());fetchStudents(page)}} currentPage={pagination.page}
        toast={toast} lang={lang}/>

      {previewPhotoUrl&&(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={()=>setPreviewPhotoUrl('')}>
          <div className="relative max-w-lg max-h-[80vh]" onClick={e=>e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewPhotoUrl} alt={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Student photo'} className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl object-contain"/>
            <Button variant="ghost" size="icon" onClick={()=>setPreviewPhotoUrl('')} className="absolute -top-3 -right-3 rounded-full bg-white p-1.5 shadow-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-600"/></Button>
          </div>
        </div>
      )}
    </div>
  )
}
