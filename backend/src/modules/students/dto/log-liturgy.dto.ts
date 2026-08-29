import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A student filing their own liturgy attendance claim.
 *
 * Creation was parent-only, so a student who attended the liturgy had no way to say so —
 * one half of a loop whose other half (rejection) destroyed the record outright.
 */
export class LogLiturgyDto {
  /** ISO date. Normalised to midnight server-side, since the claim is per-day. */
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
