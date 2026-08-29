import { IsString, IsOptional, IsUUID, IsInt, IsObject, Min, IsNotEmpty, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BadgeCriteriaDto {
  @IsString()
  rule: string;

  @IsOptional()
  count?: number;

  @IsOptional()
  weeks?: number;

  @IsOptional()
  points?: number;

  @IsOptional()
  percent?: number;

  @IsOptional()
  xp?: number;
}

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
  @ValidateNested()
  @Type(() => BadgeCriteriaDto)
  criteria?: BadgeCriteriaDto;

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
  @ValidateNested()
  @Type(() => BadgeCriteriaDto)
  criteria?: BadgeCriteriaDto;

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

export class AmendXpDto {
  @IsInt()
  amount: number;

  @IsString()
  @IsNotEmpty({ message: 'A reason for the amendment is required' })
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  reason: string;
}

export class ResetStudentXpDto {
  @IsString()
  @IsNotEmpty({ message: 'A confirmation reason is required' })
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  reason: string;
}
