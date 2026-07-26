import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Password must contain at least 8 characters, 1 uppercase letter, and 1 digit',
  })
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  firstNameAr?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  lastNameAr?: string;

  @ApiPropertyOptional({ example: 'niangelos-main' })
  @IsString()
  @IsOptional()
  schoolIdentifier?: string;

  @ApiProperty({ example: 'St. Mark Coptic Church' })
  @IsString()
  churchName: string;

  @ApiProperty({ example: 'Egypt' })
  @IsString()
  country: string;

  @ApiProperty({ example: 'Cairo' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  educationLanguage: string;

  @ApiProperty({ example: '+20123456789' })
  @IsString()
  mobileNumber: string;
}
