import { Global, Module } from '@nestjs/common';
import { SchoolResolver } from './utils/school-resolver';

@Global()
@Module({
  providers: [SchoolResolver],
  exports: [SchoolResolver],
})
export class CommonModule {}
