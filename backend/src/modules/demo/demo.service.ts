import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DemoService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async ensureDemoSchool(): Promise<string> {
    // The demo school must never attach to a real church — church.findFirst() would
    // grab whatever real church happens to exist first, mixing demo data into that
    // church's aggregates/listings. It gets its own dedicated church instead.
    const church = await this.prisma.church.upsert({
      where: { slug: 'niangelos-demo-church' },
      update: {},
      create: {
        slug: 'niangelos-demo-church',
        name: 'COHEP Demo Church',
        nameAr: 'كنيسة كوهيب التجريبية',
        timezone: 'America/New_York',
        locale: 'en',
      },
    });
    const school = await this.prisma.school.upsert({
      where: { slug: 'niangelos-demo' },
      // Self-heals a demo school created before this fix, which would have been
      // attached to whatever real church happened to exist first.
      update: { churchId: church.id },
      create: {
        slug: 'niangelos-demo',
        name: 'COHEP Demo School',
        nameAr: 'مدرسة كوهيب التجريبية',
        churchId: church.id,
        timezone: 'America/New_York',
        locale: 'en',
        isActive: true,
      },
    });
    return school.id;
  }

  async mintGuestToken(): Promise<{ accessToken: string }> {
    const schoolId = await this.ensureDemoSchool();
    const payload = { sub: 'demo-guest', role: 'demo_viewer', schoolId, demo: true, code: 'demo-guest' };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '30m' });
    return { accessToken };
  }
}
