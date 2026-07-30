import { IsString } from 'class-validator';

export class StudentLoginDto {
  @IsString()
  studentCode: string;
}
