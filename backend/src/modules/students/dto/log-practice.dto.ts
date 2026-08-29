import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * The practice endpoint's body was typed inline, so the global ValidationPipe had no
 * metatype to work with and skipped it entirely — a student could post an arbitrary
 * external recordingUrl (rendered as an audio source in the servant queue and the parent
 * view) and an arbitrary lessonId, including lessons belonging to other schools.
 *
 * The lessonId is validated as a UUID here; that it belongs to the student's own school
 * is enforced in HymnLearningService, which is the only place that knows the school.
 */
export class LogPracticeDto {
  @IsUUID()
  lessonId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  selfRating: number;

  /**
   * Must point at storage this platform owns. Rejecting off-site URLs is what stops the
   * servant review queue and the parent view from rendering an attacker-chosen source.
   */
  @IsOptional()
  @IsString()
  recordingUrl?: string;

  /**
   * 4 hours is far beyond any real practice session and well short of an overflow.
   * Zero is allowed: the skip-to-rating path logs a session with no recording.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4 * 60 * 60)
  durationSec?: number;
}
