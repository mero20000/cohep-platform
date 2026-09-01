import { Type } from '@nestjs/common';
import { Transform } from 'class-transformer';

export const IS_BOOLEAN_STRING = 'string|boolean';

export class PrincipalPublishDto {
  @Type(() => Boolean)
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return false;
  })
  principalApproved?: boolean;

  @Transform(({ value }) => value || undefined)
  principalId?: string;
}
