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
    // With diskStorage, buffer isn't streamed into memory here; extension gate
    // applies above, and content magic bytes are verified after save below.
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

@Roles(...STAFF_ROLES)
@Controller('upload')
export class UploadController {
    @Post('church-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'church-logos'),
        filename: (req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadChurchLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'church-logos', file.filename);
    await validateImageContent(fullPath, file.filename);
    return { url: `/uploads/church-logos/${file.filename}`, filename: file.filename };
  }

    @Post('school-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'church-logos'),
        filename: (req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `school-${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadSchoolLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'church-logos', file.filename);
    await validateImageContent(fullPath, file.filename);
    return { url: `/uploads/church-logos/${file.filename}`, filename: file.filename };
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'avatars'),
        filename: (req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `avatar-${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'avatars', file.filename);
    await validateImageContent(fullPath, file.filename);
    return { url: `/uploads/avatars/${file.filename}`, filename: file.filename };
  }

    @Post('student-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'student-photos'),
        filename: (req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `student-${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: createImageFileFilter(),
    }),
  )
  async uploadStudentPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const fullPath = join(__dirname, '..', '..', '..', 'uploads', 'student-photos', file.filename);
    await validateImageContent(fullPath, file.filename);
    return { url: `/uploads/student-photos/${file.filename}`, filename: file.filename };
  }

  @Post('presentation')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads', 'presentations'),
        filename: (req, file, cb) => {
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