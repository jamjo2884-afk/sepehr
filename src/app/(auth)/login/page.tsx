'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Login is currently disabled — authentication is bypassed (demo mode),
 * so this route redirects straight to the dashboard.
 * Re-enable by rendering <LoginForm /> from ./login-form instead.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/command-center');
  }, [router]);

  return null;
}
