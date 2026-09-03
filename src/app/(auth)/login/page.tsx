'use client';

import { LoginForm } from './login-form';

/**
 * Login page — renders the real Supabase login form.
 * Middleware redirects unauthenticated visitors here with ?next=<path>,
 * which the form honors after a successful sign-in.
 */
export default function LoginPage() {
  return <LoginForm />;
}
