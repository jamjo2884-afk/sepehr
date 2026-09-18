'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'mediadeck:guest-banner-dismissed';

/**
 * Persistent demo banner for guest sessions.
 *
 * Rendered from the root layout with a server-resolved `isGuest` flag
 * (getAuthUser → guest identity), so it never appears for real sessions.
 * Dismissal is stored in localStorage and survives reloads; the banner
 * re-appears if localStorage is unavailable/cleared.
 */
export function GuestBanner({ isGuest }: { isGuest: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isGuest) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) !== '1') {
        setVisible(true);
      }
    } catch {
      // Storage unavailable (private mode, etc.) — show the banner anyway.
      setVisible(true);
    }
  }, [isGuest]);

  if (!isGuest || !visible) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex w-full items-center justify-center gap-3 bg-amber-400/95 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
    >
      <span>این نسخهٔ نمایشی است.</span>
      <button
        type="button"
        aria-label="بستن بنر"
        className="rounded px-2 py-0.5 text-slate-900/70 transition hover:bg-slate-900/10 hover:text-slate-900"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            // Ignore storage failures — hiding for this session is enough.
          }
          setVisible(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
