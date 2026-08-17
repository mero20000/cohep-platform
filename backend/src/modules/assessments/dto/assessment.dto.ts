import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsNumber,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type, Expose } from 'class-transformer';

export class CreateQuestionDto {
  @IsString()
  text: string;

  @IsEnum(['multiple_choice', 'true_false', 'short_answer', 'essay'])
  type: string;

  @IsOptional()
  @IsArray()
  options?: any;

  @IsString()
  correctAnswer: string;

  @IsInt()
  @Min(1)
  points: number;

  @IsInt()
  @Min(0)
  orderIndex: number;

  @IsOptional()
  @IsUUID()
  id?: string;
}

export class CreateAssessmentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['quiz', 'test', 'exam', 'oral', 'homework'])
  type?: string;

  @IsUUID()
  levelId: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsUUID()
  subjectId: string;

  @IsOptional()
  @IsString()
  referenceRecordingUrl?: string;

  @IsOptional()
  @IsString()
  referenceRecordingName?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  term?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsInt()
  @Min(1)
  totalPoints: number;

  @IsInt()
  @Min(1)
  passingPoints: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];

  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['quiz', 'test', 'exam', 'oral', 'homework'])
  type?: string;

  @IsOptional()
  @IsUUID()
  levelId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  referenceRecordingUrl?: string;

  @IsOptional()
  @IsString()
  referenceRecordingName?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  term?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalPoints: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  passingPoints: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];

  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class AnswerDto {
  @IsUUID()
  questionId: string;

  @IsString()
  answer: string;
}

export class SubmitAssessmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class AssignStudentsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];
}

export class MarkStudentDto {
  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(0)
  maxScore: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
