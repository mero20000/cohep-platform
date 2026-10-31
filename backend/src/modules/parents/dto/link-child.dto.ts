import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkChildDto {
  @ApiProperty({ description: 'The student code printed on the child enrollment card' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiProperty({ description: "The child's date of birth, YYYY-MM-DD. Must match the enrollment record.", example: '2015-04-23' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be in YYYY-MM-DD format' })
  dateOfBirth: string;

  @ApiPropertyOptional({ description: 'Relationship to the child (e.g. father, mother, guardian)' })
  @IsOptional()
  @IsString()
  relationship?: string;
}
