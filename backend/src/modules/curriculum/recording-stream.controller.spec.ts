import { PassThrough } from 'stream';
import { RecordingStreamController } from './recording-stream.controller';

describe('RecordingStreamController', () => {
  const build = (jwtVerify: jest.Mock) => {
    return new RecordingStreamController({ verifyAsync: jwtVerify } as any);
  };
  const res = () => {
    const r: any = { statusCode: null, body: null, headersSent: false, setHeader: jest.fn() };
    r.status = (c: number) => { r.statusCode = c; return r; };
    r.json = (b: unknown) => { r.body = b; return r; };
    return r;
  };

  afterEach(() => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
  });

  it('returns 503 when R2 public URL is unset', async () => {
    const controller = build(jest.fn());
    const r = res();
    await controller.stream('recordings/file.mp3', { headers: {} }, r);
    expect(r.statusCode).toBe(503);
    expect(r.body).toEqual({ message: 'Storage not configured' });
  });

  it('returns 401 for absolute URL without a Bearer token', async () => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://r2.example.com';
    const controller = build(jest.fn());
    const r = res();
    await controller.stream('https://evil.example.com/secret', { headers: {} }, r);
    expect(r.statusCode).toBe(401);
    expect(jest.fn()).not.toHaveBeenCalled;
  });

  it('rejects absolute URL with an invalid token', async () => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://r2.example.com';
    const controller = build(jest.fn().mockRejectedValue(new Error('bad')));
    const r = res();
    await controller.stream(
      'https://r2.example.com/file.mp3',
      { headers: { authorization: 'Bearer nope' } },
      r,
    );
    expect(r.statusCode).toBe(401);
  });
  describe('response headers', () => {
    const originalFetch = global.fetch;
    afterEach(() => { global.fetch = originalFetch; });

    // A writable response the stream can be piped into, with the bits of Express the controller uses.
    const streamRes = () => {
      const r: any = new PassThrough();
      r.headers = {} as Record<string, string>;
      r.headersSent = false;
      r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
      r.status = jest.fn().mockReturnValue(r);
      r.json = jest.fn();
      return r;
    };
    const upstream = (contentType: string) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => contentType },
        body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('<script>alert(1)</script>')); c.close(); } }),
      }) as any;
    };
    const play = async (src: string, contentType: string) => {
      process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://r2.example.com';
      upstream(contentType);
      const r = streamRes();
      await build(jest.fn()).stream(src, { headers: {} }, r);
      return r;
    };

    it('serves audio with the type of its extension, not the type storage claims', async () => {
      const r = await play('recordings/take.mp3', 'text/html');

      expect(r.headers['Content-Type']).toBe('audio/mpeg');
      expect(r.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(r.headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
      expect(r.headers['Content-Disposition']).toBeUndefined();
    });

    it('sends an object with an unknown extension as a download, never as a page', async () => {
      const r = await play('student-photos/p.html', 'text/html');

      expect(r.headers['Content-Type']).toBe('application/octet-stream');
      expect(r.headers['Content-Disposition']).toBe('attachment');
      expect(r.headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('does the same for an object with no extension', async () => {
      const r = await play('recordings/noext', 'text/html');

      expect(r.headers['Content-Type']).toBe('application/octet-stream');
      expect(r.headers['Content-Disposition']).toBe('attachment');
    });
  });
});
