'use client';

import { LogtoProvider, type LogtoConfig } from '@logto/react';
import { type ReactNode } from 'react';

const config: LogtoConfig = {
  endpoint: process.env.NEXT_PUBLIC_LOGTO_ENDPOINT || 'https://your-tenant.logto.app',
  appId: process.env.NEXT_PUBLIC_LOGTO_APP_ID || 'your-app-id',
};

interface LogtoProviderWrapperProps {
  children: ReactNode;
}

export function LogtoProviderWrapper({ children }: LogtoProviderWrapperProps) {
  return (
    <LogtoProvider config={config}>
      {children}
    </LogtoProvider>
  );
}
