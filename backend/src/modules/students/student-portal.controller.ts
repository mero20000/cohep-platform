import {
  Controller, Get, Param, Post, Body, HttpCode, UploadedFile, UseInterceptors, Query,
  UseGuards, SetMetadata,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { StudentsService } from './students.service';
import { HymnLearningService } from '../curriculum/hymn-learning.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { SubmitAssessmentDto } from '../assessments/dto/assessment.dto';
import { StudentLoginDto } from './dto/student-login.dto';
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
  async getPortal(@Param('portalAccessKey') portalAccessKey: string) {
    return this.studentsService.getPortalData(portalAccessKey);
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

  // ─── Hymn Learning endpoints (code-scoped) ───────────────────────────────

  private async resolveStudent(code: string) {
    const student = await (this.studentsService as any).prisma?.student?.findFirst({
      where: { portalAccessKey: code, deletedAt: null },
      select: { id: true, schoolId: true, firstName: true, lastName: true },
    });
    if (!student) throw new Error('Student not found');
    return student;
  }

  @Get(':code/hymn-map')
  @ApiOperation({ summary: 'Student hymn progress map' })
  async getHymnMap(@Param('code') code: string) {
    const student = await this.resolveStudent(code);
    return this.hymnLearning.getStudentHymnMap(student.id, student.schoolId);
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
    return this.hymnLearning.getStudentStats(student.id, student.schoolId);
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
    @Body() body: { lessonId: string; selfRating: number; recordingUrl?: string; durationSec?: number },
  ) {
    const student = await this.resolveStudent(code);
    return this.hymnLearning.logPracticeSession({
      studentId: student.id,
      schoolId: student.schoolId,
      lessonId: body.lessonId,
      selfRating: body.selfRating,
      recordingUrl: body.recordingUrl,
      durationSec: body.durationSec,
    });
  }

  @Post(':code/recordings')
  @ApiOperation({ summary: 'Upload a practice recording' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: (() => {
      if (isCloudinaryConfigured) return createCloudinaryStorage('recordings');
      return diskStorage({
        destination: 'uploads/recordings',
        filename: (_req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      });
    })(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['.webm', '.mp3', '.m4a', '.ogg'];
      const ext = extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error('Only .webm, .mp3, .m4a, .ogg files are allowed'), false);
    },
  }))
  async uploadRecording(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    if (isCloudinaryConfigured && file.path) {
      return { url: file.path };
    }
    return { url: `/uploads/recordings/${file.filename}` };
  }
}
