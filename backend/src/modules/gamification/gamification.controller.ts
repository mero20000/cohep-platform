import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { GamificationService } from './gamification.service';
import { CreateBadgeDto, UpdateBadgeDto, AddXpDto } from './dto/gamification.dto';


@ApiTags('gamification')
@Roles(...STAFF_ROLES)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

    @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard(
    @Query('schoolId') schoolId: string = '',
    @Query('limit') limit?: string,
  ) {
    return this.gamificationService.getLeaderboard(
      schoolId,
      limit ? parseInt(limit, 10) : 20,
    );
  }

    @Get('badges')
  @ApiOperation({ summary: 'Get all badges' })
  @ApiResponse({ status: 200, description: 'Badges retrieved successfully' })
  async getAllBadges(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.getAllBadges(schoolId);
  }

    @Post('badges')
  @ApiOperation({ summary: 'Create a badge' })
  @ApiResponse({ status: 201, description: 'Badge created successfully' })
  async createBadge(@Body() dto: CreateBadgeDto) {
    return this.gamificationService.createBadge(dto);
  }

    @Put('badges/:id')
  @ApiOperation({ summary: 'Update a badge' })
  @ApiResponse({ status: 200, description: 'Badge updated successfully' })
  async updateBadge(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
    return this.gamificationService.updateBadge(id, dto);
  }

    @Delete('badges/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete a badge (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Badge deleted successfully' })
  async deleteBadge(@Param('id') id: string) {
    return this.gamificationService.deleteBadge(id);
  }

    @Get('students/:id/stats')
  @ApiOperation({ summary: 'Get student gamification stats' })
  @ApiResponse({ status: 200, description: 'Student stats retrieved successfully' })
  async getStudentStats(@Param('id') id: string) {
    return this.gamificationService.getStudentStats(id);
  }

    @Get('students/:id/transactions')
  @ApiOperation({ summary: 'Get student XP transactions' })
  @ApiResponse({ status: 200, description: 'XP transactions retrieved successfully' })
  async getStudentTransactions(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.gamificationService.getStudentTransactions(id, skip ? parseInt(skip, 10) : 0, take ? parseInt(take, 10) : 50);
  }

    @Delete('leaderboard')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reset leaderboard (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Leaderboard reset successfully' })
  async resetLeaderboard(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.resetLeaderboard(schoolId);
  }

    @Get('students/:id/badges')
  @ApiOperation({ summary: 'Get student badges' })
  @ApiResponse({ status: 200, description: 'Student badges retrieved successfully' })
  async getStudentBadges(@Param('id') id: string) {
    return this.gamificationService.getStudentBadges(id);
  }

    @Post('students/:id/badges')
  @ApiOperation({ summary: 'Award badge to student' })
  @ApiResponse({ status: 201, description: 'Badge awarded successfully' })
  async awardBadge(
    @Param('id') id: string,
    @Body() body: { badgeId: string },
  ) {
    return this.gamificationService.awardBadge(id, body.badgeId);
  }

    @Delete('students/:id/badges/:badgeStudentId')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Revoke badge from student (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Badge revoked successfully' })
  async revokeBadge(
    @Param('id') _id: string,
    @Param('badgeStudentId') badgeStudentId: string,
  ) {
    return this.gamificationService.revokeBadge(badgeStudentId);
  }

    @Post('students/:id/xp')
  @ApiOperation({ summary: 'Add XP to student' })
  @ApiResponse({ status: 201, description: 'XP added successfully' })
  async addXp(
    @Param('id') id: string,
    @Body() dto: AddXpDto,
  ) {
    return this.gamificationService.addXp(id, dto.amount, dto.type, dto.description);
  }

    @Post('compute/student/:id')
  @ApiOperation({ summary: 'Compute and auto-award badges for a student' })
  @ApiResponse({ status: 200, description: 'Badges computed' })
  async computeBadgesForStudent(@Param('id') id: string) {
    return this.gamificationService.computeBadgesForStudent(id);
  }

    @Post('compute/school')
  @ApiOperation({ summary: 'Compute and auto-award badges for all students in a school' })
  @ApiResponse({ status: 200, description: 'Badges computed for all students' })
  async computeAllBadges(@Query('schoolId') schoolId: string = '') {
    return this.gamificationService.computeAllBadges(schoolId);
  }
}
