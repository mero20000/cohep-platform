import {
  Controller, Get, Param, Post, Body, HttpCode, UploadedFile, UseInterceptors, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { HymnLearningService } from '../curriculum/hymn-learning.service';
import { StudentLoginDto } from './dto/student-login.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('student-portal')
@Controller('student-portal')
@Public()
export class StudentPortalController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly hymnLearning: HymnLearningService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Student login via unguessable portal access key — returns portal data' })
  async login(@Body() dto: StudentLoginDto) {
    return this.studentsService.getPortalData(dto.portalAccessKey);
  }

  @Get(':portalAccessKey')
  @ApiOperation({ summary: 'Get student portal data by portal access key' })
  async getPortal(@Param('portalAccessKey') portalAccessKey: string) {
    return this.studentsService.getPortalData(portalAccessKey);
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
    storage: diskStorage({
      destination: 'uploads/recordings',
      filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
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
    return { url: `/uploads/recordings/${file.filename}` };
  }
}
