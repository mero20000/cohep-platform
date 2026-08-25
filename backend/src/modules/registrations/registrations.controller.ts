import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto, UpdateRegistrationDto, ReviewDto } from './dto/registration.dto';

@ApiTags('registrations')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Public()
  @Get(':schoolSlug/meta')
  @ApiOperation({ summary: 'Public: get school meta for registration form (levels, grades, groups)' })
  async getMeta(@Param('schoolSlug') schoolSlug: string) {
    return this.registrationsService.getMeta(schoolSlug);
  }

  @Public()
  @Post(':schoolSlug')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'voiceFile', maxCount: 1 }, { name: 'photoFile', maxCount: 1 }]))
  @ApiOperation({ summary: 'Public: submit registration (per school)' })
  async create(
    @Param('schoolSlug') schoolSlug: string,
    @Body() body: any,
    @UploadedFiles() files?: { voiceFile?: Express.Multer.File[]; photoFile?: Express.Multer.File[] },
  ) {
    // body may be JSON stringified studentData when multipart
    let dto: any = body;
    if (typeof body.studentData === 'string') {
      try { dto = { ...body, studentData: JSON.parse(body.studentData) }; } catch {}
    }
    return this.registrationsService.create(schoolSlug, dto, files);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'principal', 'group_leader', 'level_leader', 'servant', 'curriculum_manager')
  @ApiOperation({ summary: 'List registrations for a school' })
  async list(
    @Query('schoolId') schoolId: string,
    @Query('status') status: string | undefined,
    @Req() req: any,
  ) {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    return this.registrationsService.list(schoolId, status, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'principal', 'group_leader', 'level_leader', 'servant', 'curriculum_manager')
  async getOne(@Param('id') id: string, @Req() req: any) {
    return this.registrationsService.getOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'principal', 'group_leader', 'level_leader', 'servant', 'curriculum_manager')
  async update(@Param('id') id: string, @Body() dto: UpdateRegistrationDto, @Req() req: any) {
    return this.registrationsService.update(id, dto, req.user);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'principal', 'group_leader', 'level_leader', 'servant', 'curriculum_manager')
  async approve(@Param('id') id: string, @Body() dto: ReviewDto, @Req() req: any) {
    return this.registrationsService.approve(id, req.user, dto.levelId, dto.groupId, dto.gradeId);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'principal', 'group_leader', 'level_leader', 'servant', 'curriculum_manager')
  async reject(@Param('id') id: string, @Body() dto: ReviewDto, @Req() req: any) {
    return this.registrationsService.reject(id, req.user, dto.reason);
  }
}
