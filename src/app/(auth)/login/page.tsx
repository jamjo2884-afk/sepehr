'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Login page — always redirects to dashboard.
 * Auth is handled at the API level (demo user fallback).
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/command-center');
  }, [router]);

  return null;
}
