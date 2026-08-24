import { IsString, IsOptional, IsUUID, IsInt, IsObject, Min, IsNotEmpty, MinLength } from 'class-validator';

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

  /**
   * Manual awards must carry a pastoral reason. It is stored with the
   * transaction and shown to parents, keeping encouragement transparent and
   * accountable (Module 1 guardrail).
   */
  @IsString()
  @IsNotEmpty({ message: 'A reason for the award is required' })
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  description: string;
}
