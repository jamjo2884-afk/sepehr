'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsRow } from '@/components/settings/settings-row';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toPersianDigits } from '@/utils/persian';

/**
 * بخش «حالت مهمان» — DB-backed runtime toggle.
 *
 * - Switch only flips after a secondary confirmation dialog when turning ON.
 * - The dialog explicitly states that ONLY demo data (the seeded demo
 *   workspace) becomes publicly readable — never real tenant data.
 * - After a successful toggle the user sees "تغییر تا ۱۰ ثانیه دیگر اعمال
 *   می‌شود" because server instances hold a 10s TTL cache of the flag.
 */

interface GuestModeResponse {
  ok: boolean;
  enabled?: boolean;
  changedAt?: string | null;
  changedBy?: string | null;
  source?: 'db' | 'env' | 'demo' | 'default';
  propagationMs?: number;
  errorCode?: string;
  errorMessage?: string;
}

function useGuestMode() {
  const [enabled, setEnabled] = useState(false);
  const [propagationMs, setPropagationMs] = useState(10_000);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/guest-mode');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GuestModeResponse;
      if (data.ok && typeof data.enabled === 'boolean') {
        setEnabled(data.enabled);
        if (typeof data.propagationMs === 'number') {
          setPropagationMs(data.propagationMs);
        }
      }
    } catch {
      // Settings requires a real session; demo-mode local runs 401 here.
      // Keep the switch OFF and non-fatal.
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: boolean): Promise<boolean> => {
      setIsSaving(true);
      try {
        const res = await fetch('/api/settings/guest-mode', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
        });
        const data = (await res.json()) as GuestModeResponse;
        if (!res.ok || !data.ok) {
          toast.error(data.errorMessage ?? 'ذخیرهٔ تغییرات انجام نشد.');
          return false;
        }
        setEnabled(next);
        if (typeof data.propagationMs === 'number') {
          setPropagationMs(data.propagationMs);
        }
        toast.success(
          `تغییر تا ${toPersianDigits(Math.ceil(propagationMs / 1000))} ثانیه دیگر اعمال می‌شود.`,
        );
        return true;
      } catch {
        toast.error('ذخیرهٔ تغییرات انجام نشد.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [propagationMs],
  );

  return { enabled, isLoading, isSaving, save };
}

export function GuestModeSettings() {
  const { enabled, isLoading, isSaving, save } = useGuestMode();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Turning ON requires explicit confirmation; turning OFF applies at once.
      setConfirmOpen(true);
    } else {
      void save(false);
    }
  };

  const handleConfirm = async () => {
    if (await save(true)) {
      setConfirmOpen(false);
    }
  };

  return (
    <SettingsSection
      title="حالت مهمان"
      description="دسترسی فقط‌خواندنی بازدیدکنندگان بدون حساب به داده‌های نمایشی"
    >
      <SettingsRow
        label="فعال‌سازی حالت مهمان"
        description="وقتی روشن باشد، بازدیدکنندگان بدون ورود می‌توانند داده‌های دمو را ببینند."
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={enabled}
            disabled={isSaving}
            onCheckedChange={handleToggle}
            aria-label="حالت مهمان"
          />
        )}
      </SettingsRow>

      <p className="text-xs leading-5 text-muted-foreground">
        حالت مهمان به‌صورت متمرکز در پایگاه‌داده ذخیره می‌شود و هر تغییر آن با
        نام و زمان انجام‌دهنده در گزارش رخدادها ثبت می‌گردد.
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>فعال‌سازی حالت مهمان</DialogTitle>
            <DialogDescription>
              با فعال‌کردن حالت مهمان، داده‌های نمایشی (فضای کاری دمو) بدون نیاز
              به ورود در دسترس عموم قرار می‌گیرد. این دسترسی فقط‌خواندنی است و
              تنها شامل داده‌های دمو می‌شود — داده‌های واقعی فضاهای کاری دیگر
              هرگز نمایش داده نمی‌شود.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isSaving}
            >
              انصراف
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isSaving}>
              {isSaving && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              تأیید و فعال‌سازی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
