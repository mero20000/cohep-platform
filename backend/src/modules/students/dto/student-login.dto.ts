import { IsString, MinLength } from 'class-validator';

export class StudentLoginDto {
  @IsString()
  @MinLength(8, { message: 'Access key looks too short' })
  portalAccessKey: string;
}
