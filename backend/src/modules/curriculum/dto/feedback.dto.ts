import { IsString, IsOptional, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class SubmissionDto {
  id: string
  studentId: string
  studentName: string
  lessonId: string
  lessonTitle: string
  recordingUrl?: string
  recordingDuration?: number
  submittedAt: string
  selfRating?: number
  masteryStatus: string
  servantFeedback?: string
  servantFeedbackAt?: string
  servantName?: string
}

export class SubmissionsListDto {
  submissions: SubmissionDto[]
  total: number
  awaitingFeedback: number
}

export class AddFeedbackDto {
  @ApiPropertyOptional({ example: 'Great clarity! One more time on the ending.' })
  @IsString()
  @MaxLength(200)
  feedbackText: string
}

export class FeedbackResponseDto {
  id: string
  submissionId: string
  feedbackText: string
  feedbackAt: string
  servantId: string
  servantName: string
  success: boolean
}
