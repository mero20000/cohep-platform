import { Controller, Get, Query, Res } from '@nestjs/common';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { extname, resolve, normalize } from 'path';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Streams a reference recording regardless of how its URL was stored
 * (absolute R2 URL, /uploads/audio local path, or a bare R2 key). This keeps
 * playback working even when a recordingUrl is stored as a relative key that
 * the browser cannot resolve on its own.
 *
 * Public + no class-level @Roles so students/parents (who are not staff) can
 * play reference recordings in the student portal. SSRF-guarded: only local
 * /uploads/audio files or objects on the configured R2 host are fetchable.
 */
@Controller('curriculum')
export class RecordingStreamController {
  @Public()
  @Get('recordings/stream')
  async stream(@Query('src') src: string, @Res() res: any) {
    if (!src) {
      res.status(400).json({ message: 'Missing src' });
      return;
    }

    const r2Public = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
    const allowHost = r2Public.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();

    let nodeStream: NodeJS.ReadableStream;
    let contentType = 'audio/mpeg';

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
        const ext = extname(target).toLowerCase();
        contentType =
          ext === '.webm' ? 'audio/webm' :
          ext === '.ogg' ? 'audio/ogg' :
          ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg';
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
          if (!r2Public) {
            res.status(400).json({ message: 'Storage not configured' });
            return;
          }
          url = `${r2Public.replace(/\/$/, '')}/${src.replace(/^\/+/, '')}`;
        }
        const upstream = await fetch(url);
        if (!upstream.ok || !upstream.body) {
          res.status(404).json({ message: 'Recording not found' });
          return;
        }
        contentType = upstream.headers.get('content-type') || contentType;
        nodeStream = Readable.fromWeb(upstream.body as any);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      nodeStream.pipe(res);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(404).json({ message: 'Stream error' });
      });
    } catch {
      if (!res.headersSent) res.status(404).json({ message: 'Recording not found' });
    }
  }
}
