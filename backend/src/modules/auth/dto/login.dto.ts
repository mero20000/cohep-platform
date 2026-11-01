import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../common/utils/email';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'niangelos-main' })
  @IsOptional()
  @IsString()
  schoolIdentifier?: string;
}
