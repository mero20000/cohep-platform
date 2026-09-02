import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private service: DashboardService,
    private notificationsService: NotificationsService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard stats' })
  async getStats(@Query('schoolId') schoolId: string = '') {
    return this.service.getStats(schoolId);
  }

  @Get('mine')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get dashboard scoped to the current user role' })
  async getMine(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
    @Query('viewRole') viewRole?: string,
  ) {
    return this.service.getMine(user, schoolId, viewRole);
  }

  @Get('leaderboard')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get top students by XP for parent leaderboard' })
  async getLeaderboard(
    @Query('schoolId') schoolId: string = '',
    @Query('limit') limit: string = '10',
  ) {
    return this.service.getParentLeaderboard(schoolId, Math.min(parseInt(limit, 10) || 10, 50));
  }

  @Get('servant-digest')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get the servant Monday morning digest — student story, class trend, milestone, absence alerts' })
  async getServantDigest(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.getServantDigest(user, schoolId);
  }

  @Get('practice-stats')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get weekly FamilyPractice counts per student for the servant groups' })
  async getPracticeStats(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.getPracticeStats(user, schoolId);
  }

  @Get('class-overview')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get servant class at-a-glance — roster, likely absent, follow-up, today lesson' })
  async getClassOverview(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.getClassOverview(user, schoolId);
  }

  @Get('weekly-briefing')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get servant weekly briefing — coptic context, next lesson, follow-up roster' })
  async getWeeklyBriefing(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.getWeeklyBriefing(user, schoolId);
  }

  @Post('absence-cascade')
  @Roles('admin', 'principal', 'super_admin')
  @ApiOperation({ summary: 'Run absence cascade — notify parents and servants of students with 3+ consecutive absences' })
  async runAbsenceCascade(
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.runAbsenceCascade(schoolId, this.notificationsService);
  }

  @Get('level-report')
  @Roles('level_leader', 'admin', 'principal', 'super_admin')
  @ApiOperation({ summary: 'Get level-wide aggregated reporting — attendance, assessments, mastery distribution' })
  async getLevelReport(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.getLevelReport(user, schoolId);
  }

  @Get('group-report')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get group-scoped reporting for servants — attendance, assessments, mastery distribution' })
  async getGroupReport(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.service.getGroupReport(user, schoolId);
  }
}
