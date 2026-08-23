import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GamificationService } from './gamification.service';
import { CreateBadgeDto, UpdateBadgeDto, AddXpDto } from './dto/gamification.dto';

@ApiTags('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // ── Leaderboard ─────────────────────────────────────────────────────────
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard' })
  async getLeaderboard(
    @Query('schoolId') schoolId: string = '',
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getLeaderboard(schoolId, limit ? parseInt(limit, 10) : 20);
  }

  @Delete('leaderboard')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reset leaderboard (Super Admin only)' })
  async resetLeaderboard(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.resetLeaderboard(schoolId);
  }

  // ── Badges ──────────────────────────────────────────────────────────────
  @Get('badges')
  @ApiOperation({ summary: 'Get all badges' })
  async getAllBadges(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.getAllBadges(schoolId);
  }

  @Post('badges')
  @ApiOperation({ summary: 'Create a badge' })
  async createBadge(
    @Req() req: any,
    @Query('schoolId') querySchoolId: string = '',
    @Body() dto: CreateBadgeDto,
  ) {
    const schoolId = dto.schoolId || querySchoolId || req.user?.schoolId || '';
    return this.gamificationService.createBadge({ ...dto, schoolId });
  }

  @Put('badges/:id')
  @ApiOperation({ summary: 'Update a badge' })
  async updateBadge(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
    return this.gamificationService.updateBadge(id, dto);
  }

  @Delete('badges/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete a badge (Super Admin only)' })
  async deleteBadge(@Param('id') id: string) {
    return this.gamificationService.deleteBadge(id);
  }

  // ── Seasonal badges ─────────────────────────────────────────────────────
  @Get('seasonal')
  @ApiOperation({ summary: 'Get current liturgical season badge info' })
  async getSeasonalBadgeStatus(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.getSeasonalBadgeStatus(schoolId);
  }

  @Post('seasonal/create')
  @ApiOperation({ summary: 'Create the current seasonal badge for the school' })
  async createSeasonalBadge(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.createSeasonalBadge(schoolId);
  }

  // ── Students ────────────────────────────────────────────────────────────
  @Get('students/:id/stats')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get student gamification stats' })
  async getStudentStats(@Param('id') id: string) {
    return this.gamificationService.getStudentStats(id);
  }

  @Get('students/:id/growth')
  @ApiOperation({ summary: 'Get personal growth mirror — trajectory without peer comparison' })
  async getPersonalGrowthMirror(@Param('id') id: string) {
    return this.gamificationService.getPersonalGrowthMirror(id);
  }

  @Get('students/:id/transactions')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get student XP transactions' })
  async getStudentTransactions(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.gamificationService.getStudentTransactions(
      id, skip ? parseInt(skip, 10) : 0, take ? parseInt(take, 10) : 50,
    );
  }

  @Get('students/:id/badges')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get student badges' })
  async getStudentBadges(@Param('id') id: string) {
    return this.gamificationService.getStudentBadges(id);
  }

  @Post('students/:id/badges')
  @ApiOperation({ summary: 'Award badge to student' })
  async awardBadge(@Param('id') id: string, @Body() body: { badgeId: string }) {
    return this.gamificationService.awardBadge(id, body.badgeId);
  }

  @Delete('students/:id/badges/:badgeStudentId')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Revoke badge from student (Super Admin only)' })
  async revokeBadge(@Param('id') _id: string, @Param('badgeStudentId') badgeStudentId: string) {
    return this.gamificationService.revokeBadge(badgeStudentId);
  }

  @Post('students/:id/xp')
  @ApiOperation({ summary: 'Add XP to student' })
  async addXp(@Param('id') id: string, @Body() dto: AddXpDto) {
    return this.gamificationService.addXp(id, dto.amount, dto.type, dto.description);
  }

  // ── Group trophies ──────────────────────────────────────────────────────
  @Get('groups/:id/trophy')
  @ApiOperation({ summary: 'Get group collective milestone trophy status' })
  async getGroupTrophy(
    @Param('id') groupId: string,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.gamificationService.getGroupTrophy(groupId, schoolId);
  }

  // ── Servant recognition ─────────────────────────────────────────────────
  @Get('servant/milestones')
  @ApiOperation({ summary: 'Get servant milestone achievements and recognition stats' })
  async getServantMilestones(
    @Req() req: any,
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
  ) {
    const targetUserId = userId || req.user?.id;
    return this.gamificationService.getServantMilestones(targetUserId, schoolId);
  }

  // ── Compute ─────────────────────────────────────────────────────────────
  @Post('compute/student/:id')
  @ApiOperation({ summary: 'Compute and auto-award badges for a student' })
  async computeBadgesForStudent(@Param('id') id: string) {
    return this.gamificationService.computeBadgesForStudent(id);
  }

  @Post('compute/school')
  @ApiOperation({ summary: 'Compute and auto-award badges for all students in a school' })
  async computeAllBadges(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.computeAllBadges(schoolId);
  }
}
