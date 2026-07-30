import { Controller, Get, Post, Delete, Body, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PushNotificationsService } from './push-notifications.service';

@ApiTags('push-notifications')
@Controller()
export class PushNotificationsController {
  constructor(
    private readonly pushService: PushNotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  getPublicKey() {
    return { key: this.config.get<string>('VAPID_PUBLIC_KEY') };
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  async subscribe(
    @Req() req: any,
    @Body() body: { endpoint: string; p256dh: string; auth: string },
    @Headers('user-agent') userAgent?: string,
  ) {
    const userId = req.user?.id || '';
    if (!userId) return { success: false, message: 'Not authenticated' };
    await this.pushService.subscribe(userId, body, userAgent);
    return { success: true };
  }

  @Delete('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  async unsubscribe(@Req() req: any, @Body() body: { endpoint: string }) {
    const userId = req.user?.id || '';
    await this.pushService.unsubscribe(userId, body.endpoint);
    return { success: true };
  }
}
