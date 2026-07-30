import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnnouncementsService } from './announcements.service';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post('draft')
  @ApiOperation({ summary: 'Generate AI draft announcement from a topic prompt' })
  async draft(@Body('prompt') prompt: string) {
    if (!prompt?.trim()) throw new BadRequestException('Prompt is required');
    return this.announcementsService.draft(prompt);
  }
}
