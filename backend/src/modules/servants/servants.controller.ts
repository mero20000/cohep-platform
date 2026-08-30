import { Controller, Get, Post, Patch, Delete, Param, Query, Req, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServantsService } from './servants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RejectLiturgyDto } from './dto/reject-liturgy.dto';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('servants')
@Controller('servants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServantsController {
  constructor(
    private readonly servantsService: ServantsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('super_admin', 'admin', 'principal', 'level_leader')
  @ApiOperation({ summary: 'List servant-role users (school-scoped)' })
  listServants(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('levelId') levelId?: string,
    @Query('groupId') groupId?: string,
    @Query('teachingSubject') teachingSubject?: string,
  ) {
    return this.servantsService.listServants(req.user, { search, role, levelId, groupId, teachingSubject });
  }

  @Get('liturgy-pending')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending liturgy verifications' })
  async getPendingLiturgies(@Req() req: any) {
    return this.servantsService.getPendingLiturgies(req.user.id);
  }

  @Patch('liturgy/:id/verify')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a liturgy record' })
  async verifyLiturgy(@Param('id') id: string, @Req() req: any) {
    return this.servantsService.verifyLiturgy(id, req.user.id);
  }

  @Patch('liturgy/:id/reject')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a liturgy record, recording a reason the family can see' })
  async rejectLiturgy(
    @Param('id') id: string,
    @Body() body: RejectLiturgyDto,
    @Req() req: any,
  ) {
    return this.servantsService.rejectLiturgy(id, req.user.id, body.reason);
  }

  /**
   * Retained so any client still issuing the old DELETE does not fail — but it no longer
   * deletes anything. It marks the claim rejected without a reason, which is worse for the
   * family than the PATCH above and is why the UI uses that instead.
   */
  @Delete('liturgy/:id')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deprecated — use PATCH liturgy/:id/reject. Rejects without a reason; never deletes.' })
  async rejectLiturgyLegacy(@Param('id') id: string, @Req() req: any) {
    return this.servantsService.rejectLiturgy(id, req.user.id);
  }

  @Get('group-mates')
  @Roles('servant', 'group_leader', 'level_leader')
  @ApiOperation({ summary: 'Get other servants in the same group as the caller' })
  async getGroupMates(@CurrentUser() user: any) {
    return this.servantsService.getGroupMates(user.id);
  }

  @Get(':id/profile')
  @Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  @ApiOperation({ summary: 'Get servant profile with ministry stats' })
  async getServantProfile(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const profile = await this.servantsService.getServantProfile(id, user.id);
    if (!profile) throw new NotFoundException('Servant not found');
    return profile;
  }

  @Get(':id/timeline')
  @Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  @ApiOperation({ summary: 'Get servant ministry timeline (private)' })
  async getServantTimeline(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.servantsService.getServantTimeline(id, user.id);
  }

  @Get('profile/me')
  @Roles('servant', 'group_leader', 'level_leader')
  @ApiOperation({ summary: 'Get current servant own profile' })
  async getMyProfile(@CurrentUser() user: any) {
    return this.servantsService.getMyServantProfile(user.id);
  }

  @Get('school/summary')
  @Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  @ApiOperation({ summary: 'Get all servant profiles for the school' })
  async getSchoolSummary(@CurrentUser() user: any) {
    return this.servantsService.getSchoolServantSummary(user.schoolId);
  }

  @Get('liturgy-session')
  @Roles('servant', 'group_leader', 'level_leader')
  @ApiOperation({ summary: 'Get current liturgy session with students for quick attendance marking' })
  async getLiturgySession(@CurrentUser() user: any) {
    const userMeta = (user.metadata as any) || {};
    const groupId = userMeta.groupId as string | undefined;
    const levelId = userMeta.levelId as string | undefined;

    if (!groupId && !levelId) {
      return { date: new Date().toISOString(), students: [] };
    }

    const students = await this.prisma.student.findMany({
      where: {
        ...(groupId ? { groupId } : {}),
        ...(levelId && !groupId ? { levelId } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
        photoUrl: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return {
      date: new Date().toISOString(),
      students: students.map(s => ({
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        firstNameAr: s.firstNameAr,
        lastNameAr: s.lastNameAr,
        photoUrl: s.photoUrl,
        status: null,
      })),
    };
  }

  @Post('liturgy-attendance')
  @Roles('servant', 'group_leader', 'level_leader')
  @ApiOperation({ summary: 'Record liturgy attendance for multiple students' })
  async recordLiturgyAttendance(
    @CurrentUser() user: any,
    @Body() body: { records: Array<{ studentId: string; status: 'present' | 'absent' }> },
  ) {
    const results = [];
    for (const record of body.records) {
      const attendanceRecord = await this.prisma.attendanceRecord.create({
        data: {
          studentId: record.studentId,
          status: record.status,
          recordedAt: new Date(),
          recordedBy: user.id,
          noteCategory: 'liturgy',
          note: null,
          isPrivateNote: false,
        },
      });
      results.push(attendanceRecord);
    }

    return { success: true, recorded: results.length };
  }
}
