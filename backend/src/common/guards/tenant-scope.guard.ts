import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { SchoolResolver } from '../utils/school-resolver';

const SCHOOL_PARAM_KEYS = ['schoolId', 'schoolIdentifier'];

/**
 * Tenant scoping guard.
 *
 * Runs AFTER JwtAuthGuard (so `req.user` is populated) and RolesGuard.
 * For any authenticated, non-super-admin request that carries a school
 * identifier (query/body/param), it resolves EVERY such identifier and rejects
 * the request unless all of them resolve to the caller's own school. Checking
 * only the first one found let a caller send their own school in the query and
 * another school's in the body, which handlers then used.
 *
 * Routes that carry no school identifier are left untouched, so this is a
 * single choke point that closes the cross-tenant IDOR class without
 * touching every service. Super admins intentionally span schools and are
 * exempt (they are checked separately for privileged operations).
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly schoolResolver: SchoolResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Unauthenticated routes (e.g. some public health/status endpoints) pass.
    if (!user || !user.schoolId) return true;

    // Super admin spans tenants by design.
    if (user.roles?.includes('super_admin')) return true;

    const requested = this.collectSchoolIdentifiers(request);

    for (const identifier of requested) {
      // Resolve slug or raw id to the canonical school id.
      let resolved: string;
      try {
        resolved = await this.schoolResolver.resolve(identifier);
      } catch {
        // Unresolvable identifier on a scoped route -> reject.
        throw new ForbiddenException('Access to the requested school is not permitted');
      }

      if (resolved !== user.schoolId) {
        throw new ForbiddenException('Access to the requested school is not permitted');
      }
    }

    return true;
  }

  /**
   * Every non-empty school identifier the request carries, from query, body and
   * params. A value that is not a string (an array from `?schoolId=a&schoolId=b`,
   * or a JSON object) is rejected: it used to be skipped, which let it through.
   */
  private collectSchoolIdentifiers(request: any): string[] {
    const found = new Set<string>();
    for (const source of [request.query, request.body, request.params]) {
      if (!source || typeof source !== 'object') continue;
      for (const key of SCHOOL_PARAM_KEYS) {
        const value = source[key];
        if (value === undefined || value === null) continue;
        if (typeof value !== 'string') {
          throw new BadRequestException(`${key} must be a string`);
        }
        if (value.trim().length > 0) found.add(value);
      }
    }
    return [...found];
  }
}
