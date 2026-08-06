import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('super_admin', 'admin', 'principal')
  @Get(':role/permissions')
  @ApiOperation({ summary: 'Get permission names for a role' })
  getRolePermissions(@Param('role') role: string) {
    return this.usersService.getRolePermissions(role);
  }

  @Roles('super_admin', 'admin')
  @Post(':role/permissions')
  @ApiOperation({ summary: 'Set permission names for a role' })
  setRolePermissions(
    @Param('role') role: string,
    @Body() body: { permissions: string[] },
    @CurrentUser() user: any,
  ) {
    return this.usersService.setRolePermissions(role, body?.permissions || [], user);
  }
}