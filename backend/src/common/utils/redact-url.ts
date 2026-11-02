/**
 * Request paths and URLs reach the request log, the exception log, the error response and Sentry.
 * Two things in them are credentials: the student portal access key (`/student-portal/<key>/...`)
 * and anything in the query string (tokens, reset links). Both are removed before logging.
 */
const PORTAL_KEY = /(\/student-portal\/)[^/?#]+/gi;

/** Path only: no query string, no fragment, portal key replaced by `:key`. */
export function redactPath(url: string | undefined | null): string {
  if (!url) return '';
  const pathOnly = url.split(/[?#]/, 1)[0];
  return pathOnly.replace(PORTAL_KEY, '$1:key');
}

/** Sentry's request integration attaches the full URL, query string and cookies; drop what is secret. */
export function scrubSentryEvent<T extends { request?: any; transaction?: string }>(event: T): T {
  const req = event.request;
  if (req) {
    if (typeof req.url === 'string') {
      try {
        const u = new URL(req.url);
        req.url = u.origin + redactPath(u.pathname);
      } catch {
        req.url = redactPath(req.url);
      }
    }
    delete req.query_string;
    delete req.cookies;
    if (req.headers) {
      for (const h of Object.keys(req.headers)) {
        if (/^(cookie|authorization|x-api-key)$/i.test(h)) delete req.headers[h];
      }
    }
  }
  if (typeof event.transaction === 'string') event.transaction = redactPath(event.transaction);
  return event;
}
