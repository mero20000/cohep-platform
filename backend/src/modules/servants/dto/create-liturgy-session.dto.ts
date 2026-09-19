import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateLiturgySessionDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}
