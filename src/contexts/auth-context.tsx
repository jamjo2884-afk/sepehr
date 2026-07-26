'use client';

import { useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { fetchAuthContext } from '@/services/auth.service';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setContext = useAuthStore((s) => s.setContext);
  const setStatus = useAuthStore((s) => s.setStatus);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let active = true;

    // Restore session on mount (persisted by Supabase storage).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        return data.session;
      })
      .catch(() => {
        if (active) setStatus('unauthenticated');
      });

    // Subscribe to auth changes. Wrap async work in an IIFE to avoid deadlock.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        (async () => {
          setSession(session);
          if (session?.user) {
            try {
              const { profile, workspace } = await fetchAuthContext(
                session.user.id,
                session.user.email ?? '',
              );
              setContext({ profile, workspace });
            } catch {
              setContext({ profile: null, workspace: null });
            }
          } else {
            reset();
          }
        })();
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setContext, setStatus, reset]);

  return <>{children}</>;
}
