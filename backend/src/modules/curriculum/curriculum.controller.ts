import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadRecording } from '@/common/storage/r2';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurriculumService } from './curriculum.service';
import { CreateAllocationDto, UpdateAllocationDto, ReorderAllocationDto } from './dto/curriculum.dto';
import { CreateLessonDto, UpdateLessonDto, ParseHtmlDto } from './dto/lesson.dto';

@ApiTags('curriculum')
@Roles(...STAFF_ROLES)
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

    @Get('levels')
  @ApiOperation({ summary: 'Get all levels for a school' })
  getLevels(@Query('schoolId') schoolId: string) {
    return this.curriculumService.getLevels(schoolId);
  }

    @Post('levels')
  @ApiOperation({ summary: 'Create a new level' })
  createLevel(@Query('schoolId') schoolId: string, @Body() body: any) {
    return this.curriculumService.createLevel(schoolId, body);
  }

    @Patch('levels/:id')
  @ApiOperation({ summary: 'Update a level (including status toggle)' })
  updateLevel(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateLevel(id, body);
  }

    @Delete('levels/:id')
  @ApiOperation({ summary: 'Delete a level (soft delete)' })
  deleteLevel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.curriculumService.deleteLevel(id, user);
  }

    @Get('subjects')
  @ApiOperation({ summary: 'Get all subjects for a school' })
  getSubjects(@Query('schoolId') schoolId: string) {
    return this.curriculumService.getSubjects(schoolId);
  }

    @Post('subjects')
  @ApiOperation({ summary: 'Create a new subject' })
  createSubject(@Query('schoolId') schoolId: string, @Body() body: any) {
    return this.curriculumService.createSubject(schoolId, body);
  }

    @Put('subjects/:id')
  @ApiOperation({ summary: 'Update a subject' })
  updateSubject(
    @Query('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.curriculumService.updateSubject(schoolId, id, body);
  }

    @Delete('subjects/:id')
  @ApiOperation({ summary: 'Delete a subject' })
  deleteSubject(@Query('schoolId') schoolId: string, @Param('id') id: string) {
    return this.curriculumService.deleteSubject(schoolId, id);
  }

    @Get('subjects/:id/items')
  @ApiOperation({ summary: 'Get all items for a subject' })
  getSubjectItems(@Query('schoolId') schoolId: string, @Param('id') id: string) {
    return this.curriculumService.getSubjectItems(schoolId, id);
  }

    @Get('items')
  @ApiOperation({ summary: 'Get all items across subjects, optionally filtered by level' })
  getAllItems(@Query('schoolId') schoolId: string, @Query('levelNumber') levelNumber?: string) {
    return this.curriculumService.getAllItems(schoolId, levelNumber ? parseInt(levelNumber) : undefined);
  }

    @Post('subjects/:id/items')
  @ApiOperation({ summary: 'Create a new subject item' })
  createSubjectItem(@Query('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.curriculumService.createSubjectItem(schoolId, id, body);
  }

    @Put('subjects/items/:id')
  @ApiOperation({ summary: 'Update a subject item' })
  updateSubjectItem(@Query('schoolId') schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateSubjectItem(schoolId, id, body);
  }

    @Delete('subjects/items/:id')
  @ApiOperation({ summary: 'Delete a subject item' })
  deleteSubjectItem(@Query('schoolId') schoolId: string, @Param('id') id: string) {
    return this.curriculumService.deleteSubjectItem(schoolId, id);
  }

    @Patch('items/:id/status')
  @ApiOperation({ summary: 'Update subject item status (pending, in_progress, completed)' })
  updateItemStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.curriculumService.updateItemStatus(id, body.status);
  }

    @Get('lessons')
  @ApiOperation({ summary: 'Get all lessons for a school' })
  getLessons(
    @Query('schoolId') schoolId: string,
    @Query('levelId') levelId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.curriculumService.getLessons(schoolId, levelId, subjectId, Number(skip) || 0, Number(take) || 200);
  }

    @Get('lessons/:id')
  @ApiOperation({ summary: 'Get a single lesson by ID' })
  getLesson(@Param('id') id: string) {
    return this.curriculumService.getLesson(id);
  }

    @Get('allocations')
  @ApiOperation({ summary: 'Get curriculum allocations' })
  getAllocations(
    @Query('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('term') term?: string,
  ) {
    return this.curriculumService.getAllocations(
      schoolId, academicYearId, levelId, subjectId, term ? parseInt(term) : undefined,
    );
  }

    @Get('calendar')
  @ApiOperation({ summary: 'Get calendar view of curriculum' })
  getCalendarView(
    @Query('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
  ) {
    return this.curriculumService.getCalendarView(schoolId, academicYearId, levelId);
  }

    @Get('academic-years')
  @ApiOperation({ summary: 'Get all academic years for a school' })
  getAcademicYears(@Query('schoolId') schoolId: string) {
    return this.curriculumService.getAcademicYears(schoolId);
  }

    @Post('academic-years')
  @ApiOperation({ summary: 'Create a new academic year' })
  createAcademicYear(@Query('schoolId') schoolId: string, @Body() body: any) {
    return this.curriculumService.createAcademicYear(schoolId, body);
  }

    @Put('academic-years/:id')
  @ApiOperation({ summary: 'Update an academic year' })
  updateAcademicYear(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateAcademicYear(id, body);
  }

    @Delete('academic-years/:id')
  @Roles('curriculum_manager', 'principal', 'admin', 'super_admin')
  @ApiOperation({ summary: 'Delete an academic year' })
  deleteAcademicYear(@Param('id') id: string, @CurrentUser() user: any) {
    return this.curriculumService.deleteAcademicYear(id, user);
  }

    @Post('allocations')
  @ApiOperation({ summary: 'Create a curriculum allocation' })
  createAllocation(@Body() dto: CreateAllocationDto) {
    return this.curriculumService.createAllocation(dto);
  }

    @Put('allocations/:id')
  @ApiOperation({ summary: 'Update a curriculum allocation' })
  updateAllocation(@Param('id') id: string, @Body() dto: UpdateAllocationDto, @CurrentUser() user?: any) {
    return this.curriculumService.updateAllocation(id, dto, user?.id);
  }

    @Delete('allocations/:id')
  @ApiOperation({ summary: 'Delete a curriculum allocation' })
  deleteAllocation(@Param('id') id: string) {
    return this.curriculumService.deleteAllocation(id);
  }

    @Delete('allocations')
  @ApiOperation({ summary: 'Delete multiple curriculum allocations' })
  deleteAllocations(@Query('academicYearId') academicYearId: string, @Query('term') term?: string, @Query('levelId') levelId?: string) {
    return this.curriculumService.deleteAllocations({ academicYearId, term: term ? Number(term) : undefined, levelId });
  }

    @Post('allocations/reorder')
  @ApiOperation({ summary: 'Reorder curriculum allocations' })
  reorderAllocations(@Body() dto: { allocations: ReorderAllocationDto[] }, @CurrentUser() user: any) {
    return this.curriculumService.reorderAllocations(dto.allocations, user);
  }

    @Post('lessons')
  @ApiOperation({ summary: 'Create a new lesson' })
  createLesson(@Query('schoolId') schoolId: string, @Body() dto: CreateLessonDto, @CurrentUser('id') userId: string) {
    return this.curriculumService.createLesson(schoolId, dto, userId);
  }

    @Put('lessons/:id')
  @ApiOperation({ summary: 'Update a lesson' })
  updateLesson(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.curriculumService.updateLesson(id, dto);
  }

    @Patch('lessons/:id/audio')
  @ApiOperation({ summary: 'Upload audio recording for a lesson' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', {
    storage: diskStorage({
      destination: './uploads/audio',
      filename: (_req, file, cb) => {
        cb(null, `${uuidv4()}${extname(file.originalname)}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      const allowed = ['.mp3', '.m4a', '.ogg']
      const ext = extname(file.originalname).toLowerCase()
      if (allowed.includes(ext)) cb(null, true)
      else cb(new BadRequestException(`Invalid audio format. Allowed: ${allowed.join(', ')}`), false)
    },
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
   uploadAudio(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const audioUrl = `/uploads/audio/${file.filename}`
    return this.curriculumService.updateLesson(id, { audioUrl, audioOriginalName: file.originalname })
  }

    @Post('subjects/items/:id/recording')
    @ApiOperation({ summary: 'Upload a hymn recording for a subject item (Cloudflare R2)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const allowed = ['.mp3', '.m4a', '.ogg', '.webm'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new BadRequestException(`Invalid audio format. Allowed: ${allowed.join(', ')}`), false);
      },
      limits: { fileSize: 15 * 1024 * 1024 },
    }))
    async uploadItemRecording(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
      if (!file) throw new BadRequestException('No file uploaded');
      const ext = extname(file.originalname).toLowerCase();
      const key = `recordings/subject-items/${id}-${uuidv4()}${ext}`;
      const url = await uploadRecording(file.buffer, key, file.mimetype);
      return this.curriculumService.setItemRecording(id, url, {
        originalName: file.originalname,
        sizeBytes: file.size,
        contentType: file.mimetype,
      });
    }

    @Delete('subjects/items/:id/recording')
    @ApiOperation({ summary: 'Remove the hymn recording from a subject item' })
    async removeItemRecording(@Param('id') id: string) {
      return this.curriculumService.clearItemRecording(id);
    }

    @Delete('lessons/:id')
  @Roles('curriculum_manager', 'principal', 'admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a lesson' })
  deleteLesson(@Param('id') id: string, @CurrentUser() user: any) {
    return this.curriculumService.deleteLesson(id, user);
  }

    @Post('lessons/bulk')
  @ApiOperation({ summary: 'Bulk create lessons' })
  bulkCreateLessons(@Query('schoolId') schoolId: string, @Body() body: { lessons: any[] }, @CurrentUser('id') userId: string) {
    return this.curriculumService.bulkCreateLessons(schoolId, body.lessons, userId);
  }

    @Post('parse-html')
  @ApiOperation({ summary: 'Parse CopticChurch.net HTML into presentation JSON' })
  parseHtml(@Body() dto: ParseHtmlDto) {
    return this.curriculumService.parseCopticChurchHtml(dto.html);
  }

    @Post('academic-years/:id/generate-weekends')
  @ApiOperation({ summary: 'Auto-generate Sat/Sun active days and weeks for the academic year' })
  generateWeekends(@Param('id') id: string) {
    return this.curriculumService.generateWeekends(id);
  }

    @Get('weeks')
  @ApiOperation({ summary: 'Get weeks for an academic year' })
  getWeeks(
    @Query('schoolId') schoolId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.curriculumService.getWeeks(schoolId, academicYearId);
  }

    @Put('weeks/:id')
  @ApiOperation({ summary: 'Update a week' })
  updateWeek(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateWeek(id, body);
  }

    @Post('weeks/bulk-update')
  @ApiOperation({ summary: 'Bulk update weeks' })
  bulkUpdateWeeks(@Body() body: { weeks: Array<{ id: string; isAvailable?: boolean; label?: string; reason?: string }> }) {
    return this.curriculumService.bulkUpdateWeeks(body.weeks);
  }

  // Calendar Events
    @Get('calendar-events')
  @ApiOperation({ summary: 'Get calendar events for an academic year' })
  getCalendarEvents(@Query('academicYearId') academicYearId: string) {
    return this.curriculumService.getCalendarEvents(academicYearId);
  }

    @Post('calendar-events')
  @ApiOperation({ summary: 'Create a calendar event' })
  createCalendarEvent(@Body() body: { academicYearId: string; date: string; label: string; type: string; description?: string }) {
    return this.curriculumService.createCalendarEvent(body);
  }

    @Put('calendar-events/:id')
  @ApiOperation({ summary: 'Update a calendar event' })
  updateCalendarEvent(@Param('id') id: string, @Body() body: { date?: string; label?: string; type?: string; description?: string }) {
    return this.curriculumService.updateCalendarEvent(id, body);
  }

    @Delete('calendar-events/:id')
  @ApiOperation({ summary: 'Delete a calendar event' })
  deleteCalendarEvent(@Param('id') id: string) {
    return this.curriculumService.deleteCalendarEvent(id);
  }
}
