import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(...STAFF_ROLES)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'List announcements' })
  async findAll(
    @Query('schoolId') schoolId: string = '',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('banner') banner?: string,
  ) {
    return this.announcementsService.findAll(schoolId, {
      page: page || 1,
      limit: limit || 20,
      status,
      priority,
      banner: banner === 'true',
    });
  }

  @Get(':id')
  @Roles(...STAFF_ROLES, 'parent')
  @ApiOperation({ summary: 'Get a single announcement' })
  async findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Post('draft')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate AI draft announcement from a topic prompt' })
  async draft(@Body('prompt') prompt: string) {
    if (!prompt?.trim()) throw new BadRequestException('Prompt is required');
    return this.announcementsService.draft(prompt);
  }

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create an announcement' })
  async create(@Body() dto: CreateAnnouncementDto, @Query('schoolId') schoolId: string = '', @CurrentUser() user: any) {
    return this.announcementsService.create(schoolId, dto, user?.id || '');
  }

  @Put(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update an announcement' })
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @Patch(':id/publish')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Publish an announcement' })
  async publish(@Param('id') id: string) {
    return this.announcementsService.publish(id);
  }

  @Delete(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Delete (soft) an announcement' })
  async remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }
}