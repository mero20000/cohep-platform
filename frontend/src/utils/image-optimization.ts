// Image optimization utilities for Next.js ISR and lazy loading
export const getOptimizedImageUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'auto';
  } = {},
): string => {
  if (!url) return '';

  // For Cloudinary URLs, append optimization parameters
  if (url.includes('cloudinary')) {
    const { width = 640, quality = 80, format = 'auto' } = options;
    const params = `c_scale,w_${width},q_${quality},f_${format}`;
    return url.replace('/upload/', `/upload/${params}/`);
  }

  // For other URLs, return as-is (handled by Next.js Image Optimization)
  return url;
};

// Configuration for next/image ISR
export const IMAGE_REVALIDATE_SECONDS = 86400; // 1 day

// Common image dimensions
export const IMAGE_DIMENSIONS = {
  avatar: { width: 48, height: 48 },
  thumbnail: { width: 150, height: 150 },
  card: { width: 300, height: 300 },
  banner: { width: 1200, height: 400 },
  logo: { width: 200, height: 200 },
} as const;
