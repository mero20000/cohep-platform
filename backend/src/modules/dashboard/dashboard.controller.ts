import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Roles(...STAFF_ROLES)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

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
}
