import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { GradeDisputesService } from './grade-disputes.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class GradeDisputesController {
  constructor(private readonly service: GradeDisputesService) {}

  @Post()
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
  async listDisputes(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('limit') limit?: number
  ) {
    return this.service.listDisputes(user.schoolId, { status, limit });
  }

  @Post(':id/respond')
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
  async getPendingCount(@CurrentUser() user: any) {
    const count = await this.service.getPendingCount(user.schoolId);
    return { pending: count };
  }
}
