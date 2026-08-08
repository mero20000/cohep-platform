import { IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryStudentDto {
  @IsString()
  @IsOptional()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Filter by level ID' })
  @IsUUID()
  @IsOptional()
  levelId?: string;

  @ApiPropertyOptional({ description: 'Filter by group ID' })
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'graduated', 'transferred'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by church name' })
  @IsString()
  @IsOptional()
  churchName?: string;

  @ApiPropertyOptional({ description: 'Filter by grade ID' })
  @IsUUID()
  @IsOptional()
  gradeId?: string;

  @ApiPropertyOptional({ enum: ['male', 'female'] })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: 'Search by name or code' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: ['name', 'code', 'age', 'gender', 'church', 'grade', 'status', 'level', 'group', 'createdAt'] })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsString()
  @IsOptional()
  sortDir?: string;
}
