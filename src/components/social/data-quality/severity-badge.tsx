'use client';

import {
  Activity,
  CheckCircle2,
  Clock,
  EyeOff,
  Info,
  ShieldAlert,
} from 'lucide-react';
import type { SocialDataQualitySeverity } from '@/types/social';
import { SOCIAL_DATA_QUALITY_SEVERITY_LABELS } from '@/services/social-data-quality.service';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** One severity badge: icon + text label + tint — never color alone. */
export function SeverityBadge({
  severity,
}: {
  severity: SocialDataQualitySeverity;
}) {
  const meta = {
    critical: {
      label: SOCIAL_DATA_QUALITY_SEVERITY_LABELS.critical,
      icon: ShieldAlert,
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    },
    warning: {
      label: SOCIAL_DATA_QUALITY_SEVERITY_LABELS.warning,
      icon: Activity,
      className: 'border-warning/30 bg-warning/10 text-warning',
    },
    info: {
      label: SOCIAL_DATA_QUALITY_SEVERITY_LABELS.info,
      icon: Info,
      className: 'border-border bg-surface text-muted-foreground',
    },
  }[severity];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap', meta.className)}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

/** Review-state badge: icon + text label + tint (used in lists/dialogs). */
export function ReviewStatusBadge({
  status,
}: {
  status: 'open' | 'reviewed' | 'ignored';
}) {
  const meta = {
    open: {
      label: 'باز',
      icon: Clock,
      className: 'border-border bg-surface text-muted-foreground',
    },
    reviewed: {
      label: 'بررسی‌شده',
      icon: CheckCircle2,
      className: 'border-success/30 bg-success/10 text-success',
    },
    ignored: {
      label: 'نادیده‌گرفته‌شده',
      icon: EyeOff,
      className: 'border-secondary bg-secondary/40 text-muted-foreground',
    },
  }[status];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap', meta.className)}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
