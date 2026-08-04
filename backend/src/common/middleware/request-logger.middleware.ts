import { Request, Response, NextFunction } from 'express';

/**
 * Structured (single-line JSON) request logger.
 *
 * Emits one JSON object per request with the request ID (when present),
 * method, path, HTTP status, and wall-clock duration. This is immediately
 * useful for traffic patterns, latency, and per-request error correlation.
 *
 * The level is e.warn for 5xx, verbose for everything else. Periodic
 * high-frequency "ping" paths (health checks) are skipped to avoid noise.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();
  const requestId = (req as any).requestId;
  const path = req.baseUrl + req.path;

  res.on('finish', () => {
    // Skip noisy, uninteresting probes.
    if (path === '/health' || req.path === '/health') return;
    if (path.startsWith('/uploads') || path.startsWith('/api/docs')) return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      msg: 'http request',
      requestId,
      method: req.method,
      path,
      statusCode: status,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    // Write raw JSON to stdout to bypass Nest's formatter.
    process.stdout.write(line + '\n');
  });

  next();
}