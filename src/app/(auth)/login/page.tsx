'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from './login-form';

/**
 * Login page.
 * Redirects to dashboard in demo mode (no session cookie).
 * Shows login form when Supabase session exists.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if there's a Supabase session cookie
    const hasSession = document.cookie
      .split(';')
      .some((c) => c.trim().startsWith('sb-') && c.includes('-auth-token'));

    if (!hasSession) {
      // Demo mode or no session — redirect to dashboard
      router.replace('/command-center');
    }
  }, [router]);

  return <LoginForm />;
}
