import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SESSION_TYPES } from '../attendance-targets';

export class SessionTargetDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  @IsOptional()
  levelId?: string;

  @IsUUID()
  @IsOptional()
  gradeId?: string;

  @IsIn(['male', 'female', 'both'])
  @IsOptional()
  gender?: string;
}

export class CreateAttendanceSessionDto {
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  // Defaults to the authenticated user for liturgy/event sessions.
  @IsUUID()
  @IsOptional()
  servantId?: string;

  @IsUUID()
  @IsOptional()
  levelId?: string;

  @IsUUID()
  @IsOptional()
  groupId?: string;

  @IsUUID()
  @IsOptional()
  gradeId?: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  @IsOptional()
  scheduledTime?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  schoolId?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  /** class (default) | liturgy | event */
  @IsIn([...SESSION_TYPES])
  @IsOptional()
  type?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  titleAr?: string;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  location?: string;

  /** Liturgy/event only: the audience is every active group in the school. */
  @IsBoolean()
  @IsOptional()
  allGroups?: boolean;

  /** Liturgy/event only: one or more groups (optionally narrowed by level/grade/gender). */
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SessionTargetDto)
  @IsOptional()
  targets?: SessionTargetDto[];

  /** Create the session already in progress, dated today (on-the-spot liturgy/event). */
  @IsBoolean()
  @IsOptional()
  startNow?: boolean;
}
