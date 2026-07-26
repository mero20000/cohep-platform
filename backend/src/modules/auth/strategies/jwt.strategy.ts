import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

function cookieExtractor(req: any): string | null {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return null;
  const token = cookieHeader
    .split(';')
    .map((part: string) => part.trim())
    .find((part: string) => part.startsWith('token='));
  return token ? decodeURIComponent(token.slice('token='.length)) : null;
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
    });
  }

  async validate(payload: { sub: string; email: string }) {
    try {
      const user = await this.authService.validateUser(payload.sub);
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
