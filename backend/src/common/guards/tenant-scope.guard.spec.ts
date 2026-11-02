import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantScopeGuard } from './tenant-scope.guard';
import { SchoolResolver } from '../utils/school-resolver';

const OWN_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';

describe('TenantScopeGuard', () => {
  const slugs: Record<string, string> = { 'own-school': OWN_ID, 'other-school': OTHER_ID };
  const resolver = {
    // Mirrors SchoolResolver: slugs map to ids, anything else comes back unchanged.
    resolve: jest.fn(async (identifier: string) => slugs[identifier] ?? identifier),
  } as unknown as SchoolResolver;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const guard = new TenantScopeGuard(reflector, resolver);

  const run = (request: any) =>
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext);

  const servant = { id: 'u1', schoolId: OWN_ID, roles: ['servant'] };

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
  });

  it('lets a request through when it carries no school id', async () => {
    await expect(run({ user: servant, query: {}, body: {}, params: {} })).resolves.toBe(true);
  });

  it('accepts the caller\'s own school by id or by slug, in any mix', async () => {
    await expect(
      run({ user: servant, query: { schoolId: OWN_ID }, body: { schoolId: 'own-school' }, params: {} }),
    ).resolves.toBe(true);
  });

  it('rejects another school in the query', async () => {
    await expect(run({ user: servant, query: { schoolId: OTHER_ID }, body: {}, params: {} })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects another school in the body even when the query names the caller\'s own school', async () => {
    await expect(
      run({ user: servant, query: { schoolId: OWN_ID }, body: { schoolId: OTHER_ID }, params: {} }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects the reverse: own school in the body, another in the query', async () => {
    await expect(
      run({ user: servant, query: { schoolId: OTHER_ID }, body: { schoolId: OWN_ID }, params: {} }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects another school in the route params', async () => {
    await expect(run({ user: servant, query: {}, body: {}, params: { schoolId: 'other-school' } })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('checks schoolIdentifier as well as schoolId', async () => {
    await expect(
      run({ user: servant, query: { schoolId: OWN_ID }, body: { schoolIdentifier: 'other-school' }, params: {} }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a school id sent as an array instead of skipping it', async () => {
    await expect(
      run({ user: servant, query: { schoolId: [OWN_ID, OTHER_ID] }, body: {}, params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a school id sent as an object', async () => {
    await expect(
      run({ user: servant, query: {}, body: { schoolId: { $ne: OWN_ID } }, params: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('ignores empty and null school ids', async () => {
    await expect(
      run({ user: servant, query: { schoolId: '  ' }, body: { schoolId: null }, params: {} }),
    ).resolves.toBe(true);
  });

  it('rejects an identifier that does not resolve to the caller\'s school', async () => {
    (resolver.resolve as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(run({ user: servant, query: { schoolId: 'nope' }, body: {}, params: {} })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets a super admin name any school', async () => {
    const superAdmin = { id: 's1', schoolId: OWN_ID, roles: ['super_admin'] };
    await expect(
      run({ user: superAdmin, query: { schoolId: OTHER_ID }, body: { schoolId: OTHER_ID }, params: {} }),
    ).resolves.toBe(true);
  });

  it('skips public routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    await expect(
      run({ user: servant, query: { schoolId: OTHER_ID }, body: {}, params: {} }),
    ).resolves.toBe(true);
  });

  it('skips unauthenticated requests', async () => {
    await expect(run({ user: undefined, query: { schoolId: OTHER_ID }, body: {}, params: {} })).resolves.toBe(true);
  });
});
