import { v2 as cloudinary } from 'cloudinary';

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export { cloudinary, isCloudinaryConfigured };

export function createCloudinaryStorage(folder: string) {
  if (!isCloudinaryConfigured) {
    console.warn('Cloudinary not configured, falling back to disk storage');
    return null; // Return null, caller will use disk storage fallback
  }

  try {
    const CloudinaryStorage = require('multer-storage-cloudinary');
    return new CloudinaryStorage({
      cloudinary,
      // NOTE: multer-storage-cloudinary resolves params via run-parallel with
      // Node-style (req, file, cb) callbacks. An async function NEVER calls
      // back, so every upload hung forever with no error. Keep this callback
      // style — do not convert it to async/await.
      params: (_req: any, file: any, cb: (err: Error | null, params?: Record<string, unknown>) => void) => {
        try {
          const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
          cb(null, {
            folder: `cohep/${folder}`,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'webm', 'mp3', 'm4a', 'ogg', 'mp4', 'pdf'],
            public_id: `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            format: ext,
          });
        } catch (err) {
          console.error('Error in Cloudinary params handler:', err);
          cb(err as Error);
        }
      },
    });
  } catch (err) {
    console.error('Error creating Cloudinary storage:', err);
    throw new Error(`Failed to initialize Cloudinary storage: ${err instanceof Error ? err.message : String(err)}`);
  }
}
