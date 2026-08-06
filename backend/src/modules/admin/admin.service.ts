import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { emailTemplate, emailParagraph } from '../mail/email-template';

export interface RegistrationListItem {
  id: string; schoolName: string; churchName: string;
  country?: string; city?: string; educationLanguage?: string;
  registrationStatus: string; isActive: boolean; createdAt: Date;
  users: { id: string; firstName: string; lastName: string; email: string; phone?: string; isActive: boolean }[];
}

export interface UpdateRegistrationInput {
  churchName?: string; country?: string; city?: string; educationLanguage?: string;
  admin?: { firstName?: string; lastName?: string; email?: string; phone?: string };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async listAllRegistrations(status?: string): Promise<RegistrationListItem[]> {
    const where: any = { deletedAt: null };
    if (status && status !== 'all') where.registrationStatus = status;

    const schools = await this.prisma.school.findMany({
      where,
      include: {
        church: true,
        users: { where: { deletedAt: null }, take: 1, orderBy: { createdAt: 'asc' as const } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return schools.map((s: any) => ({
      id: s.id,
      schoolName: s.name,
      churchName: s.church?.name || s.name,
      country: s.country,
      city: s.city,
      educationLanguage: s.educationLanguage,
      registrationStatus: s.registrationStatus,
      isActive: s.isActive,
      createdAt: s.createdAt,
      users: s.users.map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, isActive: u.isActive,
      })),
    }));
  }

  private async getSchoolOrFail(id: string): Promise<any> {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school || school.deletedAt) throw new NotFoundException('Registration not found');
    return school;
  }

  async updateRegistration(id: string, data: UpdateRegistrationInput): Promise<RegistrationListItem> {
    const school = await this.getSchoolOrFail(id);

    await this.prisma.$transaction(async (tx: any) => {
      if (data.churchName !== undefined || data.country !== undefined || data.city !== undefined) {
        await tx.church.update({
          where: { id: school.churchId },
          data: {
            ...(data.churchName !== undefined && { name: data.churchName, nameAr: data.churchName }),
            ...(data.country !== undefined && { country: data.country }),
            ...(data.city !== undefined && { city: data.city }),
          },
        });
        await tx.school.update({
          where: { id },
          data: {
            ...(data.churchName !== undefined && { name: data.churchName }),
            ...(data.country !== undefined && { country: data.country }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.educationLanguage !== undefined && { educationLanguage: data.educationLanguage }),
          },
        });
      } else if (data.educationLanguage !== undefined) {
        await tx.school.update({ where: { id }, data: { educationLanguage: data.educationLanguage } });
      }

      if (data.admin) {
        const user = await tx.user.findFirst({ where: { schoolId: id, deletedAt: null }, orderBy: { createdAt: 'asc' as const } });
        if (user) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              ...(data.admin.firstName !== undefined && { firstName: data.admin.firstName }),
              ...(data.admin.lastName !== undefined && { lastName: data.admin.lastName }),
              ...(data.admin.email !== undefined && { email: data.admin.email }),
              ...(data.admin.phone !== undefined && { phone: data.admin.phone }),
            },
          });
        }
      }
    });

    const updated = await this.prisma.school.findUnique({
      where: { id },
      include: { church: true, users: { where: { deletedAt: null }, take: 1, orderBy: { createdAt: 'asc' as const } } },
    });
    return this.toListItem(updated);
  }

  private toListItem(s: any): RegistrationListItem {
    const u = s.users && s.users[0];
    return {
      id: s.id, schoolName: s.name, churchName: s.church?.name || s.name,
      country: s.country, city: s.city, educationLanguage: s.educationLanguage,
      registrationStatus: s.registrationStatus, isActive: s.isActive, createdAt: s.createdAt,
      users: u ? [{ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, isActive: u.isActive }] : [],
    };
  }

  async approveRegistration(id: string) {
    const school = await this.getSchoolOrFail(id);
    await this.prisma.school.update({ where: { id }, data: { registrationStatus: 'approved', isActive: true } });

    const user = await this.prisma.user.findFirst({ where: { schoolId: id, deletedAt: null } });
    if (user) {
      await this.prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
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
      } catch {}
    }
    return { message: 'Registration approved' };
  }

  async rejectRegistration(id: string) {
    const school = await this.getSchoolOrFail(id);
    await this.prisma.school.update({ where: { id }, data: { registrationStatus: 'rejected', isActive: false } });

    const user = await this.prisma.user.findFirst({ where: { schoolId: id, deletedAt: null } });
    if (user) {
      await this.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
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
      } catch {}
    }
    return { message: 'Registration rejected' };
  }

  async softDeleteRegistration(id: string) {
    const school = await this.getSchoolOrFail(id);
    await this.prisma.$transaction(async (tx: any) => {
      const now = new Date();
      await tx.church.update({ where: { id: school.churchId }, data: { deletedAt: now } });
      await tx.school.update({ where: { id }, data: { deletedAt: now } });
      await tx.user.updateMany({ where: { schoolId: id, deletedAt: null }, data: { deletedAt: now } });
    });
    return { message: 'Registration deleted' };
  }
}
