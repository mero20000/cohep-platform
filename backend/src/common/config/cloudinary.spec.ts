/**
 * Regression test: multer-storage-cloudinary resolves `params` through
 * run-parallel with Node-style (req, file, cb) callbacks. An async params
 * function never calls back, hanging every Cloudinary upload forever with
 * no error (the infinite-spinner student photo bug). This test fails if
 * params ever stops calling its callback.
 */
describe('createCloudinaryStorage params callback', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('calls back with upload params instead of hanging', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCloudinaryStorage } = require('./cloudinary');
    const storage = createCloudinaryStorage('student-photos');
    expect(storage).not.toBeNull();

    const params = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('params callback never fired (upload would hang)')), 2000);
      storage.getParams({}, { originalname: 'photo.png' }, (err: Error | null, result?: unknown) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(result);
      });
    });

    expect(params).toMatchObject({
      folder: 'cohep/student-photos',
      format: 'png',
    });
    expect((params as any).public_id).toMatch(/^student-photos-/);
  });

  it('passes an object with .v2.uploader (bare v2 crashes the process on upload)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCloudinaryStorage } = require('./cloudinary');
    const storage = createCloudinaryStorage('student-photos');
    expect(storage).not.toBeNull();
    expect((storage as any).cloudinary?.v2).toBeDefined();
    expect(typeof (storage as any).cloudinary?.v2?.uploader?.upload_stream).toBe('function');
  });

  it('returns null when Cloudinary is not configured (disk fallback)', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCloudinaryStorage: create } = require('./cloudinary');
    expect(create('student-photos')).toBeNull();
  });
});
