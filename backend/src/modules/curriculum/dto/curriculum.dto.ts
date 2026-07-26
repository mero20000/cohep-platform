import { IsString, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class CreateAllocationDto {
  @IsUUID() academicYearId: string;
  @IsUUID() levelId: string;
  @IsUUID() subjectId: string;
  @IsUUID() lessonId: string;
  @IsOptional() @IsInt() @Min(1) @Max(4) groupNumber?: number;
  @IsInt() @Min(1) @Max(3) term: number;
  @IsInt() @Min(0) weekNumber: number;
  @IsInt() @Min(0) orderIndex: number;
  @IsOptional() @IsString() scheduledDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAllocationDto {
  @IsOptional() @IsUUID() lessonId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) term?: number;
  @IsOptional() @IsInt() @Min(0) weekNumber?: number;
  @IsOptional() @IsString() weekId?: string;
  @IsOptional() @IsInt() @Min(0) orderIndex?: number;
  @IsOptional() @IsString() scheduledDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReorderAllocationDto {
  @IsString() allocationId: string;
  @IsInt() @Min(0) newOrderIndex: number;
  @IsInt() @Min(1) @Max(3) newTerm: number;
}
