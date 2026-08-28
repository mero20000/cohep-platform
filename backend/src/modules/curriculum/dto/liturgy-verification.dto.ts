import { IsString, IsOptional, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class VerificationPendingDto {
  id: string
  studentId: string
  studentName: string
  lessonId: string
  lessonTitle: string
  masteryStatus: string
  selfRating?: number
  servantFeedback?: string
  servantFeedbackAt?: string
  servantName?: string
  recordingUrl?: string
  recordingDuration?: number
  lastPracticedAt?: string
}

export class PendingVerificationsListDto {
  verifications: VerificationPendingDto[]
  total: number
  pending: number
}

export class MarkReadyForLiturgyDto {
  @ApiPropertyOptional({ example: 'Excellent clarity and pacing during this past weeks rehearsals.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string
}

export class VerificationResponseDto {
  id: string
  studentId: string
  studentName: string
  lessonId: string
  isReadyForLiturgy: boolean
  readyForLiturgyAt: string
  clergyId: string
  clergyNotes?: string
  success: boolean
}

export class StudentReadinessDto {
  studentId: string
  studentName: string
  lessons: {
    lessonId: string
    lessonTitle: string
    masteryStatus: string
    isReadyForLiturgy: boolean
    readyForLiturgyAt?: string
  }[]
  overallReadyCount: number
  totalLessonsForSunday: number
}
