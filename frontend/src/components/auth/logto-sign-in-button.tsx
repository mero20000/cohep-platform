'use client';

import { useLogto } from '@logto/react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface LogtoSignInButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function LogtoSignInButton({
  className,
  variant = 'default',
  size = 'default',
}: LogtoSignInButtonProps) {
  const { signIn } = useLogto();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await signIn(`${window.location.origin}/api/logto/callback`);
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        'Sign in with Logto'
      )}
    </Button>
  );
}
