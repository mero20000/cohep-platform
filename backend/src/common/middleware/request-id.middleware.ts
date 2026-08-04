import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Assigns a unique request ID to every request.
 *
 * The ID is echoed back to the caller via the `X-Request-Id` header so a
 * support ticket can be correlated with log lines. It is also attached to
 * `req.requestId` for the logger, exception filter, and downstream code.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
