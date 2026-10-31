import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  SubmitAssessmentDto,
  AssignStudentsDto,
  MarkStudentDto,
  ReturnSubmissionDto,
  AcceptAutoScoresDto,
  FixIntegrityDto,
} from './dto/assessment.dto';

@ApiTags('assessments')
@Roles(...STAFF_ROLES)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List assessments (paginated)' })
  @ApiResponse({ status: 200, description: 'Assessments retrieved successfully' })
  async findAll(
    @Query('schoolId') schoolId: string = '',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('levelId') levelId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.assessmentsService.findAll(schoolId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      levelId,
      subjectId,
      status,
      type,
    });
  }

  @Get('pending-review')
  @ApiOperation({ summary: 'List submissions awaiting marking (all for admins, own group for servants)' })
  async getPendingReview(@Query('schoolId') schoolId: string = '', @Req() req: any) {
    return this.assessmentsService.getPendingReview(schoolId, req.user);
  }

  @Get('marked')
  @ApiOperation({ summary: 'Submissions already marked, with who marked them (all for admins, own group for servants)' })
  async getMarked(
    @Query('schoolId') schoolId: string = '',
    @Query('days') days?: string,
    @Req() req?: any,
  ) {
    return this.assessmentsService.getMarked(schoolId, req?.user, days ? parseInt(days, 10) : undefined);
  }

  @Get('pending-review/count')
  @ApiOperation({ summary: 'Count of submissions awaiting marking for the caller' })
  async getPendingReviewCount(@Query('schoolId') schoolId: string = '', @Req() req: any) {
    return this.assessmentsService.getPendingReviewCount(schoolId, req.user);
  }

  @Post('pending-review/accept-auto')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Accept the automatic score for many submissions at once (admin)' })
  async acceptAutoScores(
    @Query('schoolId') schoolId: string = '',
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: AcceptAutoScoresDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.acceptAutoScores(schoolId, dto.submissionIds, req.user);
  }

  @Post('pending-review/:submissionId/reset')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Discard a pending submission and reset the student to not-yet-submitted (admin)' })
  async resetPendingSubmission(
    @Query('schoolId') schoolId: string = '',
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Req() req: any,
  ) {
    return this.assessmentsService.resetPendingSubmission(schoolId, submissionId, req.user);
  }

  @Get('integrity')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Scan for duplicate or unassigned student-assessment records (admin, read-only)' })
  async getIntegrityReport(@Query('schoolId') schoolId: string = '', @Query('studentCode') studentCode?: string) {
    return this.assessmentsService.getIntegrityReport(schoolId, studentCode?.trim() || undefined);
  }

  @Post('integrity/fix')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Archive duplicate or stale student-assessment records (admin)' })
  async fixIntegrity(
    @Query('schoolId') schoolId: string = '',
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: FixIntegrityDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.fixIntegrity(schoolId, dto.items, req.user);
  }

  @Get('review-stats')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Marking backlog and turnaround per group and marker (admin)' })
  async getReviewStats(@Query('schoolId') schoolId: string = '') {
    return this.assessmentsService.getReviewStats(schoolId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get assessment stats' })
  async getStats(@Query('schoolId') schoolId: string = '') {
    return this.assessmentsService.getStats(schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assessment with questions' })
  @ApiResponse({ status: 200, description: 'Assessment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.assessmentsService.findOne(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Create assessment with questions' })
  @ApiResponse({ status: 201, description: 'Assessment created successfully' })
  async create(
    @Query('schoolId') schoolId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: CreateAssessmentDto,
  ) {
    return this.assessmentsService.create(dto, schoolId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update assessment' })
  @ApiResponse({ status: 200, description: 'Assessment updated successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: UpdateAssessmentDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete assessment (soft delete)' })
  @ApiResponse({ status: 200, description: 'Assessment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.assessmentsService.delete(id, req.user);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit assessment answers' })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  @ApiResponse({ status: 400, description: 'Assessment not open for submission' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  @Roles(...STAFF_ROLES)
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: SubmitAssessmentDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.submit(id, studentId, dto, req.user);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'List submissions for an assessment' })
  @ApiResponse({ status: 200, description: 'Submissions retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async getSubmissions(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.assessmentsService.getSubmissions(id, req.user);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign students to an assessment' })
  async assignStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: AssignStudentsDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.assignStudents(id, dto.studentIds, req.user);
  }

  @Post(':id/publish')
  @Roles('admin', 'super_admin', 'principal', 'curriculum_manager', 'level_leader')
  async publish(@Param('id') id: string, @Req() req: any) {
    return this.assessmentsService.publishAssessment(id, req.user);
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Unassign a student from an assessment' })
  async unassignStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Req() req: any,
  ) {
    return this.assessmentsService.unassignStudent(id, studentId, req.user);
  }

  @Post(':id/students/:studentId/reassess')
  @ApiOperation({ summary: 'Re-open a completed submission for re-marking' })
  async reassessStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Req() req: any,
  ) {
    return this.assessmentsService.reassessStudent(id, studentId, req.user);
  }

  @Post(':id/students/:studentId/mark')
  @ApiOperation({ summary: 'Record a manual mark for a student' })
  async markStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: MarkStudentDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.markStudent(id, studentId, dto.score, dto.maxScore, dto.feedback, req.user?.id, {
      questionScores: dto.questionScores,
      extraScore: dto.extraScore,
      actor: req.user,
    });
  }

  @Post(':id/students/:studentId/return')
  @ApiOperation({ summary: 'Return a submitted attempt to the student to redo (nothing is deleted)' })
  async returnSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: ReturnSubmissionDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.returnSubmission(id, studentId, dto.note, req.user);
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'List students for an assessment (by level/group/grade) with marks' })
  async getStudentsForAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.assessmentsService.getStudentsForAssessment(id, gradeId, req.user);
  }

  @Get(':id/questions')
  @ApiOperation({ summary: 'Get assessment questions for a student to take (answers not exposed)' })
  @Roles(...STAFF_ROLES)
  async getTakeQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
    @Req() req: any,
  ) {
    return this.assessmentsService.getTakeQuestions(id, studentId, req.user);
  }
}
