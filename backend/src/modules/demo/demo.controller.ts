import { Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('session')
  async create() {
    // Rate-limited by the @Throttle guard above (5/hour); no per-IP keying.
    return this.demo.mintGuestToken();
  }
}
