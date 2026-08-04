import { Controller, Get, Post, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Roles(...STAFF_ROLES, 'parent')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Users can only ever read their own notifications. A supplied userId is
  // only honored for super admins; everyone else is bound to their own id.
  private resolveUserId(request: Request, userId?: string): string {
    const user: any = (request as any).user;
    if (user?.roles?.includes('super_admin') && userId) return userId;
    return user?.id || '';
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for a user' })
  async findAll(
    @Req() request: Request,
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const resolvedUserId = this.resolveUserId(request, userId);
    return this.notificationsService.findUserNotifications(schoolId, resolvedUserId, page || 1, limit || 20);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(
    @Req() request: Request,
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
  ) {
    return this.notificationsService.getUnreadCount(schoolId, this.resolveUserId(request, userId));
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Req() request: Request,
    @Param('id') id: string,
    @Query('schoolId') schoolId: string = '',
  ) {
    const user: any = (request as any).user;
    return this.notificationsService.markAsRead(schoolId, id, user?.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a user' })
  async markAllAsRead(
    @Req() request: Request,
    @Query('schoolId') schoolId: string = '',
    @Query('userId') userId?: string,
  ) {
    return this.notificationsService.markAllAsRead(schoolId, this.resolveUserId(request, userId));
  }

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a notification (staff use)' })
  async create(@Body() body: any) {
    return this.notificationsService.createNotification(body);
  }
}
