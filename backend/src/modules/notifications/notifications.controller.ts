import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Roles(...STAFF_ROLES, 'parent')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
  @ApiOperation({ summary: 'List notifications for a user' })
  async findAll(
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.findUserNotifications(schoolId, userId || '', page || 1, limit || 20);
  }

    @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
  ) {
    return this.notificationsService.getUnreadCount(schoolId, userId || '');
  }

    @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @Query('schoolId') schoolId: string = '',
  ) {
    return this.notificationsService.markAsRead(schoolId, id);
  }

    @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a user' })
  async markAllAsRead(
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
  ) {
    return this.notificationsService.markAllAsRead(schoolId, userId || '');
  }

    @Post()
  @ApiOperation({ summary: 'Create a notification (internal use)' })
  async create(@Body() body: any) {
    return this.notificationsService.createNotification(body);
  }
}
