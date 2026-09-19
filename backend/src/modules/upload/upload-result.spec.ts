/**
 * Regression test: multer-storage-cloudinary spreads Cloudinary's upload
 * response into the file object (secure_url/url, but NO path/filename).
 * Reading file.path saved `/uploads/<subfolder>/undefined` for every
 * Cloudinary upload — images that spin forever in the UI.
 */
describe('uploadResult', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = OLD_ENV;
    jest.resetModules();
  });

  function loadController() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./upload.controller') as typeof import('./upload.controller');
  }

  it('returns the Cloudinary secure_url (not .../undefined)', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';
    const { uploadResult } = loadController();
    // Shape produced by multer-storage-cloudinary: no `path`, no `filename`.
    const file = {
      fieldname: 'file',
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/cohep/student-photos/x.jpg',
      url: 'http://res.cloudinary.com/demo/image/upload/cohep/student-photos/x.jpg',
      public_id: 'cohep/student-photos/x',
    } as any;
    expect(uploadResult(file, 'student-photos')).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/cohep/student-photos/x.jpg',
    });
  });

  it('falls back to the local path shape when Cloudinary is not configured', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    const { uploadResult } = loadController();
    const file = { filename: 'student-abc.jpg' } as any;
    expect(uploadResult(file, 'student-photos')).toEqual({
      url: '/uploads/student-photos/student-abc.jpg',
    });
  });
});
