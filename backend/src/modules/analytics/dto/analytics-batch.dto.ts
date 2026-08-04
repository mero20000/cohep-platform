import { IsString, IsOptional, IsArray, IsBoolean, IsInt, Max, Min, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsEventDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}

export class AnalyticsBatchDto {
  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  entryPage?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsBoolean()
  start?: boolean;

  @IsOptional()
  @IsBoolean()
  end?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  actionCount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events!: AnalyticsEventDto[];
}
