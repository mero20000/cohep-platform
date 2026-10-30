// `import = require`, as main.ts does for cookie-parser: the project has no esModuleInterop,
// so a default import of a CommonJS module is not callable under ts-jest.
import express = require('express');
import multer = require('multer');
import request = require('supertest');
import { extname } from 'path';

/**
 * Guards the pair the API's uploads sit on, Express and multer: a real multipart request with the
 * same shape of options the production routes use (memory storage, a size limit, an extension
 * filter). It exists so a dependency upgrade that changes multipart handling fails here instead of
 * in production. It uses Express directly because the Nest layer is not loadable under the Jest
 * setup (see the shims in the jest config), so Nest's own FileInterceptor is not covered.
 */
describe('multipart upload pipeline (Express + multer)', () => {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 },
    fileFilter: (_req, file, cb) => {
      if (['.mp3', '.webm'].includes(extname(file.originalname).toLowerCase())) cb(null, true);
      else cb(new Error('Invalid audio format'));
    },
  });

  app.post('/upload', upload.single('file'), (req, res) => {
    res.status(201).json({ name: req.file!.originalname, size: req.file!.size, mimetype: req.file!.mimetype });
  });
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: err.message });
  });

  it('accepts an allowed file within the limit', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(200, 1), { filename: 'take.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'take.mp3', size: 200, mimetype: 'audio/mpeg' });
  });

  it('rejects a file type that is not allowed', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(10), { filename: 'page.html', contentType: 'text/html' });

    expect(res.status).toBe(400);
  });

  it('rejects a file over the size limit', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(4096, 1), { filename: 'big.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(413);
  });

  it('reports per-request client addresses once trust proxy is a hop count', async () => {
    const proxied = express();
    proxied.set('trust proxy', 1);
    proxied.get('/ip', (req, res) => res.send(req.ip));

    const res = await request(proxied).get('/ip').set('X-Forwarded-For', '1.2.3.4, 9.9.9.9');

    expect(res.text).toBe('9.9.9.9');
  });
});
