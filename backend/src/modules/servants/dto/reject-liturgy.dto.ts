import { IsString, Length } from 'class-validator';

/**
 * A rejection reason is required, not optional.
 *
 * The whole problem with the old hard delete was that a family was left with no record and
 * no explanation. Accepting an empty reason would reproduce that outcome through a
 * different mechanism, so the servant has to say something.
 */
export class RejectLiturgyDto {
  @IsString()
  @Length(3, 300)
  reason: string;
}
