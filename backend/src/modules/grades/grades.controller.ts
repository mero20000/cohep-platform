import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { GradesService } from './grades.service';
import { CreateGradeDto, UpdateGradeDto } from './dto/grades.dto';

@ApiTags('grades')
@Roles(...STAFF_ROLES)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all grades for a school' })
  getAll(@Query('schoolId') schoolId: string) {
    return this.gradesService.getGrades(schoolId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new grade' })
  create(@Query('schoolId') schoolId: string, @Body() dto: CreateGradeDto) {
    return this.gradesService.createGrade(schoolId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a grade (including status toggle and group reassignment)' })
  update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.updateGrade(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a grade (soft delete)' })
  remove(@Param('id') id: string) {
    return this.gradesService.deleteGrade(id);
  }
}
