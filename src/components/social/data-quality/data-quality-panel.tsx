'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SocialAccount } from '@/types/social';
import type {
  SocialDataQualityIssueReviewStatus,
  SocialDataQualityIssueWithReview,
  SocialDataQualityReportWithReviews,
} from '@/types/social';
import {
  filterIssuesByReviewStatus,
  issueToReviewInput,
  SOCIAL_DATA_QUALITY_REVIEW_LABELS,
} from '@/services/social-data-quality-review.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import { jalaliMonthName } from '@/services/social-analytics';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SeverityBadge, ReviewStatusBadge } from './severity-badge';
import { IssueDetailDialog } from './issue-detail-dialog';

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

/** One small review-count stat (open / reviewed / ignored). */
function ReviewStat({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={cn('h-3.5 w-3.5', className)} />
      {label}:{' '}
      <span className="font-semibold tabular-nums text-foreground">
        {value.toLocaleString('fa-IR')}
      </span>
    </span>
  );
}

type ReviewFilter = 'all' | SocialDataQualityIssueReviewStatus;

const REVIEW_FILTERS: Array<{ key: ReviewFilter; label: string }> = [
  { key: 'all', label: 'همه' },
  { key: 'open', label: 'باز' },
  { key: 'reviewed', label: 'بررسی‌شده' },
  { key: 'ignored', label: 'نادیده‌گرفته‌شده' },
];

/**
 * «کیفیت داده» — read-only data-quality report for the social accounts
 * page, with human review actions (Phase 16 Review Center). Fetches
 * GET /api/social/data-quality (server-side analysis + merged review
 * state). Review actions only write the review table — never metrics or
 * accounts.
 */
export function DataQualityPanel({
  accounts,
  reloadKey = 0,
  onManageAccount,
}: {
  accounts: SocialAccount[];
  reloadKey?: number;
  onManageAccount?: (accountId: string) => void;
}) {
  const [report, setReport] =
    useState<SocialDataQualityReportWithReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedIssue, setSelectedIssue] =
    useState<SocialDataQualityIssueWithReview | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch('/api/social/data-quality')
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data: SocialDataQualityReportWithReviews) => {
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
  }, [reloadKey, refreshKey]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const openIssue = (issue: SocialDataQualityIssueWithReview) => {
    setSelectedIssue(issue);
    setDetailOpen(true);
  };

  const applyReview = async (status: 'reviewed' | 'ignored') => {
    if (!selectedIssue) return;
    setBusy(true);
    try {
      const res = await fetch('/api/social/data-quality/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueToReviewInput(selectedIssue, status)),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success(
        status === 'reviewed'
          ? 'به‌عنوان بررسی‌شده ثبت شد.'
          : 'نادیده گرفته شد.',
      );
      setDetailOpen(false);
      setSelectedIssue(null);
      load();
    } catch {
      toast.error('ثبت وضعیت بررسی انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const reopenIssue = async () => {
    if (!selectedIssue) return;
    setBusy(true);
    try {
      const res = await fetch('/api/social/data-quality/reviews', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType: selectedIssue.type,
          accountId: selectedIssue.accountId,
          metricId: selectedIssue.metricId
            ? Number(selectedIssue.metricId)
            : null,
          field: selectedIssue.field,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('مسئله به وضعیت «باز» بازگشت.');
      setDetailOpen(false);
      setSelectedIssue(null);
      load();
    } catch {
      toast.error('بازگرداندن وضعیت بررسی انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const selectedAccount = selectedIssue?.accountId
    ? (accountById.get(selectedIssue.accountId) ?? null)
    : null;
  const selectedHref =
    selectedIssue && selectedAccount
      ? `/social/${encodeURIComponent(
          [
            selectedAccount.brand,
            selectedAccount.platform,
            selectedAccount.username,
          ].join('|'),
        )}`
      : null;

  const visibleIssues = report
    ? filterIssuesByReviewStatus(report.issues, filter)
    : [];

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

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface/40 px-4 py-2.5">
            <ReviewStat
              icon={Clock}
              label={SOCIAL_DATA_QUALITY_REVIEW_LABELS.open}
              value={report.summary.openIssues}
            />
            <ReviewStat
              icon={CheckCircle2}
              label="بررسی‌شده"
              value={report.summary.reviewedIssues}
              className="text-success"
            />
            <ReviewStat
              icon={EyeOff}
              label="نادیده‌گرفته‌شده"
              value={report.summary.ignoredIssues}
            />
          </div>

          {report.issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              همهٔ حساب‌ها سالم هستند؛ مشکلی در کیفیت داده‌ها یافت نشد.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {REVIEW_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    variant={filter === f.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[920px] text-sm">
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
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        وضعیت بررسی
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleIssues.map((issue) => {
                      const account = issue.accountId
                        ? (accountById.get(issue.accountId) ?? null)
                        : null;
                      return (
                        <tr
                          key={issue.id}
                          className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-surface/40"
                          onClick={() => openIssue(issue)}
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
                          <td className="px-4 py-2.5">
                            <ReviewStatusBadge status={issue.reviewStatus} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {visibleIssues.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
                  {filter === 'all'
                    ? 'مشکلی یافت نشد.'
                    : `هیچ مسئله‌ای با وضعیت «${REVIEW_FILTERS.find((f) => f.key === filter)?.label}» وجود ندارد.`}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <IssueDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        issue={selectedIssue}
        account={selectedAccount}
        accountHref={selectedHref}
        busy={busy}
        onReview={applyReview}
        onReopen={reopenIssue}
        onManageAccount={(accountId) => {
          setDetailOpen(false);
          onManageAccount?.(accountId);
        }}
      />
    </section>
  );
}
