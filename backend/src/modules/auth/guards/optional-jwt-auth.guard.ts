import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Populates `req.user` when a valid access token is present and lets the request through as an
 * anonymous caller (`req.user` null) when it is missing or invalid. For @Public() routes that serve
 * both signed-in and anonymous visitors but must never trust identity claimed in the body.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: unknown, user: any) {
    return user || null;
  }
}
