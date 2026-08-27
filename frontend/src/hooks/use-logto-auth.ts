'use client';

import { useLogto } from '@logto/react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface LogtoUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  roles: string[];
  schoolId?: string;
  metadata?: Record<string, unknown>;
}

export function useLogtoAuth() {
  const { isAuthenticated, signIn, signOut } = useLogto();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      if (isAuthenticated) {
        try {
          const response = await fetch('/api/logto/user');
          if (response.ok) {
            const data = await response.json();
            const logtoUser = data.user as LogtoUser;

            // Transform Logto user to COHEP user format
            const authUser: AuthUser = {
              id: logtoUser.sub,
              email: logtoUser.email || '',
              firstName: logtoUser.name?.split(' ')[0] || logtoUser.username || '',
              lastName: logtoUser.name?.split(' ').slice(1).join(' ') || '',
              avatarUrl: logtoUser.picture,
              roles: [], // Will be fetched from your backend
              schoolId: undefined,
              metadata: logtoUser,
            };

            setUser(authUser);
            localStorage.setItem('user', JSON.stringify(authUser));
            localStorage.setItem('niangelos_token', data.accessToken);
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      } else {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('niangelos_token');
      }
      setLoading(false);
    };

    fetchUser();
  }, [isAuthenticated]);

  const login = useCallback(async () => {
    await signIn(`${window.location.origin}/api/logto/callback`);
  }, [signIn]);

  const logout = useCallback(async () => {
    await signOut(`${window.location.origin}/auth/login`);
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('niangelos_token');
    localStorage.removeItem('niangelos_active_school');
    router.push('/auth/login');
  }, [signOut, router]);

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
  };
}
