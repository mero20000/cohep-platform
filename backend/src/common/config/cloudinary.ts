import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

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
  return new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => {
      const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
      return {
        folder: `cohep/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        public_id: `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        format: ext,
      };
    },
  });
}
