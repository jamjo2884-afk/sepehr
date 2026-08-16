'use client';

import Link from 'next/link';
import { CheckCircle2, Eye, PenLine, RotateCcw, XCircle } from 'lucide-react';
import type { SocialAccount } from '@/types/social';
import type { SocialDataQualityIssueWithReview } from '@/types/social';
import {
  SOCIAL_DATA_QUALITY_ISSUE_TYPE_LABELS,
  SOCIAL_DATA_QUALITY_SEVERITY_LABELS,
} from '@/services/social-data-quality.service';
import { SOCIAL_DATA_QUALITY_REVIEW_LABELS } from '@/services/social-data-quality-review.service';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import { jalaliMonthName } from '@/services/social-analytics';
import { formatNumber } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SeverityBadge, ReviewStatusBadge } from './severity-badge';

/** One label/value row of the detail. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

/**
 * Issue detail: severity, type, Persian message, account / platform /
 * metric / field context, current value (when the detector stored one) and
 * review actions. Review actions NEVER mutate metrics/accounts — they only
 * write the review table. «مشاهده حساب» and «مدیریت آمار» reuse existing
 * routes/UI; no fake links are created for issues without an account or
 * metric.
 */
export function IssueDetailDialog({
  open,
  onOpenChange,
  issue,
  account,
  accountHref,
  busy,
  onReview,
  onReopen,
  onManageAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: SocialDataQualityIssueWithReview | null;
  account: SocialAccount | null;
  accountHref: string | null;
  busy: boolean;
  onReview: (status: 'reviewed' | 'ignored') => void;
  onReopen: () => void;
  onManageAccount: (accountId: string) => void;
}) {
  const storedValue =
    issue && typeof issue.details?.storedValue === 'number'
      ? (issue.details.storedValue as number)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>جزئیات مسئلهٔ کیفیت داده</DialogTitle>
          <DialogDescription>
            این بخش فقط گزارش می‌دهد؛ هیچ داده‌ای تغییر نمی‌کند.
          </DialogDescription>
        </DialogHeader>

        {issue ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={issue.severity} />
              <ReviewStatusBadge status={issue.reviewStatus} />
            </div>

            <div className="rounded-xl border border-border bg-surface/40 p-3 text-sm text-foreground">
              {issue.message}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow label="نوع مسئله">
                {SOCIAL_DATA_QUALITY_ISSUE_TYPE_LABELS[issue.type]}
              </DetailRow>
              <DetailRow label="شدت">
                {SOCIAL_DATA_QUALITY_SEVERITY_LABELS[issue.severity]}
              </DetailRow>
              <DetailRow label="حساب">
                {account ? (
                  <span className="flex flex-col">
                    <span className="font-medium">{account.brand}</span>
                    <span className="text-xs text-muted-foreground">
                      {account.username}
                    </span>
                  </span>
                ) : (
                  '—'
                )}
              </DetailRow>
              <DetailRow label="پلتفرم">
                {issue.platform ? SOCIAL_PLATFORM_LABELS[issue.platform] : '—'}
              </DetailRow>
              <DetailRow label="تاریخ متریک">
                {issue.metricDate ? jalaliMonthName(issue.metricDate) : '—'}
              </DetailRow>
              <DetailRow label="شناسهٔ متریک">
                {issue.metricId ?? '—'}
              </DetailRow>
              <DetailRow label="فیلد">
                {issue.field
                  ? (SOCIAL_METRIC_FIELDS[issue.field]?.label ?? issue.field)
                  : '—'}
              </DetailRow>
              <DetailRow label="مقدار فعلی">
                {storedValue !== null ? formatNumber(storedValue) : '—'}
              </DetailRow>
              <DetailRow label="وضعیت بررسی">
                {SOCIAL_DATA_QUALITY_REVIEW_LABELS[issue.reviewStatus]}
              </DetailRow>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {accountHref && account ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  asChild
                >
                  <Link href={accountHref}>
                    <Eye className="h-3.5 w-3.5" />
                    مشاهده حساب
                  </Link>
                </Button>
              ) : null}
              {account ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => onManageAccount(account.id)}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  مدیریت آمار
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {issue.reviewStatus !== 'reviewed' ? (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={busy}
                  onClick={() => onReview('reviewed')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  بررسی شد
                </Button>
              ) : null}
              {issue.reviewStatus !== 'ignored' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={busy}
                  onClick={() => onReview('ignored')}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  نادیده گرفتن
                </Button>
              ) : null}
              {issue.reviewStatus !== 'open' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  disabled={busy}
                  onClick={onReopen}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  بازگشت به بررسی
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
