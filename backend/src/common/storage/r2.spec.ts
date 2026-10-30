import { BadRequestException } from '@nestjs/common';
import { audioContentTypeForKey, isOwnedRecordingUrl, storableContentTypeForKey, uploadRecording } from './r2';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));


/**
 * These URLs are later rendered as audio sources in the servant review queue and the
 * parent portal, so accepting an off-site one lets a student choose what a servant's
 * browser fetches. The local-fallback shape is the only one asserted here, because
 * CLOUDFLARE_R2_PUBLIC_URL is read at module load and is unset in tests.
 */
describe('isOwnedRecordingUrl', () => {
  it('accepts a local fallback recording path', () => {
    expect(isOwnedRecordingUrl('/uploads/audio/abc-123.webm')).toBe(true);
  });

  it.each([
    ['an off-site url', 'https://evil.example.com/payload.mp3'],
    ['a protocol-relative url', '//evil.example.com/payload.mp3'],
    ['a traversal attempt', '/uploads/audio/../../etc/passwd'],
    ['a nested path under the fallback prefix', '/uploads/audio/sub/dir.mp3'],
    ['a javascript url', 'javascript:alert(1)'],
    ['a data url', 'data:audio/mpeg;base64,AAAA'],
    ['an empty string', ''],
  ])('rejects %s', (_label, url) => {
    expect(isOwnedRecordingUrl(url)).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(isOwnedRecordingUrl(undefined as unknown as string)).toBe(false);
  });

  it('rejects an absurdly long url', () => {
    expect(isOwnedRecordingUrl(`/uploads/audio/${'a'.repeat(3000)}.webm`)).toBe(false);
  });
});

describe('content type is decided by the file extension', () => {
  it.each([
    ['a.mp3', 'audio/mpeg'],
    ['a.M4A', 'audio/mp4'],
    ['a.mp4', 'audio/mp4'],
    ['a.ogg', 'audio/ogg'],
    ['a.webm', 'audio/webm'],
    ['p.jpg', 'image/jpeg'],
    ['p.jpeg', 'image/jpeg'],
    ['p.png', 'image/png'],
    ['p.webp', 'image/webp'],
  ])('%s is stored as %s', (key, type) => {
    expect(storableContentTypeForKey(key)).toBe(type);
  });

  it.each(['x.html', 'x.htm', 'x.svg', 'x.xml', 'x.js', 'x.exe', 'x', 'x.mp3.html'])('%s may not be stored', (key) => {
    expect(storableContentTypeForKey(key)).toBeUndefined();
  });

  it('audioContentTypeForKey knows audio but not images', () => {
    expect(audioContentTypeForKey('a.mp3')).toBe('audio/mpeg');
    expect(audioContentTypeForKey('p.png')).toBeUndefined();
    expect(audioContentTypeForKey('x.html')).toBeUndefined();
  });
});

describe('uploadRecording', () => {
  it.each(['recordings/x.html', 'student-photos/p.svg', 'recordings/noext'])('refuses %s', async (key) => {
    await expect(uploadRecording(Buffer.from('x'), key, 'text/html')).rejects.toThrow(BadRequestException);
  });

  it('stores an allowed file in the local fallback and returns its path', async () => {
    await expect(uploadRecording(Buffer.from('x'), 'recordings/a-1.mp3', 'text/html')).resolves.toBe('/uploads/audio/a-1.mp3');
  });

  describe('with R2 configured', () => {
    const send = jest.fn().mockResolvedValue({});
    let upload: typeof uploadRecording;

    beforeAll(() => {
      jest.resetModules();
      Object.assign(process.env, {
        CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
        CLOUDFLARE_R2_BUCKET: 'bucket',
        CLOUDFLARE_R2_ACCESS_KEY_ID: 'k',
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: 's',
        CLOUDFLARE_R2_PUBLIC_URL: 'https://r2.example.com',
      });
      jest.doMock('@aws-sdk/client-s3', () => ({
        S3Client: jest.fn().mockImplementation(() => ({ send })),
        PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
      }));
      upload = require('./r2').uploadRecording;
    });

    afterAll(() => {
      for (const k of ['ACCOUNT_ID', 'BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'PUBLIC_URL']) {
        delete process.env[`CLOUDFLARE_R2_${k}`];
      }
      jest.dontMock('@aws-sdk/client-s3');
      jest.resetModules();
    });

    it('ignores the content type the caller claims and uses the extension\'s', async () => {
      const url = await upload(Buffer.from('x'), 'recordings/take.m4a', 'text/html');

      expect(url).toBe('https://r2.example.com/recordings/take.m4a');
      expect(send).toHaveBeenCalledWith({ input: expect.objectContaining({ Key: 'recordings/take.m4a', ContentType: 'audio/mp4' }) });
    });
  });
});
