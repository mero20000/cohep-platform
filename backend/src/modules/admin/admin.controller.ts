import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService, UpdateRegistrationInput } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('super_admin')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  @Get('registrations')
  async listRegistrations(@Query('status') status?: string) {
    return this.adminService.listAllRegistrations(status);
  }

  @Get('pending-registrations')
  async getPendingRegistrations() {
    return this.adminService.listAllRegistrations('pending');
  }

  @Patch('registrations/:id')
  async updateRegistration(@Param('id') id: string, @Body() body: UpdateRegistrationInput) {
    return this.adminService.updateRegistration(id, body);
  }

  @Post('registrations/:id/approve')
  async approveRegistration(@Param('id') id: string) {
    return this.adminService.approveRegistration(id);
  }

  @Post('registrations/:id/reject')
  async rejectRegistration(@Param('id') id: string) {
    return this.adminService.rejectRegistration(id);
  }

  // Back-compat aliases — the QA harness (docs/superpowers/tests/harness/admin.test.mjs AD-2)
  // and any external callers still hit the old pending-registrations paths.
  @Post('pending-registrations/:id/approve')
  async approveRegistrationLegacy(@Param('id') id: string) {
    return this.adminService.approveRegistration(id);
  }

  @Post('pending-registrations/:id/reject')
  async rejectRegistrationLegacy(@Param('id') id: string) {
    return this.adminService.rejectRegistration(id);
  }

  @Delete('registrations/:id')
  async deleteRegistration(@Param('id') id: string) {
    return this.adminService.softDeleteRegistration(id);
  }

  @Post('reset-password')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'servant@test.com' },
        newPassword: { type: 'string', example: 'Servant123!' },
      },
      required: ['email', 'newPassword'],
    },
  })
  async resetPassword(@Body('email') email: string, @Body('newPassword') newPassword: string) {
    if (!email || !newPassword) throw new BadRequestException('Email and newPassword are required');
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user) throw new BadRequestException('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    return { message: `Password reset for ${email}` };
  }
}
