import { EventEmitter } from 'events';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { redactPath, scrubSentryEvent } from './redact-url';
import { requestLoggerMiddleware } from '../middleware/request-logger.middleware';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';

const withScope = jest.fn((cb: (scope: any) => void) => cb({ setTag: jest.fn(), setExtra: scopeExtra }));
const scopeExtra = jest.fn();
jest.mock('@sentry/node', () => ({
  isInitialized: () => true,
  withScope: (cb: any) => withScope(cb),
  captureException: jest.fn(),
}));

const KEY = '3f2b8c1e-9d4a-4e7b-8a61-0c5d2e9f7a13';

describe('redactPath', () => {
  it('replaces the student portal key with :key', () => {
    expect(redactPath(`/api/student-portal/${KEY}/dashboard`)).toBe('/api/student-portal/:key/dashboard');
    expect(redactPath(`/student-portal/${KEY}`)).toBe('/student-portal/:key');
  });

  it('drops the query string and fragment', () => {
    expect(redactPath('/api/auth/reset-password?token=abc.def.ghi&x=1')).toBe('/api/auth/reset-password');
    expect(redactPath('/api/x#frag')).toBe('/api/x');
  });

  it('does both at once and leaves ordinary paths alone', () => {
    expect(redactPath(`/api/student-portal/${KEY}/audio?token=secret`)).toBe('/api/student-portal/:key/audio');
    expect(redactPath('/api/students/stu-1/attendance')).toBe('/api/students/stu-1/attendance');
    expect(redactPath(undefined)).toBe('');
  });
});

describe('scrubSentryEvent', () => {
  it('removes query, cookies, auth headers and the portal key', () => {
    const event = scrubSentryEvent({
      request: {
        url: `https://api.example.com/api/student-portal/${KEY}/home?token=secret`,
        query_string: 'token=secret',
        cookies: { token: 'jwt' },
        headers: { cookie: 'token=jwt', Authorization: 'Bearer jwt', 'user-agent': 'x' },
      },
      transaction: `GET /api/student-portal/${KEY}/home`,
    });
    expect(JSON.stringify(event)).not.toContain(KEY);
    expect(JSON.stringify(event)).not.toContain('secret');
    expect(JSON.stringify(event)).not.toContain('jwt');
    expect(event.request.url).toBe('https://api.example.com/api/student-portal/:key/home');
    expect(event.request.headers).toEqual({ 'user-agent': 'x' });
  });
});

describe('request logger', () => {
  it('logs no portal key and no query string', () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const res: any = new EventEmitter();
    res.statusCode = 200;
    const req: any = {
      method: 'GET',
      baseUrl: '/api',
      path: `/student-portal/${KEY}/dashboard`,
      originalUrl: `/api/student-portal/${KEY}/dashboard?token=secret`,
      ip: '1.2.3.4',
      get: () => 'jest',
    };
    requestLoggerMiddleware(req, res, () => undefined);
    res.emit('finish');
    const line = write.mock.calls.map((c) => String(c[0])).join('');
    write.mockRestore();
    expect(line).toContain('/api/student-portal/:key/dashboard');
    expect(line).not.toContain(KEY);
    expect(line).not.toContain('secret');
  });
});

describe('AllExceptionsFilter', () => {
  const run = (exception: unknown) => {
    const json = jest.fn();
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status: () => ({ json }) }),
        getRequest: () => ({
          method: 'GET',
          url: `/api/student-portal/${KEY}/dashboard?token=secret`,
          requestId: 'r1',
        }),
      }),
    };
    const logged: string[] = [];
    const err = jest.spyOn(Logger.prototype, 'error').mockImplementation((...a: any[]) => {
      logged.push(a.map(String).join(' '));
    });
    new AllExceptionsFilter().catch(exception, host);
    err.mockRestore();
    return { body: json.mock.calls[0][0], logged: logged.join('\n') };
  };

  it('keeps the key and query out of the log, the reply and Sentry on a 500', () => {
    scopeExtra.mockClear();
    const { body, logged } = run(new Error('boom'));
    const everything = JSON.stringify(body) + logged + JSON.stringify(scopeExtra.mock.calls);
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain('secret');
    expect(body.path).toBe('/api/student-portal/:key/dashboard');
    expect(scopeExtra).toHaveBeenCalledWith('url', '/api/student-portal/:key/dashboard');
  });

  it('does the same for client errors', () => {
    const { body, logged } = run(new HttpException('nope', HttpStatus.FORBIDDEN));
    expect(JSON.stringify(body) + logged).not.toContain(KEY);
    expect(body.statusCode).toBe(403);
  });
});
