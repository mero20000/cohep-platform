import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ example: 'amen_be_mawteka', enum: ['amen_be_mawteka', 'be_shafaat', 'both'] })
  @IsIn(['amen_be_mawteka', 'be_shafaat', 'both'])
  hymnChoice: string;

  @ApiProperty({ description: 'Student data JSON' })
  @IsObject()
  studentData: Record<string, any>;

  @ApiPropertyOptional({ description: 'Turnstile token' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class UpdateRegistrationDto {
  @ApiPropertyOptional({ enum: ['amen_be_mawteka', 'be_shafaat', 'both'] })
  @IsOptional()
  @IsIn(['amen_be_mawteka', 'be_shafaat', 'both'])
  hymnChoice?: string;

  @ApiPropertyOptional({ description: 'Student data JSON' })
  @IsOptional()
  @IsObject()
  studentData?: Record<string, any>;
}

export class ReviewDto {
  @ApiPropertyOptional({ example: 'level-uuid' })
  @IsOptional()
  @IsString()
  levelId?: string;

  @ApiPropertyOptional({ example: 'group-uuid' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ example: 'Grade uuid' })
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiPropertyOptional({ example: 'Incomplete info' })
  @IsOptional()
  @IsString()
  reason?: string;
}
