import {
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
 * identifier (query/body/param), it resolves that identifier and rejects
 * the request unless it resolves to the caller's own school.
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

    const requestedSchoolId = this.extractSchoolIdentifier(request);
    if (!requestedSchoolId) return true;

    // Resolve slug or raw id to the canonical school id.
    let resolved: string;
    try {
      resolved = await this.schoolResolver.resolve(requestedSchoolId);
    } catch {
      // Unresolvable identifier on a scoped route -> reject.
      throw new ForbiddenException('Access to the requested school is not permitted');
    }

    if (resolved !== user.schoolId) {
      throw new ForbiddenException('Access to the requested school is not permitted');
    }

    return true;
  }

  private extractSchoolIdentifier(request: any): string | undefined {
    const sources = [request.query, request.body, request.params];
    for (const source of sources) {
      if (!source) continue;
      for (const key of SCHOOL_PARAM_KEYS) {
        const value = source[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
      }
    }
    return undefined;
  }
}
