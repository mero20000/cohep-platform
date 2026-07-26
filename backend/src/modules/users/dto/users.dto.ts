import { IsEmail, IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'جون' })
  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @ApiPropertyOptional({ example: 'دو' })
  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  roleName?: string;

  @ApiPropertyOptional({ description: 'School UUID (super admin only)' })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'URL of the user avatar' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON metadata (teaching subjects, levelId, groupId, etc.)' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'جون' })
  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @ApiPropertyOptional({ example: 'دو' })
  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Password123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  roleName?: string;

  @ApiPropertyOptional({ description: 'School UUID (super admin only)' })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Activate or deactivate the user' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'URL of the user avatar' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON metadata (teaching subjects, levelId, groupId, etc.)' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateSchoolDto {
  @ApiProperty({ example: 'NiAngelos School' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'مدرسة نيأنجلوس' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'niangelos-school' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'uuid-of-church' })
  @IsOptional()
  @IsString()
  churchId?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'school@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateSchoolDto {
  @ApiPropertyOptional({ example: 'NiAngelos School' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'مدرسة نيأنجلوس' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'uuid-of-church' })
  @IsOptional()
  @IsString()
  churchId?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'school@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the school is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'جون' })
  @IsOptional()
  @IsString()
  firstNameAr?: string;

  @ApiPropertyOptional({ example: 'دو' })
  @IsOptional()
  @IsString()
  lastNameAr?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: '/uploads/avatars/abc123.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class SetSystemConfigDto {
  @ApiProperty({ example: 'grades' })
  @IsString()
  key: string;

  @ApiProperty({ example: [{ id: 'grade-1', name: 'Grade 1', status: 'active' }] })
  @IsOptional()
  value: any;

  @ApiPropertyOptional({ example: 'Grade levels configuration' })
  @IsOptional()
  @IsString()
  description?: string;
}
