import {
  IsArray, IsString, IsUUID, IsEnum, IsOptional, ValidateNested,
  IsNumber, Min, Max, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceRecordInputDto {
  @IsUUID()
  studentId: string;

  @IsEnum(['present', 'absent', 'late', 'excused', 'unmarked'])
  status: string;

  @IsEnum(['completed', 'partial', 'not_submitted', 'not_assigned'])
  @IsOptional()
  homeworkStatus?: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  behavior?: number;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  participation?: number;

  @IsBoolean()
  @IsOptional()
  attendedLiturgy?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}

export class MarkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordInputDto)
  records: AttendanceRecordInputDto[];

  @IsUUID()
  recordedBy: string;
}
