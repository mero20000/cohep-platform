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

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
  });
}

export async function uploadRecording(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  if (!isR2Configured) {
    const dir = join(process.cwd(), 'uploads', 'audio');
    await mkdir(dir, { recursive: true });
    const filename = key.split('/').pop()!;
    await writeFile(join(dir, filename), buffer);
    return `/uploads/audio/${filename}`;
  }
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    }),
  );
  return `${PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
}
