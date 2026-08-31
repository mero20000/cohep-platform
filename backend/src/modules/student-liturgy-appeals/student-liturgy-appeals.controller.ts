import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { StudentLiturgyAppealsService } from './student-liturgy-appeals.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('appeals/liturgy')
@UseGuards(JwtAuthGuard)
export class StudentLiturgyAppealsController {
  constructor(private readonly service: StudentLiturgyAppealsService) {}

  @Post()
  async createAppeal(
    @CurrentUser() user: any,
    @Body() body: { studentId: string; familyLiturgyId: string; appealReason: string }
  ) {
    return this.service.createAppeal({
      schoolId: user.schoolId,
      studentId: body.studentId,
      familyLiturgyId: body.familyLiturgyId,
      appealReason: body.appealReason,
    });
  }

  @Get()
  async listAppeals(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: number
  ) {
    return this.service.listAppeals(user.schoolId, { status, studentId, limit });
  }

  @Post(':id/respond')
  async respondToAppeal(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { response: string; newStatus?: string }
  ) {
    return this.service.respondToAppeal(id, {
      respondedById: user.id,
      response: body.response,
      newStatus: body.newStatus,
    });
  }

  @Get('pending/count')
  async getPendingCount(@CurrentUser() user: any) {
    const count = await this.service.getPendingCount(user.schoolId);
    return { pending: count };
  }
}
