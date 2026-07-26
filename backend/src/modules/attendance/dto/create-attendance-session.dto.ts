import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateAttendanceSessionDto {
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @IsUUID()
  servantId: string;

  @IsUUID()
  levelId: string;

  @IsUUID()
  groupId: string;

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

  @IsOptional()
  metadata?: Record<string, any>;
}
