import { IsString, IsOptional, IsUUID, IsInt, Min, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class VerseDto {
  @ApiPropertyOptional({ example: 'Alleluia' })
  @IsOptional()
  @IsString()
  en?: string;

  @ApiPropertyOptional({ example: 'Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ' })
  @IsOptional()
  @IsString()
  cop?: string;

  @ApiPropertyOptional({ example: 'هلليلويا' })
  @IsOptional()
  @IsString()
  ar?: string;
}

export class PresentationDataDto {
  @ApiPropertyOptional({ example: 'both' })
  @IsOptional()
  @IsString()
  format?: string; // 'both' | 'en' | 'cop' | 'ar'

  @ApiPropertyOptional({ example: 'People' })
  @IsOptional()
  @IsString()
  speaker?: string;

  @ApiPropertyOptional({
    example: [
      { en: 'Alleluia', cop: 'Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ', ar: 'هلليلويا' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerseDto)
  verses?: VerseDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateLessonDto {
  @ApiProperty({ example: 'The Lord\'s Prayer' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'صلاة الرب' })
  @IsOptional()
  @IsString()
  titleAr?: string;

  @ApiPropertyOptional({ example: 'ⲡⲓⲙⲓⲛⲓ' })
  @IsOptional()
  @IsString()
  titleCoptic?: string;

  @ApiPropertyOptional({ example: 'A lesson about the Lord\'s Prayer' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'درس حول صلاة الرب' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ example: 'ⲡⲓⲙⲓⲛⲓ' })
  @IsOptional()
  @IsString()
  descriptionCoptic?: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  levelId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionsCount?: number;

  @ApiPropertyOptional({ example: 'published', default: 'published' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ example: '<div class="slide">...</div>' })
  @IsOptional()
  @IsString()
  presentationHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @Type(() => PresentationDataDto)
  presentationData?: PresentationDataDto;
}

export class ParseHtmlDto {
  @ApiProperty({ example: '<div>...</div>', description: 'Raw HTML from copticchurch.net' })
  @IsString()
  html: string;
}

export class UpdateLessonDto {
  @ApiPropertyOptional({ example: 'The Lord\'s Prayer' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'صلاة الرب' })
  @IsOptional()
  @IsString()
  titleAr?: string;

  @ApiPropertyOptional({ example: 'ⲡⲓⲙⲓⲛⲓ' })
  @IsOptional()
  @IsString()
  titleCoptic?: string;

  @ApiPropertyOptional({ example: 'A lesson about the Lord\'s Prayer' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'درس حول صلاة الرب' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ example: 'ⲡⲓⲙⲓⲛⲓ' })
  @IsOptional()
  @IsString()
  descriptionCoptic?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  levelId?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionsCount?: number;

  @ApiPropertyOptional({ example: 'published' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectItemId?: string;

  @ApiPropertyOptional({ example: '<div class="slide">...</div>' })
  @IsOptional()
  @IsString()
  presentationHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @Type(() => PresentationDataDto)
  presentationData?: PresentationDataDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioOriginalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  audioDuration?: number;
}
