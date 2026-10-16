'use client'
import { useState, useCallback, useRef } from 'react'

export function useMarkingState(initial: any[] = []) {
  const [marks, setMarks] = useState<Record<string,string>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))
  const [behavior, setBehaviorState] = useState<Record<string,number>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.behavior ?? 0])))
  const [participation, setParticipationState] = useState<Record<string,number>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.participation ?? 0])))
  const [liturgy, setLiturgyState] = useState<Record<string,boolean>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.attendedLiturgy ?? false])))
  const [notes, setNotesState] = useState<Record<string,string>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.note || ''])))
  const [dirty, setDirty] = useState(false)
  // Statuses as last loaded from the server: lets us send an explicit `unmarked`
  // when a previously-saved mark is undone, without rewriting untouched rows.
  const baseline = useRef<Record<string,string>>(Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))

  const setStatus = useCallback((id:string, s:string) => { setMarks(m => ({...m, [id]: m[id]===s ? 'unmarked' : s})); setDirty(true) }, [])
  const setBehavior = useCallback((id:string, v:number) => { setBehaviorState(b => ({...b, [id]: b[id]===v ? 0 : v})); setDirty(true) }, [])
  const setParticipation = useCallback((id:string, v:number) => { setParticipationState(p => ({...p, [id]: p[id]===v ? 0 : v})); setDirty(true) }, [])
  const setLiturgy = useCallback((id:string, v:boolean) => { setLiturgyState(l => ({...l, [id]: v})); setDirty(true) }, [])
  const setNote = useCallback((id:string, v:string) => { setNotesState(n => ({...n, [id]: v})); setDirty(true) }, [])
  const markAll = useCallback((status:string, ids:string[]) => { setMarks(Object.fromEntries(ids.map(id=>[id,status]))); setDirty(true) }, [])
  const initFromRecords = useCallback((recs:any[]) => {
    baseline.current = Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked']))
    setMarks(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))
    setBehaviorState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.behavior ?? 0])))
    setParticipationState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.participation ?? 0])))
    setLiturgyState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.attendedLiturgy ?? false])))
    setNotesState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.note || ''])))
    setDirty(false)
  }, [])
  // Returns the `records` array only; callers post `{ records, recordedBy }`.
  // A student is included when currently marked, or when they were marked on the
  // server and have since been un-marked (sent as `unmarked` so the undo persists).
  // An emptied note is sent as `null` so the server clears it.
  const buildSavePayload = useCallback((_recordedBy:string) => Object.entries(marks)
    .filter(([id,s]) => (s && s!=='unmarked') || (baseline.current[id] && baseline.current[id]!=='unmarked'))
    .map(([studentId,status]) => ({ studentId, status: status || 'unmarked', behavior: behavior[studentId]||0, participation: participation[studentId]||0, attendedLiturgy: liturgy[studentId]||false, note: notes[studentId] || null })), [marks,behavior,participation,liturgy,notes])

  return { marks, behavior, participation, liturgy, notes, dirty, setDirty, setStatus, setBehavior, setParticipation, setLiturgy, setNote, markAll, initFromRecords, buildSavePayload }
}
