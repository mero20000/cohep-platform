import {
  Controller, Post, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { readFile, unlink } from 'fs/promises';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { createCloudinaryStorage, isCloudinaryConfigured } from '../../common/config/cloudinary';

// SVG is intentionally excluded: it executes scripts when served inline
// (stored XSS). Only raster image formats are accepted for uploads.
const ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const PPTX_MAX_SIZE = 50 * 1024 * 1024; // 50MB

const MAGIC_BYTES: Record<string, string[]> = {
  '.jpg': ['ffd8ff'],
  '.jpeg': ['ffd8ff'],
  '.png': ['89504e470d0a1a0a'],
  '.gif': ['47494638'],
  '.webp': ['52494646'],
};

function sniffImageMagic(buf: Buffer, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return false;
  const hex = buf.subarray(0, 12).toString('hex');
  return signatures.some((sig) => hex.startsWith(sig));
}

function createImageFileFilter() {
  return (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      cb(new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`), false);
      return;
    }
    cb(null, true);
  };
}

async function validateImageContent(fullPath: string, filename: string): Promise<void> {
  const ext = extname(filename).toLowerCase();
  const buf = await readFile(fullPath);
  if (!sniffImageMagic(buf, ext)) {
    await unlink(fullPath).catch(() => undefined);
    throw new BadRequestException('File content does not match its declared type');
  }
}

function imageStorage(subfolder: string) {
  if (isCloudinaryConfigured) {
    return createCloudinaryStorage(subfolder);
  }
  return diskStorage({
    destination: join(__dirname, '..', '..', '..', 'uploads', subfolder),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${subfolder === 'church-logos' ? '' : `${subfolder}-`}${uuid()}${ext}`);
    },
  });
}

function uploadResult(file: Express.Multer.File, subfolder: string, filename?: string): { url: string } {
  if (isCloudinaryConfigured && file.path) {
    return { url: file.path };
  }
  const fname = filename || file.filename;
  return { url: `/uploads/${subfolder}/${fname}` };
}

@Roles(...STAFF_ROLES)
@Controller('upload')
export class UploadController {
  @Post('church-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (() => {
        if (isCloudinaryConfigured) return createCloudinaryStorage('church-logos');
        return diskStorage({
          destination: join(__dirname, '..', '..', '..', 'uploads', 'church-logos'),
          filename: (_req, file, cb) => { cb(null, `${uuid()}${extname(file.originalname).toLowerCase()}`); },
        });
      })(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadChurchLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isCloudinaryConfigured) {
      const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'church-logos', file.filename);
      await validateImageContent(fullPath, file.filename);
    }
    return uploadResult(file, 'church-logos');
  }

  @Post('school-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (() => {
        if (isCloudinaryConfigured) return createCloudinaryStorage('school-logos');
        return diskStorage({
          destination: join(__dirname, '..', '..', '..', 'uploads', 'church-logos'),
          filename: (_req, file, cb) => { cb(null, `school-${uuid()}${extname(file.originalname).toLowerCase()}`); },
        });
      })(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadSchoolLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isCloudinaryConfigured) {
      const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'church-logos', file.filename);
      await validateImageContent(fullPath, file.filename);
    }
    return uploadResult(file, 'school-logos');
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (() => {
        if (isCloudinaryConfigured) return createCloudinaryStorage('avatars');
        return diskStorage({
          destination: join(__dirname, '..', '..', '..', 'uploads', 'avatars'),
          filename: (_req, file, cb) => { cb(null, `avatar-${uuid()}${extname(file.originalname).toLowerCase()}`); },
        });
      })(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isCloudinaryConfigured) {
      const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'avatars', file.filename);
      await validateImageContent(fullPath, file.filename);
    }
    return uploadResult(file, 'avatars');
  }

  @Post('student-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (() => {
        if (isCloudinaryConfigured) return createCloudinaryStorage('student-photos');
        return diskStorage({
          destination: join(__dirname, '..', '..', '..', 'uploads', 'student-photos'),
          filename: (_req, file, cb) => { cb(null, `student-${uuid()}${extname(file.originalname).toLowerCase()}`); },
        });
      })(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadStudentPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isCloudinaryConfigured) {
      const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'student-photos', file.filename);
      await validateImageContent(fullPath, file.filename);
    }
    return uploadResult(file, 'student-photos');
  }

  @Post('presentation')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'presentations'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `pres-${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: PPTX_MAX_SIZE },
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ext !== '.pptx') {
          cb(new BadRequestException('Only .pptx files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadPresentation(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/presentations/${file.filename}`, filename: file.filename };
  }
}
