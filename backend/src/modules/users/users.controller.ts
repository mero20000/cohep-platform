import { Controller, Get, Post, Patch, Delete, Param, Query, Body, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, CreateSchoolDto, UpdateSchoolDto, SetSystemConfigDto } from './dto/users.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('super_admin', 'admin', 'principal')
  @Get()
  @ApiOperation({ summary: 'List users (optionally filtered by school)' })
  listUsers(
    @CurrentUser() user: any,
    @Query('schoolId') schoolId?: string,
    @Query('role') role?: string,
    @Query('roleIn') roleIn?: string,
    @Query('groupId') groupId?: string,
    @Query('levelId') levelId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.listUsers(user, schoolId, { role, roleIn, groupId, levelId, search, isActive });
  }

  @Roles('super_admin', 'admin', 'principal')
  @Get('roles')
  @ApiOperation({ summary: 'List all roles' })
  listRoles() {
    return this.usersService.listRoles();
  }

  @Roles('super_admin', 'admin', 'principal')
  @Get('permissions')
  @ApiOperation({ summary: 'List all permissions' })
  listPermissions() {
    return this.usersService.listPermissions();
  }

  @Roles('super_admin', 'admin', 'principal')
  @Get('schools')
  @ApiOperation({ summary: 'List schools (scoped to user role)' })
  listSchools(@CurrentUser() user: any) {
    return this.usersService.listSchools(user);
  }

  @Roles('super_admin', 'admin')
  @Post('schools')
  @ApiOperation({ summary: 'Create a new school' })
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.usersService.createSchool(dto);
  }

  // Any authenticated user can fetch their own school's identity (name/logo),
  // so student-facing roles (parent, servant, ...) show the real branding too.
  // Must be declared before 'schools/:id' so the literal 'me' isn't captured
  // by the ':id' param route.
  @Get('schools/me')
  @ApiOperation({ summary: 'Get the current user\'s school identity' })
  getMySchool(@CurrentUser() user: any) {
    if (!user?.schoolId) throw new NotFoundException('School not found for user');
    return this.usersService.getSchool(user.schoolId);
  }

  @Roles('super_admin', 'admin', 'principal')
  @Get('schools/:id')
  @ApiOperation({ summary: 'Get a school by ID' })
  getSchool(@Param('id') id: string) {
    return this.usersService.getSchool(id);
  }

  @Roles('super_admin', 'admin')
  @Patch('schools/:id')
  @ApiOperation({ summary: 'Update a school' })
  updateSchool(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.usersService.updateSchool(id, dto);
  }

  @Roles('super_admin', 'admin')
  @Delete('schools/:id')
  @ApiOperation({ summary: 'Delete a school (soft delete)' })
  deleteSchool(@Param('id') id: string) {
    return this.usersService.deleteSchool(id);
  }

  @Roles('super_admin', 'admin', 'principal')
  @Get('schools/:id/config')
  @ApiOperation({ summary: 'Get system config for a school' })
  getSystemConfig(@Param('id') schoolId: string, @Query('key') key?: string) {
    return this.usersService.getSystemConfig(schoolId, key);
  }

  @Roles('super_admin', 'admin')
  @Post('schools/:id/config')
  @ApiOperation({ summary: 'Set system config for a school' })
  setSystemConfig(@Param('id') schoolId: string, @Body() dto: SetSystemConfigDto) {
    return this.usersService.setSystemConfig(schoolId, dto.key, dto.value, dto.description);
  }

  @Roles('super_admin', 'admin')
  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  createUser(
    @CurrentUser() user: any,
    @Body() dto: CreateUserDto,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.usersService.createUser(user, schoolId, dto);
  }

  @Roles('super_admin', 'admin', 'principal')
  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  getUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.getUser(id, user);
  }

  @Roles('super_admin', 'admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.updateUser(id, dto, user);
  }

  @Roles('super_admin', 'admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a user' })
  deleteUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.deleteUser(id, user);
  }

  @Roles('super_admin', 'admin')
  @Post(':id/roles/:roleName')
  @ApiOperation({ summary: 'Assign a role to a user' })
  assignRole(@Param('id') userId: string, @Param('roleName') roleName: string, @CurrentUser() user: any) {
    return this.usersService.assignRole(userId, roleName, user);
  }

  @Roles('super_admin', 'admin')
  @Delete(':id/roles/:roleName')
  @ApiOperation({ summary: 'Remove a role from a user' })
  removeRole(@Param('id') userId: string, @Param('roleName') roleName: string, @CurrentUser() user: any) {
    return this.usersService.removeRole(userId, roleName, user);
  }
}
