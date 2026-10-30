import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { resolve, normalize } from 'path';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../../common/decorators/public.decorator';
import { audioContentTypeForKey } from '../../common/storage/r2';

/**
 * Streams a reference recording regardless of how its URL was stored
 * (absolute R2 URL, /uploads/audio local path, or a bare R2 key). This keeps
 * playback working even when a recordingUrl is stored as a relative key that
 * the browser cannot resolve on its own.
 *
 * Public + no class-level @Roles so students/parents (who are not staff) can
 * play reference recordings in the student portal. SSRF-guarded: only local
 * /uploads/audio files or objects on the configured R2 host are fetchable.
 *
 * Security: fail-closed when CLOUDFLARE_R2_PUBLIC_URL is unset (503 for all
 * requests). Absolute-URL src values additionally require a valid JWT Bearer
 * token (staff/parent or student-portal); bare R2 keys remain public since
 * portal students need them and the target host is derived from config only.
 */
@Controller('curriculum')
export class RecordingStreamController {
  constructor(private readonly jwt: JwtService) {}

  @Public()
  @Get('recordings/stream')
  async stream(@Query('src') src: string, @Req() req: any, @Res() res: any) {
    if (!src) {
      res.status(400).json({ message: 'Missing src' });
      return;
    }

    const r2Public = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
    if (!r2Public) {
      res.status(503).json({ message: 'Storage not configured' });
      return;
    }
    const allowHost = r2Public.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();

    if (/^https?:\/\//i.test(src)) {
      const ok = await this.verifyBearer(req);
      if (!ok) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
    }

    let nodeStream: NodeJS.ReadableStream;
    // Decided from the file extension only, never from what storage says the object is: the
    // stored type is whatever the uploader claimed, and echoing it let an object uploaded as
    // text/html run as a page on this origin. Unknown extensions download instead of rendering.
    let contentType: string | undefined;
    let isDownload = false;

    try {
      if (src.startsWith('/uploads/')) {
        if (!src.startsWith('/uploads/audio/')) {
          res.status(400).json({ message: 'Invalid path' });
          return;
        }
        const root = resolve(process.cwd(), 'uploads', 'audio');
        const target = resolve(process.cwd(), normalize(src));
        if (target !== root && !target.startsWith(root + '/')) {
          res.status(400).json({ message: 'Invalid path' });
          return;
        }
        nodeStream = createReadStream(target);
        contentType = audioContentTypeForKey(target);
      } else {
        let url: string;
        if (/^https?:\/\//i.test(src)) {
          const host = new URL(src).host.toLowerCase();
          if (allowHost && host !== allowHost) {
            res.status(400).json({ message: 'Invalid source' });
            return;
          }
          url = src;
        } else {
          url = `${r2Public.replace(/\/$/, '')}/${src.replace(/^\/+/, '')}`;
        }
        const upstream = await fetch(url);
        if (!upstream.ok || !upstream.body) {
          res.status(404).json({ message: 'Recording not found' });
          return;
        }
        contentType = audioContentTypeForKey(new URL(url).pathname);
        nodeStream = Readable.fromWeb(upstream.body as any);
      }

      if (!contentType) {
        contentType = 'application/octet-stream';
        isDownload = true;
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      if (isDownload) res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Accept-Ranges', 'bytes');
      nodeStream.pipe(res);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(404).json({ message: 'Stream error' });
      });
    } catch {
      if (!res.headersSent) res.status(404).json({ message: 'Recording not found' });
    }
  }

  private async verifyBearer(req: any): Promise<boolean> {
    const header: string | undefined = req.headers?.['authorization'];
    if (!header?.startsWith('Bearer ')) return false;
    try {
      const payload = await this.jwt.verifyAsync(header.slice(7), {
        secret: process.env.JWT_SECRET,
      });
      // Staff/parent tokens carry a user id in sub; portal tokens carry the
      // portal code. Anything else is rejected.
      return Boolean(payload?.sub || payload?.code);
    } catch {
      return false;
    }
  }
}
