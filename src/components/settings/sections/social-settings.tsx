'use client';

import { useState, useEffect, useCallback } from 'react';
import { SettingsSection } from '@/components/settings/settings-section';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import type { SocialPlatform } from '@/types/domain';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformData {
  id: SocialPlatform;
  label: string;
  color: string;
  brandName: string;
  enabled: boolean;
  accountCount: number;
  connectedCount: number;
  errorCount: number;
  disconnectedCount: number;
  credentialConfigured: boolean;
  credentialStatus: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  metricCount: number;
}

interface SocialSettingsResponse {
  ok: boolean;
  platforms?: PlatformData[];
  errorCode?: string;
  errorMessage?: string;
}

/** Format a relative time string in Persian. */
function timeAgo(isoDate: string | null): string {
  if (!isoDate) return 'هنوز همگام‌سازی نشده';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 'هنوز همگام‌سازی نشده';
  const diffMs = now - then;
  if (diffMs < 0) return 'همین الان';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds} ثانیه پیش`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  return `${days} روز پیش`;
}

/** Status dot for a platform. */
function StatusDot({ status }: { status: 'active' | 'error' | 'inactive' }) {
  const colors = {
    active: 'bg-emerald-500',
    error: 'bg-red-500',
    inactive: 'bg-muted-foreground/40',
  };
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', colors[status])}
    />
  );
}

/** Loading skeleton for platform rows. */
function PlatformSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3 animate-pulse">
      <div className="h-9 w-9 rounded-lg bg-muted" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3.5 w-20 rounded bg-muted" />
        <div className="h-2.5 w-32 rounded bg-muted" />
      </div>
      <div className="h-6 w-11 rounded-full bg-muted" />
    </div>
  );
}

/** Toggle switch component. */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform',
          checked ? 'translate-x-1 rtl:-translate-x-1' : 'translate-x-6 rtl:-translate-x-6',
        )}
      />
    </button>
  );
}

export function SocialSettings() {
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<
    Record<string, boolean>
  >({});

  const fetchPlatforms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/social');
      const data: SocialSettingsResponse = await res.json();
      if (data.ok && data.platforms) {
        setPlatforms(data.platforms);
      } else {
        setError(data.errorMessage ?? 'خطا در بارگذاری اطلاعات.');
      }
    } catch {
      setError('خطا در اتصال به سرور.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  /** Toggle a platform's enabled state with optimistic update. */
  const handleToggle = useCallback(
    async (platformId: SocialPlatform, currentEnabled: boolean) => {
      const newEnabled = !currentEnabled;

      // Optimistic update
      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId ? { ...p, enabled: newEnabled } : p,
        ),
      );
      setTogglingMap((prev) => ({ ...prev, [platformId]: true }));

      try {
        const res = await fetch('/api/settings/social/platform', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: platformId, enabled: newEnabled }),
        });
        const data = await res.json();

        if (!data.ok) {
          // Rollback on failure
          setPlatforms((prev) =>
            prev.map((p) =>
              p.id === platformId ? { ...p, enabled: currentEnabled } : p,
            ),
          );
        }
      } catch {
        // Rollback on network error
        setPlatforms((prev) =>
          prev.map((p) =>
            p.id === platformId ? { ...p, enabled: currentEnabled } : p,
          ),
        );
      } finally {
        setTogglingMap((prev) => ({ ...prev, [platformId]: false }));
      }
    },
    [],
  );

  const activePlatforms = platforms.filter((p) => p.accountCount > 0);
  const availablePlatforms = platforms.filter((p) => p.accountCount === 0);

  return (
    <SettingsSection
      title="شبکه‌های اجتماعی"
      description="مدیریت وضعیت و تنظیمات شبکه‌های اجتماعی"
    >
      {/* Header stats */}
      {!loading && platforms.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">
              {platforms.filter((p) => p.enabled).length} شبکه فعال
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
            <Wifi className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">
              {platforms.reduce((s, p) => s + p.connectedCount, 0)} حساب متصل
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {platforms.reduce((s, p) => s + p.accountCount, 0)} حساب کل
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <PlatformSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={fetchPlatforms}
            className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Platform list */}
      {!loading && !error && (
        <div className="flex flex-col gap-2">
          {/* Active platforms */}
          {activePlatforms.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-1 pt-1">
                شبکه‌های دارای حساب
              </p>
              {activePlatforms.map((platform) => (
                <PlatformRow
                  key={platform.id}
                  platform={platform}
                  toggling={togglingMap[platform.id] ?? false}
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}

          {/* Available but unused platforms */}
          {availablePlatforms.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-1 pt-3">
                شبکه‌های در دسترس
              </p>
              {availablePlatforms.map((platform) => (
                <PlatformRow
                  key={platform.id}
                  platform={platform}
                  toggling={togglingMap[platform.id] ?? false}
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}
        </div>
      )}
    </SettingsSection>
  );
}

function PlatformRow({
  platform,
  toggling,
  onToggle,
}: {
  platform: PlatformData;
  toggling: boolean;
  onToggle: (id: SocialPlatform, currentEnabled: boolean) => void;
}) {
  // Determine overall platform status
  const platformStatus: 'active' | 'error' | 'inactive' =
    !platform.enabled
      ? 'inactive'
      : platform.errorCount > 0
        ? 'error'
        : platform.connectedCount > 0
          ? 'active'
          : 'inactive';

  // Determine sync status text
  let syncText: string;
  if (!platform.enabled) {
    syncText = 'غیرفعال';
  } else if (platform.lastSyncAt) {
    syncText = timeAgo(platform.lastSyncAt);
  } else if (platform.accountCount === 0) {
    syncText = platform.credentialStatus;
  } else {
    syncText = 'هنوز همگام‌سازی نشده';
  }

  // Sync status icon
  let SyncIcon = Clock;
  let syncColor = 'text-muted-foreground';
  if (platform.lastSyncStatus === 'success') {
    SyncIcon = CheckCircle2;
    syncColor = 'text-emerald-500';
  } else if (platform.lastSyncStatus === 'error') {
    SyncIcon = AlertCircle;
    syncColor = 'text-red-500';
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3 transition-colors hover:bg-surface/80',
        !platform.enabled && 'opacity-60',
      )}
    >
      {/* Platform icon */}
      <SocialPlatformIcon
        platform={platform.id}
        className="h-9 w-9 shrink-0 rounded-lg"
        iconClassName="h-4.5 w-4.5"
      />

      {/* Platform info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {platform.label}
          </span>
          <StatusDot status={platformStatus} />
          {platform.accountCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {platform.accountCount} حساب
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          {/* Sync status */}
          <span className="flex items-center gap-1">
            <SyncIcon className={cn('h-3 w-3 shrink-0', syncColor)} />
            {syncText}
          </span>

          {/* Credential status */}
          {platform.accountCount > 0 && platform.enabled && (
            <span className="flex items-center gap-1">
              {platform.credentialConfigured ? (
                <Wifi className="h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <WifiOff className="h-3 w-3 shrink-0 text-amber-500" />
              )}
              {platform.credentialConfigured ? 'متصل' : 'تنظیم نشده'}
            </span>
          )}

          {/* Metric count */}
          <span>{platform.metricCount} شاخص</span>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex shrink-0 items-center gap-2">
        {toggling && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        )}
        <Toggle
          checked={platform.enabled}
          onChange={() => onToggle(platform.id, platform.enabled)}
          disabled={toggling}
        />
      </div>
    </div>
  );
}
