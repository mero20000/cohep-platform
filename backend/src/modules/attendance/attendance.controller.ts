import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { UpdateAttendanceSessionDto } from './dto/update-attendance-session.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { QrCheckInDto } from './dto/qr-checkin.dto';

@ApiTags('attendance')
@Roles(...STAFF_ROLES)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Get attendance sessions' })
  async getSessions(
    @Req() req: any,
    @Query('schoolId') schoolId: string = '',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('levelId') levelId?: string,
    @Query('groupId') groupId?: string,
    @Query('servantId') servantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getSessions(schoolId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      status, levelId, groupId, servantId, from, to,
    }, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get attendance session stats' })
  async getStats(@Query('schoolId') schoolId: string = '') {
    return this.attendanceService.getSessionStats(schoolId);
  }

  @Get('student-search')
  @ApiOperation({ summary: 'Search students and get attendance records' })
  async searchStudentAttendance(
    @Query('q') q?: string,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.attendanceService.searchStudentAttendance(q || '', schoolId);
  }

  @Get('level-stats')
  @ApiOperation({ summary: 'Get attendance stats by level' })
  async getLevelStats(@Query('schoolId') schoolId: string = '') {
    return this.attendanceService.getLevelStats(schoolId);
  }

  @Get('group-stats')
  @ApiOperation({ summary: 'Get attendance stats by group' })
  async getGroupStats(@Query('schoolId') schoolId: string = '') {
    return this.attendanceService.getGroupStats(schoolId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get an attendance session by ID' })
  async getSessionById(@Param('id') id: string) {
    return this.attendanceService.getSessionById(id);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create an attendance session' })
  async createSession(@Body() dto: CreateAttendanceSessionDto) {
    return this.attendanceService.createSession(dto);
  }

  @Post('sessions/:id/mark')
  @ApiOperation({ summary: 'Mark attendance for a session' })
  async markAttendance(
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(id, dto);
  }

  @Put('sessions/:id')
  @ApiOperation({ summary: 'Update an attendance session' })
  async updateSession(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceSessionDto,
  ) {
    return this.attendanceService.updateSession(id, dto);
  }

  @Post('sessions/:id/subject-item/pass')
  @ApiOperation({ summary: 'Servant marks a student as PASSED for this session\'s subject item (reflects to parent portal, optional WhatsApp)' })
  async markSubjectPassed(
    @Param('id') id: string,
    @Body() body: { studentId: string },
    @Req() req: any,
  ) {
    return this.attendanceService.markSubjectPassed(id, body.studentId, req.user?.id);
  }

  @Post('sessions/:id/subject-item')
  @ApiOperation({ summary: 'Mark the delivered subject item in_progress/completed (creates a draft assessment + reports sessions used on completion)' })
  async markSubjectItem(
    @Param('id') id: string,
    @Body() body: { status: 'in_progress' | 'completed'; subjectItemId?: string },
  ) {
    return this.attendanceService.markSubjectItemStatus(id, body.status, body.subjectItemId);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete an attendance session (soft)' })
  async deleteSession(@Param('id') id: string) {
    return this.attendanceService.deleteSession(id);
  }

  @Post('sessions/batch-delete')
  @ApiOperation({ summary: 'Batch delete multiple attendance sessions (only scheduled status allowed)' })
  async batchDeleteSessions(@Body() body: { sessionIds: string[] }) {
    return this.attendanceService.batchDeleteSessions(body.sessionIds);
  }

  @Post('sessions/generate')
  @ApiOperation({ summary: 'Generate attendance sessions from active days (all or specific)' })
  async generateSessions(
    @Query('schoolId') schoolId: string = '',
    @Query('groupId') groupId?: string,
    @Query('levelId') levelId?: string,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.attendanceService.generateSessions(schoolId, { groupId, levelId, gradeId });
  }

  @Post('sessions/recurring')
  @ApiOperation({ summary: 'Create recurring weekly sessions' })
  async createRecurringSessions(
    @Req() req: any,
    @Body() body: { groupId: string; levelId: string; dayOfWeek: number; time: string; weeks?: number },
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.attendanceService.createRecurringSessions(req.user.id, schoolId, body);
  }

  @Put('sessions/:id/records/batch')
  @ApiOperation({ summary: 'Batch update attendance records' })
  async batchUpdateRecords(
    @Param('id') id: string,
    @Body() body: { updates: Array<{ studentId: string; status: string }> },
  ) {
    return this.attendanceService.batchUpdateRecords(id, body.updates);
  }

  @Put('sessions/:id/notes')
  @ApiOperation({ summary: 'Update session notes' })
  async updateSessionNotes(
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    return this.attendanceService.updateSessionNotes(id, body.notes);
  }

  @Post('qr-checkin')
  @ApiOperation({ summary: 'QR check-in — mark a student present by scanning their QR code' })
  async qrCheckIn(@Req() req: any, @Body() dto: QrCheckInDto) {
    return this.attendanceService.qrCheckIn(req.user.id, dto.studentId);
  }

  @Post('start-class')
  @ApiOperation({ summary: 'Start class for today — auto-detect group, pre-fill all present' })
  async startClass(@Req() req: any) {
    return this.attendanceService.startClass(req.user.id);
  }

  @Get('liturgy-heatmap')
  @ApiOperation({ summary: 'Get liturgy vs class attendance heatmap data' })
  async liturgyHeatmap(
    @Query('schoolId') schoolId: string = '',
    @Query('groupId') groupId?: string,
  ) {
    return this.attendanceService.liturgyHeatmap(schoolId, groupId);
  }
}
