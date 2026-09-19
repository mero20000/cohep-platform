import { BadRequestException, Body, Controller, ForbiddenException, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { StudentNotificationsService } from './student-notifications.service';

@ApiTags('student-notifications')
@Controller('student-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentNotificationsController {
  constructor(
    private readonly studentNotifications: StudentNotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Send a note to a student (staff use)' })
  async sendNote(
    @CurrentUser() user: any,
    @Body() body: { studentId: string; title: string; titleAr?: string; body: string; bodyAr?: string },
  ) {
    if (!body?.studentId || !body?.title?.trim() || !body?.body?.trim()) {
      throw new BadRequestException('studentId, title and body are required');
    }
    const student = await this.prisma.student.findUnique({
      where: { id: body.studentId },
      select: { schoolId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!user?.roles?.includes('super_admin') && user?.schoolId && student.schoolId !== user.schoolId) {
      throw new ForbiddenException('Cannot send notes to students from another school');
    }
    const row = await this.studentNotifications.notify({
      studentId: body.studentId,
      type: 'note',
      title: body.title,
      titleAr: body.titleAr ?? null,
      body: body.body,
      bodyAr: body.bodyAr ?? null,
    });
    if (!row) throw new NotFoundException('Could not send note');
    return row;
  }
}
