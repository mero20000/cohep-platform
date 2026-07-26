import {
  Controller, Post, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
const ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const PPTX_MAX_SIZE = 50 * 1024 * 1024; // 50MB

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
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
          cb(new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadChurchLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
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
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
          cb(new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadSchoolLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
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
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
          cb(new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
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
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
          cb(new BadRequestException(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadStudentPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
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
