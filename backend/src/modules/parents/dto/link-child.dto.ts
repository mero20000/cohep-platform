import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkChildDto {
  @ApiProperty({ description: 'The student code printed on the child enrollment card' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiPropertyOptional({ description: 'Relationship to the child (e.g. father, mother, guardian)' })
  @IsOptional()
  @IsString()
  relationship?: string;
}
