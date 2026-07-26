import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SchoolResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(schoolIdentifier: string): Promise<string> {
    if (!schoolIdentifier) throw new BadRequestException('schoolId is required');
    if (schoolIdentifier.includes('-') && schoolIdentifier.length > 30) return schoolIdentifier;
    const school = await this.prisma.school.findFirst({ where: { slug: schoolIdentifier }, select: { id: true } });
    return school?.id || schoolIdentifier;
  }
}