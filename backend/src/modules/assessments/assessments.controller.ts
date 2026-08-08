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
  ) {
    return this.assessmentsService.findAll(schoolId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      levelId,
      subjectId,
      status,
    });
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.findOne(id);
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
  ) {
    return this.assessmentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete assessment (soft delete)' })
  @ApiResponse({ status: 200, description: 'Assessment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.delete(id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit assessment answers' })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  @ApiResponse({ status: 400, description: 'Assessment not open for submission' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: SubmitAssessmentDto,
  ) {
    return this.assessmentsService.submit(id, studentId, dto);
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'List submissions for an assessment' })
  @ApiResponse({ status: 200, description: 'Submissions retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async getSubmissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessmentsService.getSubmissions(id);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign students to an assessment' })
  async assignStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: AssignStudentsDto,
  ) {
    return this.assessmentsService.assignStudents(id, dto.studentIds);
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Unassign a student from an assessment' })
  async unassignStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.assessmentsService.unassignStudent(id, studentId);
  }

  @Post(':id/students/:studentId/reassess')
  @ApiOperation({ summary: 'Re-open a completed submission for re-marking' })
  async reassessStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.assessmentsService.reassessStudent(id, studentId);
  }

  @Post(':id/students/:studentId/mark')
  @ApiOperation({ summary: 'Record a manual mark for a student' })
  async markStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) dto: MarkStudentDto,
    @Req() req: any,
  ) {
    return this.assessmentsService.markStudent(id, studentId, dto.score, dto.maxScore, dto.feedback, req.user?.id);
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'List students for an assessment (by level/group/grade) with marks' })
  async getStudentsForAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.assessmentsService.getStudentsForAssessment(id, gradeId);
  }
}
