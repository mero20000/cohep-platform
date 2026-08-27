/**
 * COHEP Logto Configuration
 *
 * This file configures Logto authentication for the COHEP platform.
 * 
 * Required environment variables:
 * - LOGTO_ENDPOINT: Your Logto endpoint (e.g., https://your-tenant.logto.app)
 * - LOGTO_APP_ID: Your Logto application ID
 * - LOGTO_APP_SECRET: Your Logto application secret
 * - LOGTO_BASE_URL: Your application base URL
 */

export const logtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || 'https://your-tenant.logto.app',
  appId: process.env.LOGTO_APP_ID || 'your-app-id',
  appSecret: process.env.LOGTO_APP_SECRET || 'your-app-secret',
  baseUrl: process.env.LOGTO_BASE_URL || 'http://localhost:3000',
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
  ],
  resources: [
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  ],
  interactionMode: 'consent' as const,
};
