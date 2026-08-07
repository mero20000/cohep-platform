import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateGradeDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsString() @IsNotEmpty() groupId: string;
}

export class UpdateGradeDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() status?: string;
}
