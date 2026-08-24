import { IsOptional, IsString } from 'class-validator';

export class ToggleSubjectItemPassDto {
  @IsOptional()
  @IsString()
  note?: string;
}
