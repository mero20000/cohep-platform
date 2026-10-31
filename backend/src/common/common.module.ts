import { Global, Module } from '@nestjs/common';
import { SchoolResolver } from './utils/school-resolver';
import { AccessScopeService } from './access-scope.service';

@Global()
@Module({
  providers: [SchoolResolver, AccessScopeService],
  exports: [SchoolResolver, AccessScopeService],
})
export class CommonModule {}
