import { IsUUID } from 'class-validator';

export class QrCheckInDto {
  @IsUUID()
  studentId: string;
}
