import { Controller, Get, Param, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { StudentLoginDto } from './dto/student-login.dto';

@ApiTags('student-portal')
@Controller('student-portal')
export class StudentPortalController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post('login')
  @ApiOperation({ summary: 'Student login via student code — returns portal data' })
  async login(@Body() dto: StudentLoginDto) {
    return this.studentsService.getPortalData(dto.studentCode);
  }

  @Get(':studentCode')
  @ApiOperation({ summary: 'Get student portal data by student code' })
  async getPortal(@Param('studentCode') studentCode: string) {
    return this.studentsService.getPortalData(studentCode);
  }
}
