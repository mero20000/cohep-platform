import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(...STAFF_ROLES)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post('draft')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate AI draft announcement from a topic prompt' })
  async draft(@Body('prompt') prompt: string) {
    if (!prompt?.trim()) throw new BadRequestException('Prompt is required');
    return this.announcementsService.draft(prompt);
  }
}
