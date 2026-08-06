import {
  Controller, Get, Param, Post, Body, HttpCode, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { StudentLoginDto } from './dto/student-login.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('student-portal')
@Controller('student-portal')
@Public()
export class StudentPortalController {
  constructor(private readonly studentsService: StudentsService) {}

  private scopeSchoolId(user: any): string | undefined {
    if (!user) return undefined;
    // Super admin spans tenants; everyone else is confined to their own school.
    if (user.roles?.includes('super_admin')) return undefined;
    return user.schoolId;
  }

  @Post('login')
  @ApiOperation({ summary: 'Student login via unguessable portal access key — returns portal data' })
  async login(@Body() dto: StudentLoginDto) {
    return this.studentsService.getPortalData(dto.portalAccessKey);
  }

  @Get(':portalAccessKey')
  @ApiOperation({ summary: 'Get student portal data by portal access key' })
  async getPortal(@Param('portalAccessKey') portalAccessKey: string) {
    return this.studentsService.getPortalData(portalAccessKey);
  }
}
