import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export const SKIP_PORTAL_AUTH = 'skipPortalAuth';

/**
 * Guard for the student portal.
 *
 * **Important:** Students authenticate via `portalAccessKey` — a 12-hour session JWT
 * exchanged at `/auth/login` using the student's access key. The `student` User role
 * is currently orphaned (no `@Roles('student')` decorator on any controller). Portal
 * endpoints are protected by `StudentPortalAuthGuard`, not by RBAC role checks.
 *
 * Routes marked with `@SetMetadata(SKIP_PORTAL_AUTH, true)` (the login route) are exempt.
 */
@Injectable()
export class StudentPortalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PORTAL_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing portal session token');
    }
    try {
      const payload = await this.jwt.verifyAsync(header.slice(7), {
        secret: process.env.JWT_SECRET,
      });
      // Only portal-session tokens qualify: they carry the portal code, and it
      // must match the code/portalAccessKey param on the route (the main data
      // route names its param :portalAccessKey while sub-routes use :code).
      const routeCode: string | undefined = request.params?.code ?? request.params?.portalAccessKey;
      if (!payload.code || !routeCode || payload.code !== routeCode) {
        throw new UnauthorizedException('Token does not match this portal');
      }
      request.portalStudent = { id: payload.sub, code: payload.code };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired portal session');
    }
  }
}
