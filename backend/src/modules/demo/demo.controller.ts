import { Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('session')
  async create(@Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return this.demo.mintGuestToken(Array.isArray(ip) ? ip[0] : ip);
  }
}
