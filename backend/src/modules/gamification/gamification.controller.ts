import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, UseGuards, BadRequestException, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GamificationService } from './gamification.service';
import { CreateBadgeDto, UpdateBadgeDto, AddXpDto, AmendXpDto, AmendXpTransactionDto, ResetStudentXpDto } from './dto/gamification.dto';

@ApiTags('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // ── Leaderboard ─────────────────────────────────────────────────────────
  @Get('leaderboard')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get leaderboard (parents get top3 + own children only)' })
  async getLeaderboard(
    @Req() req: any,
    @Query('schoolId') schoolId: string = '',
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getLeaderboard(schoolId, limit ? parseInt(limit, 10) : 20, req.user);
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
    // Only a super admin may create a badge for a school other than their own. For
    // everyone else the body/query school is ignored rather than trusted.
    const isSuperAdmin = req.user?.roles?.includes('super_admin');
    const schoolId = isSuperAdmin
      ? dto.schoolId || querySchoolId || req.user?.schoolId || ''
      : req.user?.schoolId || '';
    return this.gamificationService.createBadge({ ...dto, schoolId });
  }

  @Put('badges/:id')
  @ApiOperation({ summary: 'Update a badge' })
  async updateBadge(@Param('id') id: string, @Body() dto: UpdateBadgeDto, @Req() req: any) {
    return this.gamificationService.updateBadge(id, dto, req.user?.schoolId);
  }

  @Delete('badges/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete a badge (Super Admin only)' })
  async deleteBadge(@Param('id') id: string) {
    return this.gamificationService.deleteBadge(id);
  }

  @Get('badges/:id/students')
  @ApiOperation({ summary: 'Get all students who earned a badge' })
  async getBadgeStudents(@Param('id') id: string) {
    return this.gamificationService.getBadgeStudents(id);
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
  async awardBadge(@Param('id') id: string, @Body() body: { badgeId: string }, @Req() req: any) {
    return this.gamificationService.awardBadge(id, body.badgeId, req.user?.id);
  }

  @Delete('students/:id/badges/:badgeStudentId')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Revoke badge from student (Super Admin only)' })
  async revokeBadge(@Param('id') _id: string, @Param('badgeStudentId') badgeStudentId: string, @Req() req: any) {
    return this.gamificationService.revokeBadge(badgeStudentId, req.user?.id);
  }

  @Post('students/:id/xp')
  @ApiOperation({ summary: 'Add XP to student' })
  async addXp(@Param('id') id: string, @Body() dto: AddXpDto, @Req() req: any) {
    return this.gamificationService.addXp(id, dto.amount, dto.type, dto.description, req.user?.id);
  }

  @Get('students/:id/xp-info')
  @Roles('admin', 'servant', 'super_admin')
  @ApiOperation({ summary: 'Get student XP information and recent transactions' })
  async getStudentXpInfo(@Param('id') id: string) {
    return this.gamificationService.getStudentXpInfo(id);
  }

  @Put('students/:id/xp')
  @Roles('admin', 'servant', 'super_admin')
  @ApiOperation({ summary: 'Amend (adjust) student XP up or down' })
  async amendStudentXp(@Param('id') id: string, @Body() dto: AmendXpDto, @Req() req: any) {
    return this.gamificationService.amendStudentXp(id, dto.amount, dto.reason, req.user?.id);
  }

  @Get('students/:id/xp-ledger')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Full XP history for a student, with flags on XP from archived assessment attempts (admin)' })
  async getXpLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('skip') skip: string | undefined,
    @Query('take') take: string | undefined,
    @Req() req: any,
  ) {
    return this.gamificationService.getXpLedger(
      id, skip ? parseInt(skip, 10) : 0, take ? parseInt(take, 10) : 50, req.user,
    );
  }

  @Patch('students/:id/xp/transactions/:transactionId')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Correct the amount of one XP award (admin)' })
  async amendXpTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: AmendXpTransactionDto,
    @Req() req: any,
  ) {
    return this.gamificationService.amendXpTransaction(id, transactionId, dto.amount, dto.reason, req.user);
  }

  @Delete('students/:id/xp/transactions/:transactionId')
  @Roles('super_admin', 'admin', 'principal')
  @ApiOperation({ summary: 'Remove one XP award (admin)' })
  async deleteXpTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Query('reason') reason: string | undefined,
    @Req() req: any,
  ) {
    if (!reason || reason.trim().length < 3) throw new BadRequestException('A reason of at least 3 characters is required');
    return this.gamificationService.deleteXpTransaction(id, transactionId, reason.trim(), req.user);
  }

  @Delete('students/:id/xp')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Reset all XP for a student (Admin only)' })
  async deleteStudentXp(@Param('id') id: string, @Query('reason') reason?: string) {
    if (!reason) throw new BadRequestException('Reason is required');
    return this.gamificationService.deleteStudentXp(id, reason);
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

  // ── Reset Gamification (Super Admin Only) ────────────────────────────────
  @Delete('reset/student/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reset XP and badges for a student (Super Admin only)' })
  async resetStudentGamification(
    @Param('id') studentId: string,
    @Query('reason') reason?: string,
  ) {
    if (!reason) throw new BadRequestException('Reason is required');
    return this.gamificationService.resetStudentGamification(studentId, reason);
  }

  @Delete('reset/group/:groupId')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reset XP and badges for all students in a group (Super Admin only)' })
  async resetGroupGamification(
    @Param('groupId') groupId: string,
    @Query('reason') reason?: string,
  ) {
    if (!reason) throw new BadRequestException('Reason is required');
    return this.gamificationService.resetGroupGamification(groupId, reason);
  }

  @Delete('reset/school')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reset XP and badges for all students in a school (Super Admin only)' })
  async resetSchoolGamification(
    @Query('schoolId') schoolId: string = '',
    @Query('reason') reason?: string,
  ) {
    if (!reason) throw new BadRequestException('Reason is required');
    return this.gamificationService.resetSchoolGamification(schoolId, reason);
  }
}
