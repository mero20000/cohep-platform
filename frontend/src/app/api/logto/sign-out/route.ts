import { NextResponse } from 'next/server';

const config = {
  endpoint: process.env.LOGTO_ENDPOINT || 'https://your-tenant.logto.app',
  appId: process.env.LOGTO_APP_ID || 'your-app-id',
  appSecret: process.env.LOGTO_APP_SECRET || 'your-app-secret',
  baseUrl: process.env.LOGTO_BASE_URL || 'http://localhost:3000',
  cookieSecure: process.env.NODE_ENV === 'production',
};

export async function GET() {
  // Construct the logout URL
  const postLogoutRedirectUri = `${config.baseUrl}/auth/login`;
  const logoutUrl = `${config.endpoint}/oidc/session/end?client_id=${config.appId}&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
  
  return NextResponse.redirect(logoutUrl);
}
