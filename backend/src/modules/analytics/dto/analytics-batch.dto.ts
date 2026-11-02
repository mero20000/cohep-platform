import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
  IsObject,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Longest value kept for each free-text field; longer input is cut, not rejected. */
const truncate = (max: number) =>
  Transform(({ value }) => (typeof value === 'string' ? value.slice(0, max) : value));

export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_PROPERTIES_BYTES = 2048;

/** The value, serialised as JSON, must fit in `maxChars` characters. */
function MaxJsonSize(maxChars: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be at most ${maxChars} characters as JSON`, ...options },
      validator: {
        validate(value: unknown) {
          try {
            return JSON.stringify(value ?? null).length <= maxChars;
          } catch {
            return false;
          }
        },
      },
    });
}

export class AnalyticsEventDto {
  @truncate(100)
  @IsString()
  name!: string;

  @IsOptional()
  @truncate(50)
  @IsString()
  category?: string;

  @IsOptional()
  @IsObject()
  @MaxJsonSize(MAX_PROPERTIES_BYTES)
  properties?: Record<string, unknown>;
}

export class AnalyticsBatchDto {
  @truncate(64)
  @IsString()
  sessionId!: string;

  /** Accepted for older clients and ignored: the caller's identity comes from the access token. */
  @IsOptional()
  @IsString()
  userId?: string;

  /** Used only for anonymous callers (student portal, login page); must name a real school. */
  @IsOptional()
  @truncate(64)
  @IsString()
  schoolId?: string;

  @IsOptional()
  @truncate(16)
  @IsString()
  locale?: string;

  @IsOptional()
  @truncate(255)
  @IsString()
  entryPage?: string;

  @IsOptional()
  @truncate(255)
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
  @ArrayMaxSize(MAX_EVENTS_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events!: AnalyticsEventDto[];
}
