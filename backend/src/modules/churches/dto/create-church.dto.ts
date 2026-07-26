import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChurchDto {
  @ApiProperty({ example: 'St. Mark Coptic Orthodox Church' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ description: 'URL-friendly slug' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ description: 'Church logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Hymns School logo URL' })
  @IsString()
  @IsOptional()
  schoolLogoUrl?: string;

  @ApiPropertyOptional({ example: 'School of Hymns and Praises' })
  @IsString()
  @IsOptional()
  schoolNameEn?: string;

  @ApiPropertyOptional({ example: 'مدرسة التراتيل والتسبيحات' })
  @IsString()
  @IsOptional()
  schoolNameAr?: string;

  @ApiPropertyOptional({ example: 'ⲙⲛⲧⲙⲏⲧⲟ ⲛ̀ⲛⲉϩⲟⲩⲛⲧ' })
  @IsString()
  @IsOptional()
  schoolNameCoptic?: string;

  @ApiPropertyOptional({ example: 'United States' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: 'Los Angeles' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'America/Los_Angeles' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsString()
  @IsOptional()
  defaultLanguage?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the church is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
