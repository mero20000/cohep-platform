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
});
