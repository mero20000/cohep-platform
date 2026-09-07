import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DemoService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async ensureDemoSchool(): Promise<string> {
    const school = await this.prisma.school.upsert({
      where: { slug: 'niangelos-demo' },
      update: {},
      create: {
        slug: 'niangelos-demo',
        name: 'COHEP Demo School',
        nameAr: 'مدرسة كوهيب التجريبية',
        churchId: (await this.prisma.church.findFirst({ select: { id: true } }))!.id,
        timezone: 'America/New_York',
        locale: 'en',
        isActive: true,
      },
    });
    return school.id;
  }

  async mintGuestToken(_ip: string): Promise<{ accessToken: string }> {
    const schoolId = await this.ensureDemoSchool();
    const payload = { sub: 'demo-guest', role: 'demo_viewer', schoolId, demo: true };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '30m' });
    return { accessToken };
  }
}
