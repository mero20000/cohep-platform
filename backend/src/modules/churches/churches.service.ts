import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateChurchDto } from './dto/create-church.dto';
import { UpdateChurchDto } from './dto/update-church.dto';

@Injectable()
export class ChurchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.church.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { schools: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const church = await this.prisma.church.findFirst({
      where: { id, deletedAt: null },
      include: {
        schools: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });
    if (!church) throw new NotFoundException('Church not found');
    return church;
  }

  async create(dto: CreateChurchDto) {
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return this.prisma.church.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        slug,
        logoUrl: dto.logoUrl,
        schoolLogoUrl: dto.schoolLogoUrl,
        schoolNameEn: dto.schoolNameEn,
        schoolNameAr: dto.schoolNameAr,
        schoolNameCoptic: dto.schoolNameCoptic,
        country: dto.country,
        city: dto.city,
        locale: dto.defaultLanguage || 'en',
        timezone: dto.timezone || 'UTC',
      },
    });
  }

  async update(id: string, dto: UpdateChurchDto) {
    await this.findOne(id);
    return this.prisma.church.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.schoolLogoUrl !== undefined && { schoolLogoUrl: dto.schoolLogoUrl }),
        ...(dto.schoolNameEn !== undefined && { schoolNameEn: dto.schoolNameEn }),
        ...(dto.schoolNameAr !== undefined && { schoolNameAr: dto.schoolNameAr }),
        ...(dto.schoolNameCoptic !== undefined && { schoolNameCoptic: dto.schoolNameCoptic }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.defaultLanguage !== undefined && { locale: dto.defaultLanguage }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.church.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }
}
