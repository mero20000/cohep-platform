import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards, HttpCode, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ParentsService } from './parents.service';
import { LinkChildDto } from './dto/link-child.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('parents')
@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('me/children')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get all children linked to the logged-in parent' })
  async getChildren(@Req() req: any) {
    return this.parentsService.getChildren(req.user.id);
  }

  @Post('me/children/link')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link a child to your account using the child student code' })
  async linkChild(@Body() dto: LinkChildDto, @Req() req: any) {
    return this.parentsService.linkChild(dto.studentCode, req.user.id, dto.relationship);
  }

  @Delete('me/children/:id')
  @HttpCode(200)
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink a child from your account' })
  async unlinkChild(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.unlinkChild(id, req.user.id);
  }

  @Get('me/children/:id')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Student id' })
  @ApiOperation({ summary: 'Get details for a single linked child' })
  async getChild(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChild(id, req.user.id);
  }

  @Get('me/children/:id/attendance')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get attendance records for a specific child' })
  async getChildAttendance(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildAttendance(id, req.user.id);
  }

  @Get('me/children/:id/assessments')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get assessment results for a specific child' })
  async getChildAssessments(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildAssessments(id, req.user.id);
  }

  @Get('me/children/:id/progress')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get progress tracking for a specific child' })
  async getChildProgress(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildProgress(id, req.user.id);
  }

  @Get('me/children/:id/home')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the full student home screen data — XP, streak, badges, journey, challenges' })
  async getChildHome(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildHome(id, req.user.id);
  }

  @Get('me/children/:id/current-lesson')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current lesson for practice together' })
  async getCurrentLesson(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getCurrentLesson(id, req.user.id);
  }

  @Post('me/children/:id/practice')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log a practice session and award XP' })
  async logPractice(@Param('id') id: string, @Body('lessonId') lessonId: string, @Req() req: any) {
    return this.parentsService.logPractice(id, lessonId, req.user.id);
  }

  @Get('me/children/:id/practice-summary')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get practice summary for the week' })
  async getPracticeSummary(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getPracticeSummary(id, req.user.id);
  }

  @Post('me/children/:id/liturgy')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log a liturgy attendance' })
  async logLiturgy(
    @Param('id') id: string,
    @Body('date') date: string,
    @Body('notes') notes: string | undefined,
    @Req() req: any,
  ) {
    return this.parentsService.logLiturgy(id, date, notes, req.user.id);
  }

  @Get('me/children/:id/liturgy')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get liturgy records for a child' })
  async getLiturgyRecords(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getLiturgyRecords(id, req.user.id);
  }

  @Get('me/children/:id/milestones')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get spiritual milestones for a child' })
  async getMilestones(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getMilestones(id, req.user.id);
  }

  @Get('me/children/:id/archive')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get formation archive data for PDF export' })
  async getArchive(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getArchiveData(id, req.user.id);
  }

  @Get('me/children/:id/term-report')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get term report summary' })
  async getTermReport(
    @Param('id') id: string,
    @Query('term') term: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Req() req: any,
  ) {
    return this.parentsService.getTermReport(id, parseInt(term) || 1, academicYearId, req.user.id);
  }

  @Post('me/children/:id/report-assessment')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report an assessment result from home practice' })
  async reportAssessment(
    @Param('id') id: string,
    @Body('assessmentId') assessmentId: string,
    @Body('score') score: number,
    @Body('notes') notes: string | undefined,
    @Req() req: any,
  ) {
    return this.parentsService.reportHomeAssessment(id, assessmentId, score, notes, req.user.id);
  }
}
