import { v2 as cloudinary } from 'cloudinary';
import CloudinaryStorage from 'multer-storage-cloudinary';

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
  try {
    return new CloudinaryStorage({
      cloudinary,
      params: async (_req, file) => {
        try {
          const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
          const params = {
            folder: `cohep/${folder}`,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'webm', 'mp3', 'm4a', 'ogg', 'mp4', 'pdf'],
            public_id: `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            format: ext,
          };
          console.log('Cloudinary storage params:', params);
          return params;
        } catch (err) {
          console.error('Error in Cloudinary params handler:', err);
          throw err;
        }
      },
    });
  } catch (err) {
    console.error('Error creating Cloudinary storage:', err);
    throw new Error(`Failed to initialize Cloudinary storage: ${err instanceof Error ? err.message : String(err)}`);
  }
}
