import { Controller, Get, Post, Body, Param, Query, ForbiddenException } from '@nestjs/common';
import { GradeDisputesService } from './grade-disputes.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('disputes')
export class GradeDisputesController {
  constructor(private readonly service: GradeDisputesService) {}

  @Post()
  @Roles('student', 'servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  async createDispute(
    @CurrentUser() user: any,
    @Body() body: { submissionId: string; reason: string }
  ) {
    return this.service.createDispute({
      schoolId: user.schoolId,
      submissionId: body.submissionId,
      requestedById: user.id,
      reason: body.reason,
    });
  }

  @Get()
  @Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  async listDisputes(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('limit') limit?: number
  ) {
    return this.service.listDisputes(user.schoolId, { status, limit });
  }

  @Post(':id/respond')
  @Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  async respondToDispute(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { response: string; newScore?: number }
  ) {
    return this.service.respondToDispute(id, {
      respondedById: user.id,
      response: body.response,
      newScore: body.newScore,
    });
  }

  @Get('pending/count')
  @Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
  async getPendingCount(@CurrentUser() user: any) {
    const count = await this.service.getPendingCount(user.schoolId);
    return { pending: count };
  }
}
