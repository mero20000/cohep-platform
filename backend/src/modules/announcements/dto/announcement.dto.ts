import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsDateString,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsString()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bodyAr?: string;

  @IsOptional()
  @IsEnum(['normal', 'important', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  targetRoles?: string[];

  @IsOptional()
  @IsBoolean()
  targetSubscribers?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bodyAr?: string;

  @IsOptional()
  @IsEnum(['normal', 'important', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  targetRoles?: string[];

  @IsOptional()
  @IsBoolean()
  targetSubscribers?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
