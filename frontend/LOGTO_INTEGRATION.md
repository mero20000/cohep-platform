# Logto Integration for COHEP

This document explains how to set up Logto authentication for the COHEP platform.

## Overview

Logto is an open-source identity platform that provides:
- Single Sign-On (SSO)
- Multi-factor authentication (MFA)
- Social sign-in (Google, Facebook, etc.)
- User management
- Role-based access control (RBAC)

## Setup Instructions

### 1. Create a Logto Account

1. Go to [https://cloud.logto.app](https://cloud.logto.app)
2. Sign up for a free account
3. Create a new tenant

### 2. Configure Your Application

1. In the Logto console, go to **Applications**
2. Click **Create Application**
3. Select **Next.js** (or **OIDC** for custom)
4. Note down:
   - **Endpoint** (e.g., `https://your-tenant.logto.app`)
   - **App ID**
   - **App Secret**

### 3. Configure Redirect URIs

In your Logto application settings, add these redirect URIs:

**Sign-in redirect URIs:**
```
http://localhost:3000/api/logto/callback
https://your-production-domain.com/api/logto/callback
```

**Post sign-out redirect URIs:**
```
http://localhost:3000/auth/login
https://your-production-domain.com/auth/login
```

### 4. Set Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
# Logto Configuration
NEXT_PUBLIC_LOGTO_ENDPOINT=https://your-tenant.logto.app
NEXT_PUBLIC_LOGTO_APP_ID=your-app-id

# Server-only
LOGTO_ENDPOINT=https://your-tenant.logto.app
LOGTO_APP_ID=your-app-id
LOGTO_APP_SECRET=your-app-secret
LOGTO_BASE_URL=http://localhost:3000
```

### 5. Enable Logto in Your Application

The Logto provider is already integrated into the app. To use Logto authentication:

1. Import the `useLogtoAuth` hook in your components:

```tsx
import { useLogtoAuth } from '@/hooks/use-logto-auth';

export function MyComponent() {
  const { user, loading, isAuthenticated, login, logout } = useLogtoAuth();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <button onClick={login}>Sign in with Logto</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.firstName}!</p>
      <button onClick={logout}>Sign out</button>
    </div>
  );
}
```

### 6. Configure Social Sign-In (Optional)

To enable social sign-in providers:

1. In Logto console, go to **Sign-in experience**
2. Enable social sign-in providers (Google, Facebook, etc.)
3. Configure each provider with your credentials

### 7. Configure User Attributes

Logto provides these standard claims:
- `sub` - User ID
- `email` - Email address
- `name` - Full name
- `picture` - Avatar URL
- `username` - Username

You can extend these with custom data using Logto's **User metadata** feature.

## Migration from Legacy Auth

The existing `useAuth` hook has been updated to support both:
- **Legacy authentication** (current localStorage-based)
- **Logto authentication** (new SSO-based)

To switch to Logto:

1. Set the `useLogto` option to `true`:

```tsx
const { user, loading, login, logout } = useAuth({ useLogto: true });
```

2. Update your login page to use the Logto sign-in button:

```tsx
import { LogtoSignInButton } from '@/components/auth/logto-sign-in-button';

export default function LoginPage() {
  return (
    <div>
      <h1>Sign in to COHEP</h1>
      <LogtoSignInButton />
    </div>
  );
}
```

## API Integration

The Logto integration includes these API routes:

- `/api/logto/sign-in` - Initiates the sign-in flow
- `/api/logto/sign-out` - Signs out the user
- `/api/logto/callback` - Handles the OAuth callback
- `/api/logto/user` - Returns the current user information

## Production Deployment

For production:

1. Update `LOGTO_BASE_URL` to your production domain
2. Add your production domain to Logto's redirect URIs
3. Ensure HTTPS is enabled
4. Set secure cookie settings

## Troubleshooting

### "Invalid redirect_uri" error
- Check that your redirect URIs match exactly in Logto console
- Ensure protocol (http/https) matches

### "Token exchange failed" error
- Verify your App ID and App Secret are correct
- Check that the endpoint URL is correct

### User not authenticated after callback
- Ensure the callback route is working: `/api/logto/callback`
- Check browser console for errors
- Verify environment variables are set correctly

## Resources

- [Logto Documentation](https://docs.logto.io)
- [Logto SDK for Next.js](https://docs.logto.io/docs/references/sdk/nextjs)
- [OIDC Protocol](https://openid.net/specs/openid-connect-core-1_0.html)
