import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { HymnLearningService } from './hymn-learning.service'

@ApiTags('hymn-learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hymn-learning')
export class HymnLearningController {
  constructor(private readonly svc: HymnLearningService) {}

  @Post('practice')
  @ApiOperation({ summary: 'Log a practice session for a hymn (runs SM-2)' })
  async logPractice(@Req() req: any, @Body() body: {
    lessonId: string
    selfRating?: number
    recordingUrl?: string
    durationSec?: number
    studentId?: string
  }) {
    const studentId = body.studentId ?? req.user.id
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.logPracticeSession({ ...body, studentId, schoolId }, req.user)
  }

  @Get('map')
  @ApiOperation({ summary: 'Get hymn progress map for a student' })
  async getMap(@Req() req: any, @Query('studentId') studentId?: string) {
    const sid = studentId ?? req.user.id
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getStudentHymnMap(sid, schoolId)
  }

  @Get('due-review')
  @ApiOperation({ summary: 'Get hymns due for spaced repetition review today' })
  async getDueReview(@Req() req: any, @Query('studentId') studentId?: string) {
    const sid = studentId ?? req.user.id
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getDueForReview(sid, schoolId)
  }

  @Get('this-sunday')
  @ApiOperation({ summary: 'Get hymns for the upcoming Sunday based on Coptic calendar' })
  async getThisSunday(@Req() req: any, @Query('date') date?: string) {
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getThisSundayHymns(schoolId, date)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall learning stats for a student' })
  async getStats(@Req() req: any, @Query('studentId') studentId?: string) {
    const sid = studentId ?? req.user.id
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getStudentStats(sid, schoolId)
  }

  @Get('history/:lessonId')
  @ApiOperation({ summary: 'Get practice history for a hymn' })
  async getHistory(@Req() req: any, @Param('lessonId') lessonId: string, @Query('studentId') studentId?: string) {
    const sid = studentId ?? req.user.id
    return this.svc.getHymnHistory(sid, lessonId)
  }

  @Get('review-queue')
  @ApiOperation({ summary: 'Servant: get unreviewed student recordings' })
  async getReviewQueue(@Req() req: any) {
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getServantReviewQueue(schoolId)
  }

  @Patch('sessions/:id/review')
  @ApiOperation({ summary: 'Servant: submit review for a practice session' })
  async reviewSession(@Req() req: any, @Param('id') id: string,
    @Body() body: { servantRating: number; servantNote?: string }) {
    return this.svc.reviewSession(id, req.user.id, body, req.user)
  }

  @Get('lessons/:lessonId/submissions')
  @ApiOperation({ summary: 'Servant: get submissions for a lesson (group-scoped)' })
  async getSubmissions(@Req() req: any, @Param('lessonId') lessonId: string) {
    const groupId = (req.user.metadata ?? {}).groupId
    if (!groupId) throw new Error('Servant group context missing')
    return this.svc.getSubmissionsForServant(lessonId, groupId, req.user)
  }

  @Post('lessons/:lessonId/submissions/:submissionId/feedback')
  @ApiOperation({ summary: 'Servant: add feedback to a lesson progress' })
  async addFeedback(@Req() req: any, @Param('lessonId') lessonId: string, @Param('submissionId') submissionId: string,
    @Body() body: { feedbackText: string }) {
    const groupId = (req.user.metadata ?? {}).groupId
    if (!groupId) throw new Error('Servant group context missing')
    return this.svc.addFeedback(submissionId, body.feedbackText, req.user.id, req.user)
  }

  @Get('liturgy/pending-verifications')
  @ApiOperation({ summary: 'Clergy: get pending verifications for upcoming Sunday' })
  async getPendingVerifications(@Req() req: any) {
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getPendingVerificationsForClergy(schoolId, req.user)
  }

  @Post('liturgy/verify/:progressId')
  @ApiOperation({ summary: 'Clergy: mark a student ready for liturgy' })
  async markReadyForLiturgy(@Req() req: any, @Param('progressId') progressId: string,
    @Body() body: { notes?: string }) {
    return this.svc.markReadyForLiturgy(progressId, body.notes, req.user.id, req.user)
  }

  @Get('liturgy/student-readiness/:studentId')
  @ApiOperation({ summary: 'Clergy: get student liturgy readiness summary for upcoming Sunday' })
  async getStudentReadiness(@Req() req: any, @Param('studentId') studentId: string) {
    const schoolId = req.user.schoolId ?? req.user.currentSchoolId
    return this.svc.getStudentLiturgyReadiness(studentId, schoolId, req.user)
  }
}
