import { Controller, Get, Patch, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServantsService } from './servants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';

@ApiTags('servants')
@Controller('servants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServantsController {
  constructor(private readonly servantsService: ServantsService) {}

  @Get('liturgy-pending')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending liturgy verifications' })
  async getPendingLiturgies(@Req() req: any) {
    return this.servantsService.getPendingLiturgies(req.user.id);
  }

  @Patch('liturgy/:id/verify')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a liturgy record' })
  async verifyLiturgy(@Param('id') id: string, @Req() req: any) {
    return this.servantsService.verifyLiturgy(id, req.user.id);
  }

  @Delete('liturgy/:id')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject/delete a liturgy record' })
  async rejectLiturgy(@Param('id') id: string, @Req() req: any) {
    return this.servantsService.rejectLiturgy(id, req.user.id);
  }
}
