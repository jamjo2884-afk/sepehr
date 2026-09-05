'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Search,
  type LucideIcon,
} from 'lucide-react';

import {
  MEDIA_ASSET_TYPE_LABELS,
  type MediaAsset,
  type MediaAssetType,
} from '@/types/domain';
import { formatNumber, formatRelativeTime } from '@/utils/persian';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<MediaAssetType, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  archive: FileArchive,
  other: File,
};

const TYPE_TONE: Record<MediaAssetType, string> = {
  image: 'bg-success/10 text-success',
  video: 'bg-primary/10 text-primary',
  audio: 'bg-warning/10 text-warning',
  document: 'bg-accent/10 text-accent',
  archive: 'bg-muted text-muted-foreground',
  other: 'bg-muted text-muted-foreground',
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${formatNumber(Number(v.toFixed(1)))} ${units[i]}`;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaAssetType | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data: { ok: boolean; assets: MediaAsset[] }) => {
        if (!active) return;
        if (data.ok) setAssets(data.assets);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [assets, typeFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length };
    for (const t of Object.keys(MEDIA_ASSET_TYPE_LABELS)) {
      c[t] = assets.filter((a) => a.type === t).length;
    }
    return c;
  }, [assets]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          دارایی‌های رسانه‌ای
        </h1>
        <p className="text-sm text-muted-foreground">
          فایل‌های پروژه‌ها — {formatNumber(assets.length)} دارایی
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              typeFilter === 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
            )}
          >
            همه ({formatNumber(counts.all)})
          </button>
          {(Object.keys(MEDIA_ASSET_TYPE_LABELS) as MediaAssetType[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  typeFilter === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/40',
                )}
              >
                {MEDIA_ASSET_TYPE_LABELS[t]} ({formatNumber(counts[t] ?? 0)})
              </button>
            ),
          )}
        </div>
        <div className="relative sm:mr-auto">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در نام یا برچسب..."
            className="w-full rounded-lg border border-border bg-surface/60 py-2 pr-9 pl-3 text-sm outline-none transition-colors focus:border-primary/50 sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-surface/60"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          <File className="mb-2 h-8 w-8 opacity-40" />
          دارایی‌ای با این فیلترها پیدا نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((asset) => {
            const Icon = TYPE_ICON[asset.type];
            return (
              <Link
                key={asset.id}
                href={`/assets/${encodeURIComponent(asset.id)}`}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      TYPE_TONE[asset.type],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {formatBytes(asset.sizeBytes)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p
                    className="line-clamp-1 text-sm font-semibold text-foreground"
                    dir="ltr"
                  >
                    {asset.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {MEDIA_ASSET_TYPE_LABELS[asset.type]}
                  </p>
                </div>
                {asset.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {asset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-auto text-[11px] text-muted-foreground">
                  به‌روزرسانی: {formatRelativeTime(new Date(asset.updatedAt))}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
