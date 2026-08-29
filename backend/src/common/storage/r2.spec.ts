import { isOwnedRecordingUrl } from './r2';

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
