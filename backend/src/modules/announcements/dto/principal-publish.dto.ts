import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class PrincipalPublishDto {
  @IsOptional()
  @IsBoolean()
  principalApproved?: boolean;

  @IsOptional()
  @IsString()
  principalId?: string;
}
