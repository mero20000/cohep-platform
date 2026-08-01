import { IsString, IsOptional, IsUUID, IsInt, IsObject, Min } from 'class-validator';

export class UpdateBadgeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsObject()
  criteria?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;
}

export class CreateBadgeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsObject()
  criteria?: Record<string, any>;

  @IsInt()
  @Min(0)
  points: number;

  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class AwardBadgeDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  badgeId: string;
}

export class AddXpDto {
  @IsInt()
  amount: number;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;
}
