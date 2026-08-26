export type MasteryLevel = 'not_started' | 'introduced' | 'practicing' | 'known' | 'mastered'

export interface PortalData {
  student: {
    name: string
    nameAr?: string
    studentCode: string
    photoUrl?: string
    level: { number: number; name: string }
    group?: { name?: string; nameAr?: string }
  }
  school: {
    name?: string
    nameAr?: string
    logoUrl?: string
    churchName?: string
    churchNameAr?: string
    churchLogoUrl?: string | null
  } | null
  totalXp: number
  attendance: { present: number; late: number; absent: number; excused: number; total: number }
  badges: Array<{
    id: string
    name?: string
    nameAr?: string
    iconUrl?: string
    earnedAt: string
    awardedBy?: string | null
  }>
  assessments: Array<{
    id: string
    title: string
    titleAr?: string
    type: string
    totalPoints: number
    dueDate?: string
    submissionStatus: string
    subject: { name: string; nameAr?: string }
  }>
  upcomingSessions?: Array<{ id: string; date?: string; topic?: string }>
}

export interface HymnMapItem {
  id: string
  title: string
  titleAr?: string
  titleCoptic?: string
  level: { number: number }
  subject: { name: string; nameAr?: string }
  masteryLevel?: MasteryLevel
}
