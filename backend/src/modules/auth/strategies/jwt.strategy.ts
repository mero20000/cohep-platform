import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { getAllowedOrigins } from '../../../common/config/cors-origins';

function cookieExtractor(req: any): string | null {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return null;
  const token = cookieHeader
    .split(';')
    .map((part: string) => part.trim())
    .find((part: string) => part.startsWith('token='));
  return token ? decodeURIComponent(token.slice('token='.length)) : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();

/**
 * The auth cookie is SameSite=None in production, so a page on another site can make the browser send it
 * with a form POST (no CORS preflight). CORS only stops that page reading the reply, not the request
 * taking effect. A request authenticated by the cookie alone must therefore come from an allowed origin
 * when it can change data. Bearer requests are not affected: a foreign page cannot set that header.
 */
function assertCookieRequestFromAllowedOrigin(req: any) {
  if (bearerExtractor(req)) return;
  if (SAFE_METHODS.has(String(req?.method ?? 'GET').toUpperCase())) return;
  const origin = req?.headers?.origin;
  if (typeof origin !== 'string' || !getAllowedOrigins().includes(origin)) {
    throw new ForbiddenException('Cross-site request blocked');
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    assertCookieRequestFromAllowedOrigin(req);
    if (payload?.demo === true && payload?.role === 'demo_viewer') {
      // TenantScopeGuard skips checks when schoolId is falsy — a demo token
      // without a school would silently escape tenant scoping. Reject it.
      if (!payload.schoolId) {
        throw new UnauthorizedException('Demo token missing school scope');
      }
      return {
        id: 'demo-guest',
        email: 'guest@demo',
        schoolId: payload.schoolId,
        roles: ['demo_viewer'],
        isDemo: true,
        isActive: true,
      };
    }
    // Only access tokens authenticate a request. Refresh and reset tokens are signed with the same
    // secret and used to pass as access tokens; so did a token with no type, which now means one
    // issued before types existed.
    if (payload?.typ !== 'access') {
      throw new UnauthorizedException('Invalid token');
    }
    try {
      const user = await this.authService.validateUser(payload.sub, payload.iat);
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
