import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [UsersController, RolesController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
