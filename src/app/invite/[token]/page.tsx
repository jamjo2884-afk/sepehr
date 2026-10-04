'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase-browser';

/**
 * /invite/[token] — landing page for a manual invitation link.
 *
 * The flow is deliberately two steps because the invitee must be SIGNED IN with
 * the invited email address: the SECURITY DEFINER accept_workspace_invitation()
 * RPC compares auth.users.email against workspace_invitations.email and refuses
 * a mismatch. So this page checks the session first and sends anonymous visitors
 * to /login?next=... rather than showing a failure they cannot act on.
 */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? '';

  const [status, setStatus] = useState<
    'checking' | 'ready' | 'signed-out' | 'error'
  >('checking');
  const [error, setError] = useState<string>('');
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // Read the session from the browser client — no extra API needed.
        const { data } = await supabaseBrowser.auth.getSession();
        if (data.session?.user) {
          if (!cancelled) setStatus('ready');
          return;
        }
      } catch {
        // fall through to the signed-out view
      }
      // No session: show the signed-out view rather than force-redirecting, so
      // a brand-new invitee can choose to CREATE an account. That path is what
      // makes the invite-aware signup work — registering with ?next=/invite/<token>
      // lets the database trigger join them without a personal workspace.
      if (!cancelled) setStatus('signed-out');
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  const accept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch('/api/workspace/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        errorMessage?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.errorMessage ?? data.error ?? 'پذیرش دعوت انجام نشد.');
        setStatus('error');
        return;
      }

      toast.success('به فضای کاری اضافه شدید.');
      router.replace('/');
      router.refresh();
    } catch {
      setError('پذیرش دعوت انجام نشد.');
      setStatus('error');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface/60 p-6 text-center">
        {status === 'checking' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">در حال بررسی دعوت...</p>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex flex-col items-center gap-4">
            <UserCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                دعوت به فضای کاری
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                برای پیوستن، با همان ایمیلی که دعوت برایش ارسال شده وارد شده‌اید.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void accept()}
              disabled={isAccepting}
              className="w-full"
            >
              {isAccepting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              پذیرش دعوت و پیوستن
            </Button>
          </div>
        )}

        {status === 'signed-out' && (
          <div className="flex flex-col items-center gap-4">
            <UserCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                دعوت به فضای کاری
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                برای پیوستن، با همان ایمیلی که دعوت برایش ارسال شده وارد شوید یا
                حساب بسازید.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button
                type="button"
                className="w-full"
                onClick={() =>
                  router.push(
                    `/login?next=${encodeURIComponent(`/invite/${token}`)}`,
                  )
                }
              >
                ورود به حساب
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  router.push(
                    `/register?next=${encodeURIComponent(`/invite/${token}`)}`,
                  )
                }
              >
                ساخت حساب جدید
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground">
              پذیرش دعوت ممکن نشد
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" onClick={() => router.push('/')}>
              بازگشت به داشبورد
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
