'use client'
import { useState, useCallback } from 'react'

export function useMarkingState(initial: any[] = []) {
  const [marks, setMarks] = useState<Record<string,string>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))
  const [behavior, setBehaviorState] = useState<Record<string,number>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.behavior ?? 0])))
  const [participation, setParticipationState] = useState<Record<string,number>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.participation ?? 0])))
  const [liturgy, setLiturgyState] = useState<Record<string,boolean>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.attendedLiturgy ?? false])))
  const [notes, setNotesState] = useState<Record<string,string>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.note || ''])))
  const [dirty, setDirty] = useState(false)

  const setStatus = useCallback((id:string, s:string) => { setMarks(m => ({...m, [id]: m[id]===s ? 'unmarked' : s})); setDirty(true) }, [])
  const setBehavior = useCallback((id:string, v:number) => { setBehaviorState(b => ({...b, [id]: b[id]===v ? 0 : v})); setDirty(true) }, [])
  const setParticipation = useCallback((id:string, v:number) => { setParticipationState(p => ({...p, [id]: p[id]===v ? 0 : v})); setDirty(true) }, [])
  const setLiturgy = useCallback((id:string, v:boolean) => { setLiturgyState(l => ({...l, [id]: v})); setDirty(true) }, [])
  const setNote = useCallback((id:string, v:string) => { setNotesState(n => ({...n, [id]: v})); setDirty(true) }, [])
  const markAll = useCallback((status:string, ids:string[]) => { setMarks(Object.fromEntries(ids.map(id=>[id,status]))); setDirty(true) }, [])
  const initFromRecords = useCallback((recs:any[]) => {
    setMarks(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))
    setBehaviorState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.behavior ?? 0])))
    setParticipationState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.participation ?? 0])))
    setLiturgyState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.attendedLiturgy ?? false])))
    setNotesState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.note || ''])))
    setDirty(false)
  }, [])
  // NOTE: returns the `records` array only. Callers post `{ records, recordedBy }`
  // to match the existing `/attendance/sessions/:id/mark` API shape (recordedBy is
  // top-level, not per-record). The `recordedBy` param is kept so Tasks 2-3 can call
  // `buildSavePayload(userId)` per the shared interface.
  const buildSavePayload = useCallback((_recordedBy:string) => Object.entries(marks).filter(([,s])=>s && s!=='unmarked').map(([studentId,status])=>({ studentId, status, behavior: behavior[studentId]||0, participation: participation[studentId]||0, attendedLiturgy: liturgy[studentId]||false, note: notes[studentId]||undefined })), [marks,behavior,participation,liturgy,notes])

  return { marks, behavior, participation, liturgy, notes, dirty, setDirty, setStatus, setBehavior, setParticipation, setLiturgy, setNote, markAll, initFromRecords, buildSavePayload }
}
