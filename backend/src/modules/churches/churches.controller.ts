import {
  Controller, Get, Post, Patch, Delete, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChurchesService } from './churches.service';
import { CreateChurchDto } from './dto/create-church.dto';
import { UpdateChurchDto } from './dto/update-church.dto';
import { Roles } from '../../common/decorators/roles.decorator';


@ApiTags('churches')
@Controller('churches')
export class ChurchesController {
  constructor(private readonly churchesService: ChurchesService) {}

  @Roles('super_admin', 'admin')
  @Get()
  @ApiOperation({ summary: 'Get all churches' })
  async findAll() {
    return this.churchesService.findAll();
  }

  @Roles('super_admin', 'admin')
  @Get(':id')
  @ApiOperation({ summary: 'Get church by ID' })
  async findOne(@Param('id') id: string) {
    return this.churchesService.findOne(id);
  }

  @Roles('super_admin')
  @Post()
  @ApiOperation({ summary: 'Create a church' })
  async create(@Body() dto: CreateChurchDto) {
    return this.churchesService.create(dto);
  }

  @Roles('super_admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a church' })
  async update(@Param('id') id: string, @Body() dto: UpdateChurchDto) {
    return this.churchesService.update(id, dto);
  }

  @Roles('super_admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a church (soft delete)' })
  async remove(@Param('id') id: string) {
    return this.churchesService.remove(id);
  }
}