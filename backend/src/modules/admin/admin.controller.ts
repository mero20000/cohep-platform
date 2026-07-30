import { Controller, Get, Post, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { emailTemplate, emailParagraph } from '../mail/email-template';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('super_admin')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Get('pending-registrations')
  async getPendingRegistrations() {
    const schools = await this.prisma.school.findMany({
      where: { registrationStatus: 'pending' },
      include: {
        church: true,
        users: {
          where: { deletedAt: null },
          take: 1,
          select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return schools.map((s) => ({
      id: s.id,
      schoolName: s.name,
      churchName: s.church?.name || s.name,
      country: s.country,
      city: s.city,
      educationLanguage: s.educationLanguage,
      users: s.users,
      createdAt: s.createdAt,
    }));
  }

  @Post('pending-registrations/:id/approve')
  async approveRegistration(@Param('id') id: string) {
    const school = await this.prisma.school.update({
      where: { id },
      data: {
        registrationStatus: 'approved',
        isActive: true,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: { schoolId: id, deletedAt: null },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });

      try {
        const html = emailTemplate({
          title: 'Account Approved',
          content: `
            ${emailParagraph(`Your church registration for <strong>${school.name}</strong> has been approved.`)}
            ${emailParagraph('You can now log in to your account.')}
          `,
          cta: { text: 'Log In', url: '/auth/login' },
        });
        await this.mailService.sendMail(user.email, 'Your account has been approved', html);
      } catch {
        // email is optional
      }
    }

    return { message: 'Registration approved', school };
  }

  @Post('pending-registrations/:id/reject')
  async rejectRegistration(@Param('id') id: string) {
    const school = await this.prisma.school.update({
      where: { id },
      data: { registrationStatus: 'rejected' },
    });

    const user = await this.prisma.user.findFirst({
      where: { schoolId: id, deletedAt: null },
    });

    if (user) {
      try {
        const html = emailTemplate({
          title: 'Registration Update',
          variant: 'red',
          content: `
            ${emailParagraph(`We have reviewed your registration request for <strong>${school.name}</strong>.`)}
            ${emailParagraph('Unfortunately, we are unable to approve your request at this time. Please contact support for more information.')}
          `,
        });
        await this.mailService.sendMail(user.email, 'Your registration request', html);
      } catch {
        // email is optional
      }
    }

    return { message: 'Registration rejected' };
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
      data: { passwordHash },
    });
    return { message: `Password reset for ${email}` };
  }
}
