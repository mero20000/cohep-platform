import { PartialType } from '@nestjs/mapped-types';
import { CreateAttendanceSessionDto } from './create-attendance-session.dto';

export class UpdateAttendanceSessionDto extends PartialType(CreateAttendanceSessionDto) {}
