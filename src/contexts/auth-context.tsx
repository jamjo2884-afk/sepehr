'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useAuthStore } from '@/stores/auth.store';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { isDemoModeClient } from '@/lib/demo';
import { fetchAuthContext } from '@/services/auth.service';
import type { Workspace } from '@/types/auth';

const DEMO_WORKSPACE: Workspace = {
  id: 'demo',
  name: 'Media Deck',
  slug: 'media-deck',
  logoUrl: null,
  createdAt: new Date().toISOString(),
};

/**
 * AuthProvider — single source of truth for the client auth state.
 *
 * Demo mode: applies the synthetic demo session (Media Deck demo workspace,
 * owner role) so the preview keeps working without a backend.
 *
 * Real auth mode: subscribes to the Supabase session (login, logout, token
 * refresh, recovery) and hydrates the store with the real user + profile +
 * workspace. No demo fallback happens here.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const applySession = useCallback(async (session: Session) => {
    const store = useAuthStore.getState();
    store.setSession(session);
    try {
      const { profile, workspace } = await fetchAuthContext(
        session.user.id,
        session.user.email ?? '',
      );
      store.setContext({
        profile,
        workspace,
        role: profile?.role ?? null,
      });
    } catch {
      // Profile/workspace lookup failed (e.g. RLS or missing trigger row).
      // Keep the authenticated session — UI degrades gracefully to fallbacks.
      store.setStatus('authenticated');
    }
  }, []);

  useEffect(() => {
    if (isDemoModeClient()) {
      // Demo session — never touches Supabase auth state.
      useAuthStore.getState().setContext({
        profile: null,
        workspace: DEMO_WORKSPACE,
        role: 'owner',
      });
      return;
    }

    let disposed = false;

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (disposed) return;
      if (session) {
        void applySession(session);
      } else {
        useAuthStore.getState().reset();
      }
    });

    // Initial hydration (fires with the persisted session if one exists).
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (disposed) return;
      if (data.session) {
        void applySession(data.session);
      } else {
        useAuthStore.getState().reset();
      }
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  return <>{children}</>;
}
