import {
  Controller, Get, Param, Post, Patch, Body, HttpCode, UploadedFile, UseInterceptors, Query, Delete,
  UseGuards, SetMetadata, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadRecording, isOwnedRecordingUrl } from '../../common/storage/r2';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { StudentsService } from './students.service';
import { HymnLearningService } from '../curriculum/hymn-learning.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { ParentsService, STUDENT_SELF } from '../parents/parents.service';
import { SubmitAssessmentDto } from '../assessments/dto/assessment.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { LogPracticeDto } from './dto/log-practice.dto';
import { LogLiturgyDto } from './dto/log-liturgy.dto';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';
import { Public } from '../../common/decorators/public.decorator';
import { StudentPortalAuthGuard, SKIP_PORTAL_AUTH } from './student-portal-auth.guard';
import { createCloudinaryStorage, isCloudinaryConfigured } from '../../common/config/cloudinary';

@ApiTags('student-portal')
@UseGuards(StudentPortalAuthGuard)
@Controller('student-portal')
@Public()
export class StudentPortalController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly hymnLearning: HymnLearningService,
    private readonly assessmentsService: AssessmentsService,
    private readonly parentsService: ParentsService,
    private readonly studentNotifications: StudentNotificationsService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @Public()
  @SetMetadata(SKIP_PORTAL_AUTH, true)
  // Brute-forcing access keys must be expensive; global throttle is looser.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a portal access key for a short-lived session token + initial data' })
  async login(@Body() dto: StudentLoginDto) {
    const data = await this.studentsService.getPortalData(dto.portalAccessKey);
    const studentId = (data as { student?: { id?: string } })?.student?.id;
    const token = this.jwt.sign(
      { sub: studentId, code: dto.portalAccessKey },
      { secret: process.env.JWT_SECRET, expiresIn: '12h' },
    );
    return { ...data, accessToken: token, expiresIn: 12 * 60 * 60 };
  }

  @Get(':portalAccessKey')
  @ApiOperation({ summary: 'Get student portal data by portal access key' })
  async getPortal(
    @Param('portalAccessKey') portalAccessKey: string,
    @Query('redactNames') redactNames?: string,
  ) {
    const data = await this.studentsService.getPortalData(portalAccessKey);
    if (redactNames === 'true') {
      return { ...data, student: { ...data.student, firstName: null, lastName: null, firstNameAr: null, lastNameAr: null } };
    }
    return data;
  }

  @Get(':code/assessments/:id')
  @ApiOperation({ summary: 'Get an assigned assessment questions for the student to take (answers not exposed)' })
  async takeAssessment(@Param('code') code: string, @Param('id') id: string) {
    const student = await this.resolveStudent(code);
    return this.assessmentsService.getTakeQuestions(id, student.id);
  }

  @Post(':code/assessments/:id/submit')
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit answers for an assessment as this student' })
  async submitAssessment(
    @Param('code') code: string,
    @Param('id') id: string,
    @Body() body: SubmitAssessmentDto,
  ) {
    const student = await this.resolveStudent(code);
    return this.assessmentsService.submit(id, student.id, body);
  }

  @Get(':code/assessments/:assessmentId/submission/:submissionId')
  @ApiOperation({ summary: 'Get submission review details for a completed assessment' })
  async getSubmissionReview(
    @Param('code') code: string,
    @Param('assessmentId') assessmentId: string,
    @Param('submissionId') submissionId: string,
  ) {
    const student = await this.resolveStudent(code);
    return this.assessmentsService.getSubmissionReview(submissionId, student.id, assessmentId);
  }

  @Post(':code/assessments/:id/retake')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retake a non-essay assessment (creates new submission with blank state)' })
  async retakeAssessment(
    @Param('code') code: string,
    @Param('id') id: string,
  ) {
    const student = await this.resolveStudent(code);
    return this.assessmentsService.prepareRetake(id, student.id);
  }

  // ─── Hymn Learning endpoints (code-scoped) ───────────────────────────────

  private async resolveStudent(code: string) {
    const student = await (this.studentsService as any).prisma?.student?.findFirst({
      where: { portalAccessKey: code, deletedAt: null },
      select: { id: true, schoolId: true, firstName: true, lastName: true, level: { select: { number: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  @Get(':code/subject-items')
  @ApiOperation({ summary: 'Subject items with pass status for the authenticated student' })
  async getPortalSubjectItems(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.studentsService.getStudentSubjectItems(student.id, student, { portal: true });
  }

  @Get(':code/hymn-map')
  @ApiOperation({ summary: 'Student hymn progress map — allocated curriculum items (deduped), fallback to own level and below' })
  async getHymnMap(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    const full = await (this.studentsService as any).prisma?.student?.findFirst({
      where: { portalAccessKey: code, deletedAt: null },
      select: { levelId: true, group: { select: { name: true } } },
    });
    return this.hymnLearning.getStudentHymnMap(
      student.id,
      student.schoolId,
      student.level?.number ?? undefined,
      full?.levelId ?? null,
      full?.group?.name ?? null,
    );
  }

  @Get(':code/this-sunday')
  @ApiOperation({ summary: 'Hymns for upcoming Sunday' })
  async getThisSunday(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.hymnLearning.getThisSundayHymns(student.schoolId);
  }

  @Get(':code/due-review')
  @ApiOperation({ summary: 'Hymns due for spaced repetition review' })
  async getDueReview(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.hymnLearning.getDueForReview(student.id, student.schoolId);
  }

  @Get(':code/stats')
  @ApiOperation({ summary: 'Student learning stats' })
  async getStats(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    // Same scoping as /hymn-map, so the two cannot disagree.
    const full = await (this.studentsService as any).prisma?.student?.findFirst({
      where: { portalAccessKey: code, deletedAt: null },
      select: { levelId: true, group: { select: { name: true } } },
    });
    return this.hymnLearning.getStudentStats(
      student.id,
      student.schoolId,
      student.level?.number ?? undefined,
      full?.levelId ?? null,
      full?.group?.name ?? null,
    );
  }

  @Get(':code/achievements')
  @ApiOperation({ summary: 'Recent XP achievements (dashboard drill-down)' })
  async getAchievements(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    const tx = await (this.studentsService as any).prisma.xPTransaction.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { amount: true, type: true, description: true, createdAt: true, balanceAfter: true },
    });
    return {
      totalXp: tx.length ? (tx[0].balanceAfter ?? 0) : 0,
      transactions: tx.map(t => ({
        amount: t.amount,
        type: t.type,
        description: t.description,
        date: t.createdAt,
      })),
    };
  }

  @Get(':code/history/:lessonId')
  @ApiOperation({ summary: 'Practice history for a specific hymn' })
  async getHistory(@Param('code') code: string, @Param('lessonId') lessonId: string) {
    const student = await this.resolveStudent(code);
    return this.hymnLearning.getHymnHistory(student.id, lessonId);
  }

  @Post(':code/practice')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log a practice session' })
  async logPractice(
    @Param('code') code: string,
    @Body() body: LogPracticeDto,
  ) {
    const student = await this.resolveStudent(code);
    if (body.recordingUrl && !isOwnedRecordingUrl(body.recordingUrl)) {
      throw new BadRequestException('recordingUrl must be a recording uploaded to this platform');
    }
    return this.hymnLearning.logPracticeSession({
      studentId: student.id,
      schoolId: student.schoolId,
      lessonId: body.lessonId,
      selfRating: body.selfRating,
      recordingUrl: body.recordingUrl,
      durationSec: body.durationSec,
    }, { id: student.id });
  }

  @Delete(':code/practice/:sessionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a practice session (only if not reviewed)' })
  async deletePractice(
    @Param('code') code: string,
    @Param('sessionId') sessionId: string,
  ) {
    const student = await this.resolveStudent(code);
    return this.hymnLearning.deletePracticeSession(sessionId, { id: student.id });
  }

  // ─── The student's own view of themselves ────────────────────────────────
  // Every route below already existed as a working parent endpoint on the same data.
  // The parent portal was materially richer than the student's view of their own
  // formation — an aggregated feed of servant reviews, a streak, XP as a level, a
  // milestones timeline, a formation archive, a term report — and none of it reached the
  // child. These are the missing student routes, not missing capability.

  @Get(':code/me/home')
  @ApiOperation({ summary: 'Aggregated home: recent servant reviews, streak, XP level, current lesson' })
  async getMyHome(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.parentsService.getChildHome(student.id, STUDENT_SELF);
  }

  @Get(':code/me/milestones')
  @ApiOperation({ summary: 'Chronological milestones timeline' })
  async getMyMilestones(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.parentsService.getMilestones(student.id, STUDENT_SELF);
  }

  @Get(':code/me/archive')
  @ApiOperation({ summary: 'Formation archive' })
  async getMyArchive(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.parentsService.getArchiveData(student.id, STUDENT_SELF);
  }

  @Get(':code/me/practice-summary')
  @ApiOperation({ summary: "This week's practice summary, including practice a parent logged" })
  async getMyPracticeSummary(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.parentsService.getPracticeSummary(student.id, STUDENT_SELF);
  }

  @Get(':code/me/term-report')
  @ApiOperation({ summary: 'Term report: attendance across the academic year plus a servant note' })
  async getMyTermReport(
    @Param('code') code: string,
    @Query('term') term?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const student = await this.resolveStudent(code);
    const parsed = Number(term);
    const termNumber = Number.isInteger(parsed) && parsed >= 1 && parsed <= 3 ? parsed : 1;
    return this.parentsService.getTermReport(student.id, termNumber, academicYearId, STUDENT_SELF);
  }

  @Get(':code/me/liturgy')
  @ApiOperation({ summary: 'Liturgy attendance records filed for this student, including rejections' })
  async getMyLiturgy(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.parentsService.getLiturgyRecords(student.id, STUDENT_SELF);
  }

  @Post(':code/me/liturgy')
  @HttpCode(201)
  @ApiOperation({ summary: 'File a liturgy attendance claim as this student' })
  async logMyLiturgy(@Param('code') code: string, @Body() body: LogLiturgyDto) {
    const student = await this.resolveStudent(code);
    // Filing was parent-only, so a student who served at the liturgy could not say so.
    return this.parentsService.logLiturgy(student.id, body.date, body.notes, STUDENT_SELF);
  }

  // ─── Notifications ───────────────────────────────────────────────────────
  // A student had no way to be told anything: Notification.userId points at User and
  // Student has no User relation, so they could not be addressed as a recipient at all.
  // This is the student-scoped feed, polled by the portal — there is no push transport.

  @Get(':code/me/notifications')
  @ApiOperation({ summary: "This student's notification feed" })
  async getMyNotifications(
    @Param('code') code: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const student = await this.resolveStudent(code);
    const parsed = Number(limit);
    return this.studentNotifications.list(student.id, {
      unreadOnly: unreadOnly === 'true',
      limit: Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  @Get(':code/me/notifications/unread-count')
  @ApiOperation({ summary: 'Unread notification count for the badge' })
  async getMyUnreadCount(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.studentNotifications.unreadCount(student.id);
  }

  @Patch(':code/me/notifications/read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark every notification read' })
  async markAllMyNotificationsRead(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.studentNotifications.markAllRead(student.id);
  }

  @Patch(':code/me/notifications/:id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark one notification read' })
  async markMyNotificationRead(@Param('code') code: string, @Param('id') id: string) {
    const student = await this.resolveStudent(code);
    // Scoped by studentId as well as id, so one student cannot mark another's as read.
    return this.studentNotifications.markRead(student.id, id);
  }

  @Post(':code/recordings')
  @ApiOperation({ summary: 'Upload a practice recording' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['.webm', '.mp3', '.m4a', '.ogg'];
      const ext = extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error('Only .webm, .mp3, .m4a, .ogg files are allowed'), false);
    },
  }))
  async uploadRecording(
    @Param('code') code: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // This handler previously took only the file: it never read the route's access key,
    // never resolved a student, and wrote into one shared prefix — general-purpose file
    // hosting for anyone holding any valid portal session. Resolving the student both
    // scopes the object key and makes the guard's route binding actually mean something.
    const student = await this.resolveStudent(code);
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.buffer) throw new BadRequestException('No file buffer');
    const filename = `${uuidv4()}${extname(file.originalname)}`;
    const url = await uploadRecording(
      file.buffer,
      `practice-recordings/${student.id}/${filename}`,
      file.mimetype,
    );
    return { url };
  }
}
