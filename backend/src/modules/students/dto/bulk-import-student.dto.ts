import { IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class BulkStudentItem {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() dateOfBirth: string;
  @IsString() gender: string;
  @IsString() levelId: string;
  @IsString() groupId: string;
  @IsOptional() @IsString() firstNameAr?: string;
  @IsOptional() @IsString() lastNameAr?: string;
  @IsOptional() @IsString() churchName?: string;
  @IsOptional() @IsString() schoolGrade?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() churchToolId?: string;
}

export class BulkImportStudentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStudentItem)
  students: BulkStudentItem[];
}
