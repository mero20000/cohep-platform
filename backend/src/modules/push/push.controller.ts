import { Body, Controller, Delete, Get, Headers, NotFoundException, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push-subscribe.dto';
import { PushService } from './push.service';

@ApiTags('push')
@Controller()
export class PushController {
  constructor(private readonly push: PushService) {}

  // The public key is public by design (it is sent to every browser that subscribes).
  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'VAPID public key for Web Push subscriptions' })
  getPublicKey() {
    const key = this.push.getPublicKey();
    if (!key) throw new NotFoundException('Push notifications are not enabled');
    return { key };
  }

  @Roles(...STAFF_ROLES, 'parent')
  @Post('push/subscribe')
  @ApiOperation({ summary: 'Register this browser for push notifications' })
  subscribe(
    @CurrentUser() user: { id: string; schoolId: string },
    @Body() dto: PushSubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(user, dto, userAgent);
  }

  @Roles(...STAFF_ROLES, 'parent')
  @Delete('push/subscribe')
  @ApiOperation({ summary: 'Stop push notifications on this browser' })
  unsubscribe(@CurrentUser() user: { id: string }, @Query() dto: PushUnsubscribeDto) {
    return this.push.unsubscribe(user.id, dto.endpoint);
  }
}
