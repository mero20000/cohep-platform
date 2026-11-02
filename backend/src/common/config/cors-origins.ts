/**
 * Browser origins allowed to call the API with credentials. Read from the environment on every call so
 * the CORS setup in main.ts and the cookie CSRF check in the JWT strategy always agree.
 */
export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    env.FRONTEND_URL,
    env.FRONTEND_URL_2,
  ]
    .filter((o): o is string => !!o)
    .map((o) => o.replace(/\/$/, ''));
}
