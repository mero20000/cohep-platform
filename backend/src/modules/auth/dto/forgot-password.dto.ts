import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../common/utils/email';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'niangelos-main' })
  @IsOptional()
  @IsString()
  schoolIdentifier?: string;
}
