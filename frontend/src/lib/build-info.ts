/**
 * Build fingerprint (Vercel commit SHA, 7 chars). Rendered in Settings and
 * logged on boot so any bug report or console paste identifies exactly which
 * bundle is running — no more "is the new code live?" guessing.
 */
export const BUILD_SHA: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BUILD_SHA) || 'dev';

export const BUILD_LABEL: string =
  BUILD_SHA === 'dev' ? 'dev' : BUILD_SHA.slice(0, 7);
