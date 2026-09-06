'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Notification } from '@/types/index';
import { formatRelativeTime } from '@/utils/persian';
import { Button } from '@/components/ui/button';

type LoadState = 'loading' | 'ready' | 'error';

export default function NotificationsPage() {
  const [state, setState] = useState<LoadState>('loading');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      const body = (await res.json()) as {
        ok: boolean;
        notifications: Notification[];
        unreadCount: number;
      };
      if (!body.ok) throw new Error('failed');
      setNotifications(body.notifications ?? []);
      setUnread(body.unreadCount ?? 0);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setNotifications((list) =>
        list.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
    }
  };

  const markAllRead = async () => {
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    const body = (await res.json()) as { ok: boolean };
    if (res.ok && body.ok) {
      toast.success('همه اعلان‌ها خوانده شدند.');
      await load();
    } else {
      toast.error('ثبت خواندن اعلان‌ها ناموفق بود.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            اعلان‌ها
          </h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0
              ? `${unread.toLocaleString('fa-IR')} اعلان خوانده‌نشده`
              : 'همه اعلان‌ها خوانده شده‌اند'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
          <Button
            size="sm"
            onClick={() => void markAllRead()}
            disabled={unread === 0}
          >
            <CheckCheck className="h-4 w-4" />
            خواندن همه
          </Button>
        </div>
      </header>

      {state === 'loading' ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : state === 'error' ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-10 text-center">
          <Bell className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">
            دریافت اعلان‌ها ممکن نشد.
          </p>
          <Button onClick={() => void load()}>تلاش دوباره</Button>
        </section>
      ) : notifications.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            اعلانی وجود ندارد.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const inner = (
              <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/30">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.read ? 'bg-muted' : 'bg-primary'
                  }`}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p
                    className={`text-sm ${
                      n.read
                        ? 'text-muted-foreground'
                        : 'font-medium text-foreground'
                    }`}
                  >
                    {n.title}
                  </p>
                  {n.description && (
                    <p className="text-xs text-muted-foreground">
                      {n.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelativeTime(new Date(n.createdAt))}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      void markRead(n.id);
                    }}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    خواندم
                  </button>
                )}
              </div>
            );
            return n.link ? (
              <li key={n.id}>
                <Link href={n.link}>{inner}</Link>
              </li>
            ) : (
              <li key={n.id}>{inner}</li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
