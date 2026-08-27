import { NextResponse } from 'next/server';

const config = {
  endpoint: process.env.LOGTO_ENDPOINT || 'https://your-tenant.logto.app',
  appId: process.env.LOGTO_APP_ID || 'your-app-id',
  appSecret: process.env.LOGTO_APP_SECRET || 'your-app-secret',
  baseUrl: process.env.LOGTO_BASE_URL || 'http://localhost:3000',
  cookieSecure: process.env.NODE_ENV === 'production',
};

export async function GET() {
  // Redirect to Logto's authorization endpoint
  const signInUrl = `${config.endpoint}/oidc/auth?client_id=${config.appId}&redirect_uri=${encodeURIComponent(`${config.baseUrl}/api/logto/callback`)}&response_type=code&scope=openid+profile+email+offline_access`;
  
  return NextResponse.redirect(signInUrl);
}
