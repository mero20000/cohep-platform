import {
  Controller, Get, Param, Post, Body, HttpCode, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { StudentLoginDto } from './dto/student-login.dto';

@ApiTags('student-portal')
@Controller('student-portal')
export class StudentPortalController {
  constructor(private readonly studentsService: StudentsService) {}

  private scopeSchoolId(user: any): string | undefined {
    if (!user) return undefined;
    // Super admin spans tenants; everyone else is confined to their own school.
    if (user.roles?.includes('super_admin')) return undefined;
    return user.schoolId;
  }

  @Post('login')
  @ApiOperation({ summary: 'Student login via student code — returns portal data' })
  async login(@Body() dto: StudentLoginDto, @Req() request: Request) {
    const user: any = (request as any).user;
    return this.studentsService.getPortalData(dto.studentCode, this.scopeSchoolId(user));
  }

  @Get(':studentCode')
  @ApiOperation({ summary: 'Get student portal data by student code' })
  async getPortal(@Param('studentCode') studentCode: string, @Req() request: Request) {
    const user: any = (request as any).user;
    return this.studentsService.getPortalData(studentCode, this.scopeSchoolId(user));
  }
}
