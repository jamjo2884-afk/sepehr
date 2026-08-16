'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { SocialAccount } from '@/types/social';
import type {
  SocialDataQualityReport,
  SocialDataQualitySeverity,
} from '@/types/social';
import { SOCIAL_DATA_QUALITY_SEVERITY_LABELS } from '@/services/social-data-quality.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import { jalaliMonthName } from '@/services/social-analytics';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** One severity badge: icon + text label + tint — never color alone. */
function SeverityBadge({ severity }: { severity: SocialDataQualitySeverity }) {
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

/** One headline summary card. */
function SummaryCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4">
      <Icon className={cn('h-5 w-5 shrink-0', className)} />
      <div className="flex flex-col">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {value.toLocaleString('fa-IR')}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/**
 * «کیفیت داده» — read-only data-quality report for the social accounts
 * page. Fetches GET /api/social/data-quality (server-side analysis; no
 * metrics are sent to the browser) and shows the headline counts plus the
 * issue list. `accounts` is the page's own account list, used only to
 * render account names next to issues.
 */
export function DataQualityPanel({
  accounts,
  reloadKey = 0,
}: {
  accounts: SocialAccount[];
  reloadKey?: number;
}) {
  const [report, setReport] = useState<SocialDataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch('/api/social/data-quality')
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data: SocialDataQualityReport) => {
        if (active) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">کیفیت داده</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          خواندن گزارش کیفیت داده انجام نشد.
        </div>
      ) : report ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              icon={CheckCircle2}
              label="حساب‌های سالم"
              value={report.summary.healthyAccounts}
              className="text-success"
            />
            <SummaryCard
              icon={Activity}
              label="نیازمند بررسی"
              value={report.summary.warningAccounts}
              className="text-warning"
            />
            <SummaryCard
              icon={ShieldAlert}
              label="مشکل جدی"
              value={report.summary.criticalAccounts}
              className="text-destructive"
            />
            <SummaryCard
              icon={AlertTriangle}
              label="کل مشکلات"
              value={report.summary.totalIssues}
              className="text-muted-foreground"
            />
          </div>

          {report.issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              همهٔ حساب‌ها سالم هستند؛ مشکلی در کیفیت داده‌ها یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/40">
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      شدت
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      حساب
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      پلتفرم
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      مشکل
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      تاریخ
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                      فیلد
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.map((issue) => {
                    const account = issue.accountId
                      ? accountById.get(issue.accountId)
                      : undefined;
                    return (
                      <tr
                        key={issue.id}
                        className="border-b border-border/50 last:border-0 hover:bg-surface/40"
                      >
                        <td className="px-4 py-2.5">
                          <SeverityBadge severity={issue.severity} />
                        </td>
                        <td className="px-4 py-2.5">
                          {account ? (
                            <span className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {account.brand}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {account.username}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {issue.platform
                            ? SOCIAL_PLATFORM_LABELS[issue.platform]
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {issue.message}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                          {issue.metricDate
                            ? jalaliMonthName(issue.metricDate)
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {issue.field
                            ? (SOCIAL_METRIC_FIELDS[issue.field]?.label ??
                              issue.field)
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
