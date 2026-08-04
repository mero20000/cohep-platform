import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsBatchDto } from './dto/analytics-batch.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Client analytics collector. Public + throttled: beacons/keepalive fetches
   * from both the servant dashboard and the student portal can't reliably carry
   * an auth header, and the payload is low-sensitivity screen/action telemetry.
   */
  @Post('events')
  @Public()
  @Throttle({ default: { limit: 180, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiBody({ type: AnalyticsBatchDto })
  async events(@Body() dto: AnalyticsBatchDto) {
    await this.analytics.recordBatch(dto);
    return { ok: true };
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @ApiBearerAuth()
  metrics() {
    return this.analytics.getMetrics();
  }
}