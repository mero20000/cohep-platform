import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let validateUserSpy: jest.Mock;

  beforeEach(async () => {
    validateUserSpy = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['admin'],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: AuthService,
          useValue: { validateUser: validateUserSpy },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('validates a real user via AuthService', async () => {
    const user = await (strategy as any).validate({ sub: 'user-1', email: 'user@example.com' });
    expect(validateUserSpy).toHaveBeenCalledWith('user-1');
    expect(user.id).toBe('user-1');
  });

  it('returns synthetic demo user without DB for demo_viewer token', async () => {
    const user = await (strategy as any).validate({ sub: 'demo-guest', role: 'demo_viewer', demo: true, schoolId: 'demo-school-id' });
    expect(user.roles).toEqual(['demo_viewer']);
    expect(user.isDemo).toBe(true);
    expect(validateUserSpy).not.toHaveBeenCalled();
  });

  it('returns synthetic demo user with correct shape', async () => {
    const user = await (strategy as any).validate({ sub: 'demo-guest', role: 'demo_viewer', demo: true, schoolId: 'demo-school-id' });
    expect(user).toEqual(
      expect.objectContaining({
        id: 'demo-guest',
        email: 'guest@demo',
        schoolId: 'demo-school-id',
        roles: ['demo_viewer'],
        isDemo: true,
        isActive: true,
      }),
    );
  });

  it('falls through to DB when demo flag is false', async () => {
    await (strategy as any).validate({ sub: 'user-1', role: 'demo_viewer', demo: false, schoolId: 'demo-school-id' });
    expect(validateUserSpy).toHaveBeenCalledWith('user-1');
  });

  it('falls through to DB when role is not demo_viewer', async () => {
    await (strategy as any).validate({ sub: 'user-1', role: 'admin', demo: true, schoolId: 'demo-school-id' });
    expect(validateUserSpy).toHaveBeenCalledWith('user-1');
  });
});
