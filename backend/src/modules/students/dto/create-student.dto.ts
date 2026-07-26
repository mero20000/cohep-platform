import { IsString, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudentDto {
  @ApiProperty({ example: 'Malak' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'ملك' })
  @IsString()
  @IsOptional()
  firstNameAr?: string;

  @ApiPropertyOptional({ example: 'أحمد' })
  @IsString()
  @IsOptional()
  lastNameAr?: string;

  @ApiProperty({ example: '2017-05-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: ['male', 'female'] })
  @IsEnum(['male', 'female'])
  gender: string;

  @ApiPropertyOptional({ example: 'St. Mary Coptic Orthodox Church' })
  @IsString()
  @IsOptional()
  churchName?: string;

  @ApiPropertyOptional({ example: 'Grade 4' })
  @IsString()
  @IsOptional()
  schoolGrade?: string;

  @ApiPropertyOptional({ example: '+201234567890' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'parent@example.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '123 Main St, Cairo' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Any additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Level ID' })
  @IsUUID()
  levelId: string;

  @ApiProperty({ description: 'Group ID' })
  @IsUUID()
  groupId: string;

  @ApiPropertyOptional({ description: 'Parent User ID' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ enum: ['father', 'mother', 'guardian'] })
  @IsEnum(['father', 'mother', 'guardian'])
  @IsOptional()
  parentRelationship?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'External church tool ID' })
  @IsString()
  @IsOptional()
  churchToolId?: string;

  @ApiPropertyOptional({ description: 'Parent login email — links this student to the parent dashboard' })
  @IsString()
  @IsOptional()
  parentEmail?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'graduated'] })
  @IsEnum(['active', 'inactive', 'graduated'])
  @IsOptional()
  status?: string;
}
