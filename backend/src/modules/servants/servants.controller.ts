import { Controller, Get, Patch, Delete, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServantsService } from './servants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('servants')
@Controller('servants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServantsController {
  constructor(private readonly servantsService: ServantsService) {}

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

  @Delete('liturgy/:id')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject/delete a liturgy record' })
  async rejectLiturgy(@Param('id') id: string, @Req() req: any) {
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
}
