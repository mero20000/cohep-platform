import { describe, it, expect } from 'vitest'
import { audienceSummary, isFinalStatus, isFutureDay, sessionTitle, sessionType, typeLabel } from '../session-types'
import { audienceFromSession, buildAudiencePayload, EMPTY_AUDIENCE } from '../audience'

describe('session types', () => {
  it('defaults to class and names the three types in both languages', () => {
    expect(sessionType({})).toBe('class')
    expect(sessionType({ type: 'party' })).toBe('class')
    expect(sessionType({ type: 'event' })).toBe('event')
    expect(typeLabel('liturgy', 'en')).toBe('Liturgy')
    expect(typeLabel('event', 'ar')).toBe('فعالية')
  })

  it('treats the legacy "recorded" status as finished', () => {
    expect(isFinalStatus('completed')).toBe(true)
    expect(isFinalStatus('recorded')).toBe(true)
    expect(isFinalStatus('in_progress')).toBe(false)
  })

  it('knows when a session is scheduled for a later day', () => {
    const now = new Date('2026-10-17T10:00:00')
    expect(isFutureDay('2026-10-17T00:00:00', now)).toBe(false)
    expect(isFutureDay('2026-10-17T23:00:00', now)).toBe(false)
    expect(isFutureDay('2026-10-18T00:00:00', now)).toBe(true)
    expect(isFutureDay(undefined, now)).toBe(false)
  })

  it('summarises the audience', () => {
    expect(audienceSummary({ allGroups: true }, 'en')).toBe('All groups')
    expect(audienceSummary({ targets: [{ groupId: '1', group: { name: 'A' } }, { groupId: '2', group: { name: 'B' } }] }, 'en')).toBe('A, B')
    expect(audienceSummary({ targets: ['A', 'B', 'C', 'D'].map((n, i) => ({ groupId: String(i), group: { name: n } })) }, 'en')).toBe('4 groups')
    expect(audienceSummary({ group: { name: 'Solo' } }, 'en')).toBe('Solo')
  })

  it('titles each type sensibly', () => {
    expect(sessionTitle({ group: { name: 'G1' }, level: { name: 'x', number: 2 }, grade: { name: 'Gr' } }, 'en')).toBe('G1 · L2 · Gr')
    expect(sessionTitle({ type: 'event', title: 'Picnic', titleAr: 'رحلة' }, 'en')).toBe('Picnic')
    expect(sessionTitle({ type: 'event', title: 'Picnic', titleAr: 'رحلة' }, 'ar')).toBe('رحلة')
    expect(sessionTitle({ type: 'liturgy', allGroups: true }, 'en')).toBe('Liturgy · All groups')
  })
})

describe('audience payload', () => {
  it('"all groups" sends no group list', () => {
    expect(buildAudiencePayload({ ...EMPTY_AUDIENCE, allGroups: true, groupIds: ['x'] })).toEqual({ allGroups: true, targets: undefined })
  })

  it('level and gender narrow every group; grade only applies to a single group', () => {
    const many = buildAudiencePayload({ ...EMPTY_AUDIENCE, groupIds: ['a', 'b'], levelId: 'L', gradeId: 'G', gender: 'female' })
    expect(many.targets).toEqual([{ groupId: 'a', levelId: 'L', gender: 'female' }, { groupId: 'b', levelId: 'L', gender: 'female' }])
    const one = buildAudiencePayload({ ...EMPTY_AUDIENCE, groupIds: ['a'], gradeId: 'G' })
    expect(one.targets).toEqual([{ groupId: 'a', gradeId: 'G' }])
  })

  it('rebuilds the dialog state from a session returned by the API', () => {
    expect(audienceFromSession({ allGroups: true })).toMatchObject({ allGroups: true, groupIds: [] })
    expect(audienceFromSession({ targets: [{ groupId: 'a', levelId: 'L', gender: 'male' }, { groupId: 'b', levelId: 'L', gender: 'male' }] }))
      .toMatchObject({ allGroups: false, groupIds: ['a', 'b'], levelId: 'L', gender: 'male', gradeId: '' })
    expect(audienceFromSession({ group: { id: 'g' }, level: { id: 'l' }, grade: { id: 'gr' } })).toMatchObject({ groupIds: ['g'], levelId: 'l', gradeId: 'gr' })
  })
})
