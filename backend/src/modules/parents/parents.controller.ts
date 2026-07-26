import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ParentsService } from './parents.service';
import { LinkChildDto } from './dto/link-child.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('parents')
@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('me/children')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get all children linked to the logged-in parent' })
  async getChildren(@Req() req: any) {
    return this.parentsService.getChildren(req.user.id);
  }

  @Post('me/children/link')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link a child to your account using the child student code' })
  async linkChild(@Body() dto: LinkChildDto, @Req() req: any) {
    return this.parentsService.linkChild(dto.studentCode, req.user.id, dto.relationship);
  }

  @Delete('me/children/:id')
  @HttpCode(200)
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink a child from your account' })
  async unlinkChild(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.unlinkChild(id, req.user.id);
  }

  @Get('me/children/:id')
  @Roles('parent', 'admin')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Student id' })
  @ApiOperation({ summary: 'Get details for a single linked child' })
  async getChild(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChild(id, req.user.id);
  }

  @Get('me/children/:id/attendance')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get attendance records for a specific child' })
  async getChildAttendance(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildAttendance(id, req.user.id);
  }

  @Get('me/children/:id/assessments')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get assessment results for a specific child' })
  async getChildAssessments(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildAssessments(id, req.user.id);
  }

  @Get('me/children/:id/progress')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'Get progress tracking for a specific child' })
  async getChildProgress(@Param('id') id: string, @Req() req: any) {
    return this.parentsService.getChildProgress(id, req.user.id);
  }
}
