import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('priest-pulse')
  @ApiOperation({ summary: '30-second priest pulse — attendance, at-risk students, pending grading, XP, family practice' })
  async getPriestPulse(@Query('schoolId') schoolId: string = '') {
    return this.reportsService.getPriestPulse(schoolId);
  }

  @Get('liturgical-engagement')
  @ApiOperation({ summary: 'Liturgical season engagement — attendance and XP overlaid on the Coptic calendar' })
  async getLiturgicalEngagement(@Query('schoolId') schoolId: string = '') {
    return this.reportsService.getLiturgicalEngagementReport(schoolId);
  }

  @Get('servant-contributions')
  @ApiOperation({ summary: 'Servant contribution report — appreciation-framed, not performance-review' })
  async getServantContributions(@Query('schoolId') schoolId: string = '') {
    return this.reportsService.getServantContributions(schoolId);
  }

  @Get('diocese')
  @ApiOperation({ summary: 'Diocese dashboard — all schools under a church with health scores' })
  async getDioceseDashboard(@Query('churchId') churchId: string = '') {
    return this.reportsService.getDioceseReport();
  }
}
