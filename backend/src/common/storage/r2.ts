import { BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { extname } from 'path';

const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET;
const ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

export const isR2Configured = !!(
  ACCOUNT_ID && BUCKET && ACCESS_KEY && SECRET_KEY && PUBLIC_URL
);

/**
 * What may be stored, and the content type each extension is served with. The type used to
 * come from the uploader's claimed MIME type, so an object named x.mp3 uploaded as text/html
 * was later served as a web page from the API origin. The extension is the only input the
 * server can trust here, so it alone decides the type and anything else is refused.
 */
const AUDIO_CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
};
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Audio content type for a key or URL path, or undefined when it is not a known audio extension. */
export function audioContentTypeForKey(key: string): string | undefined {
  return AUDIO_CONTENT_TYPES[extname(key).toLowerCase()];
}

/** Content type for any storable key (audio or image), or undefined when it may not be stored. */
export function storableContentTypeForKey(key: string): string | undefined {
  const ext = extname(key).toLowerCase();
  return AUDIO_CONTENT_TYPES[ext] ?? IMAGE_CONTENT_TYPES[ext];
}

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
  });
}

/**
 * True only for a URL this platform itself issued from uploadRecording — either the local
 * fallback path or an object under the configured R2 public base.
 *
 * Callers accept recording URLs from the client, and those URLs are later rendered as
 * audio sources in the servant review queue and the parent portal. An off-site URL there
 * is an attacker choosing what a servant's browser fetches, so it must be refused.
 */
export function isOwnedRecordingUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;

  // Local fallback: /uploads/audio/<filename>, no traversal.
  if (/^\/uploads\/audio\/[A-Za-z0-9._-]+$/.test(url)) return true;

  if (!PUBLIC_URL) return false;
  const base = `${PUBLIC_URL.replace(/\/$/, '')}/`;
  if (!url.startsWith(base)) return false;
  // Reject anything that tries to climb out of the prefix or smuggle a second URL.
  const key = url.slice(base.length);
  return /^[A-Za-z0-9/._-]+$/.test(key) && !key.includes('..');
}

/**
 * Store a file and return its URL. The content type is derived from the key's extension;
 * the third argument is accepted so existing callers compile, but it is ignored because it
 * is whatever the client claimed. A key with an extension that is not on the allowlist is refused.
 */
export async function uploadRecording(
  buffer: Buffer,
  key: string,
  _declaredContentType?: string,
): Promise<string> {
  const contentType = storableContentTypeForKey(key);
  if (!contentType) {
    throw new BadRequestException('Unsupported file type');
  }
  if (!isR2Configured) {
    const dir = join(process.cwd(), 'uploads', 'audio');
    await mkdir(dir, { recursive: true });
    const filename = key.split('/').pop()!;
    await writeFile(join(dir, filename), buffer);
    return `/uploads/audio/${filename}`;
  }
  // NOTE: R2 buckets have object ACLs disabled by default. Make the bucket
  // "Public" (bucket-level setting) so objects are readable via PUBLIC_URL.
  // Do NOT set an object-level ACL here — it errors on default R2 buckets.
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `${PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
}
