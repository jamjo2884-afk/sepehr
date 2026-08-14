'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Download,
  ExternalLink,
  File,
  FolderKanban,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import {
  getAssetById,
  getProjectById,
} from '@/services/data.service';
import {
  MEDIA_ASSET_TYPE_LABELS,
  type MediaAsset,
  type MediaAssetType,
  type Project,
} from '@/types/domain';
import {
  formatJalaliDate,
  formatNumber,
  formatRelativeTime,
} from '@/utils/persian';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<MediaAssetType, LucideIcon> = {
  image: File,
  video: File,
  audio: File,
  document: File,
  archive: File,
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

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id);

  const [asset, setAsset] = useState<MediaAsset | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAssetById(id)
      .then(async (a) => {
        if (!active || !a) return;
        setAsset(a);
        setProject(await getProjectById(a.projectId));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <File className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">دارایی پیدا نشد.</p>
        <Link
          href="/assets"
          className="text-sm font-medium text-primary hover:underline"
        >
          بازگشت به دارایی‌ها
        </Link>
      </div>
    );
  }

  const Icon = TYPE_ICON[asset.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <button
        onClick={() => router.back()}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت
      </button>

      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
              TYPE_TONE[asset.type],
            )}
          >
            <Icon className="h-7 w-7" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              className="truncate text-2xl font-bold tracking-tight text-foreground"
              dir="ltr"
            >
              {asset.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {MEDIA_ASSET_TYPE_LABELS[asset.type]} · {formatBytes(asset.sizeBytes)}
            </p>
            {project ? (
              <Link
                href={`/projects/${encodeURIComponent(project.id)}`}
                className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                پروژه: {project.name}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {asset.url ? (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              باز کردن فایل
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              فایلی برای دانلود ثبت نشده است
            </span>
          )}
        </div>
      </header>

      {asset.tags.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Tag className="h-4 w-4 text-primary" />
            برچسب‌ها
          </h2>
          <div className="flex flex-wrap gap-2">
            {asset.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
        ساخته‌شده: {formatJalaliDate(new Date(asset.createdAt))} · آخرین
        به‌روزرسانی: {formatRelativeTime(new Date(asset.updatedAt))}
      </footer>
    </motion.div>
  );
}
