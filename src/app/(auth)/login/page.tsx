'use client';

import { Suspense } from 'react';
import { LoginForm } from './login-form';

/**
 * Login page — renders the real Supabase login form.
 * Middleware redirects unauthenticated visitors here with ?next=<path>,
 * which the form honors after a successful sign-in.
 *
 * LoginForm reads `?next=` via useSearchParams() so it can carry the target
 * (e.g. /invite/<token>) onto the "create account" link. Next.js requires that
 * hook to sit inside a Suspense boundary for the statically prerendered page —
 * without this the production build fails with
 * "useSearchParams() should be wrapped in a suspense boundary at page /login".
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
