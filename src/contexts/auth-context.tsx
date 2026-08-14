'use client';

import { useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAuthContext } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

/**
 * AuthProvider bridges Supabase auth with the client-side auth store.
 *
 * On mount it reads the persisted session, then subscribes to auth state
 * changes (sign-in, sign-out, token refresh). Whenever a session exists it
 * loads the user's profile + primary workspace via `fetchAuthContext` and
 * publishes them to the store; when the session disappears it resets the
 * store to `unauthenticated`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setContext = useAuthStore((s) => s.setContext);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        if (session) {
          setSession(session);
          await loadContext(session.user.id, session.user.email ?? '');
        } else {
          reset();
        }
      } catch (err) {
        console.warn('[auth] Could not restore session.', err);
        if (active) reset();
      }
    };

    const loadContext = async (userId: string, email: string) => {
      try {
        const { profile, workspace } = await fetchAuthContext(userId, email);
        if (!active) return;
        if (profile) {
          setContext({ profile, workspace, role: profile.role });
        } else {
          // Profile row not created yet (e.g. trigger lag); stay
          // authenticated with just the session.
          setContext({ profile: null, workspace: null, role: null });
        }
      } catch (err) {
        console.warn('[auth] Could not load profile context.', err);
        if (active) {
          setContext({ profile: null, workspace: null, role: null });
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        void loadContext(session.user.id, session.user.email ?? '');
      } else {
        reset();
      }
    });

    void loadSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [reset, setContext, setSession]);

  return <>{children}</>;
}