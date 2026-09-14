'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FileText,
  ListTodo,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';

import type { Brand } from '@/types/brand';
import { BRAND_STATUS_LABELS } from '@/types/brand';
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from '@/types/content';
import type { ContentStatus } from '@/types/content';
import {
  EXPENSE_CATEGORY_LABELS,
  FINANCE_CAMPAIGN_STATUS_LABELS,
} from '@/types/finance';
import type {
  BrandSocialPlatformStatus,
  BrandSocialSummary,
  BrandStatusProfile,
  BrandStatusProfileInput,
} from '@/types/brand-status';
import { SocialPlatformIcon } from '@/components/common/social-platform-icon';
import { BrandLogo } from '@/components/common/brand-logo';
import {
  formatNumber,
  toPersianDigits,
  formatRelativeTime,
} from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { platformFollowersLabel } from '@/constants/social-fields';

/* =========================================================================
 * Types & constants
 * ========================================================================= */

interface StatusPayload {
  ok: boolean;
  brand: Brand;
  profile: BrandStatusProfile | null;
  socialPlatforms: BrandSocialPlatformStatus[];
  socialSummary: BrandSocialSummary;
}

/** Brand-scoped rows from the existing module stacks (Content/Finance/Tasks). */
interface RelatedPayload {
  ok: boolean;
  contents: RelatedContent[] | null;
  expenses: RelatedExpense[] | null;
  campaigns: RelatedCampaign[] | null;
  tasks: RelatedTask[] | null;
}

interface RelatedContent {
  id: string;
  title: string;
  type: string;
  status: string;
  platform: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

interface RelatedExpense {
  id: string;
  brand: string;
  expenseDate: string;
  amount: number;
  category: string;
  campaignId: string | null;
  description: string;
}

interface RelatedCampaign {
  id: string;
  brand: string;
  name: string;
  startDate: string;
  endDate: string | null;
  budget: number;
  status: string;
  description: string;
}

interface RelatedTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  board: { id: string; title: string };
  list: { id: string; title: string };
}

type ProfileFormState = Omit<
  BrandStatusProfile,
  'id' | 'workspaceId' | 'brandId' | 'createdAt' | 'updatedAt'
>;

const EMPTY_PROFILE: ProfileFormState = {
  brandDefinition: '',
  brandMission: '',
  brandAudience: '',
  brandPosition: '',
  brandStrengths: '',
  brandWeaknesses: '',
  contentStatus: '',
  contentFormats: '',
  contentWeaknesses: '',
  contentNeeds: '',
  contentStaffingNeeds: '',
  publishingStatus: '',
  publishingDiscipline: '',
  publishingChannels: '',
  distributionIssues: '',
  distributionOpportunities: '',
  monetizationTopics: '',
  adCapacity: '',
  activeCampaigns: '',
  adOpportunities: '',
  adNeeds: '',
  topNeed: '',
  urgentNeeds: '',
  midtermNeeds: '',
  managementSuggestions: '',
};

/** UI copy for a section: fields are (id, label) pairs; multiline = textarea. */
interface StatusFieldSpec {
  key: keyof ProfileFormState;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

interface StatusSectionSpec {
  id: string;
  title: string;
  description?: string;
  fields: StatusFieldSpec[];
}

const STATUS_SECTIONS: StatusSectionSpec[] = [
  {
    id: 'identity',
    title: 'هویت و جایگاه برند',
    description: 'تعریف، مأموریت و جایگاه فعلی برند',
    fields: [
      {
        key: 'brandDefinition',
        label: 'تعریف کوتاه برند',
        multiline: true,
        placeholder: 'برند در یک تا دو جمله…',
      },
      {
        key: 'brandMission',
        label: 'مأموریت / کارکرد اصلی',
        multiline: true,
        placeholder: 'کارکرد اصلی و هدف برند…',
      },
      {
        key: 'brandAudience',
        label: 'مخاطب اصلی',
        multiline: true,
        placeholder: 'مخاطب هدف برند…',
      },
      {
        key: 'brandPosition',
        label: 'جایگاه فعلی برند',
        multiline: true,
        placeholder: 'جایگاه فعلی در فضای رسانه‌ای…',
      },
      {
        key: 'brandStrengths',
        label: 'نقاط قوت',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'brandWeaknesses',
        label: 'نقاط ضعف',
        multiline: true,
        placeholder: '…',
      },
    ],
  },
  {
    id: 'content',
    title: 'وضعیت تولید محتوا',
    description: 'ظرفیت و وضعیت فعلی تولید محتوا',
    fields: [
      {
        key: 'contentStatus',
        label: 'وضعیت فعلی تولید محتوا',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'contentFormats',
        label: 'فرمت‌های اصلی محتوا',
        multiline: true,
        placeholder: 'ویدیو، ریلز، پست…',
      },
      {
        key: 'contentWeaknesses',
        label: 'نقاط ضعف تولید محتوا',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'contentNeeds',
        label: 'نیازهای محتوایی',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'contentStaffingNeeds',
        label: 'نیاز به نیروی انسانی',
        multiline: true,
        placeholder: '…',
      },
    ],
  },
  {
    id: 'publishing',
    title: 'وضعیت انتشار و توزیع',
    description: 'نظم و کانال‌های انتشار محتوا',
    fields: [
      {
        key: 'publishingStatus',
        label: 'وضعیت انتشار',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'publishingDiscipline',
        label: 'نظم انتشار',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'publishingChannels',
        label: 'کانال‌های اصلی انتشار',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'distributionIssues',
        label: 'مشکلات توزیع',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'distributionOpportunities',
        label: 'فرصت‌های توسعه',
        multiline: true,
        placeholder: '…',
      },
    ],
  },
  {
    id: 'ads',
    title: 'وضعیت جریان‌سازی و تبلیغات',
    description: 'ظرفیت تبلیغاتی و کمپین‌های فعال',
    fields: [
      {
        key: 'monetizationTopics',
        label: 'موضوعات اصلی قابل جریان‌سازی',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'adCapacity',
        label: 'ظرفیت تبلیغاتی',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'activeCampaigns',
        label: 'کمپین‌های فعال',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'adOpportunities',
        label: 'فرصت‌های تبلیغاتی',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'adNeeds',
        label: 'نیازهای تبلیغاتی',
        multiline: true,
        placeholder: '…',
      },
    ],
  },
  {
    id: 'needs',
    title: 'نیازهای برند',
    description: 'نیازهای فعلی و پیشنهادهای مدیریتی',
    fields: [
      {
        key: 'topNeed',
        label: 'مهم‌ترین نیاز فعلی',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'urgentNeeds',
        label: 'نیازهای فوری',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'midtermNeeds',
        label: 'نیازهای میان‌مدت',
        multiline: true,
        placeholder: '…',
      },
      {
        key: 'managementSuggestions',
        label: 'پیشنهادهای مدیریتی',
        multiline: true,
        placeholder: '…',
      },
    ],
  },
];

const CONNECTION_LABELS: Record<string, string> = {
  connected: 'متصل',
  disconnected: 'قطع',
  error: 'خطا',
  pending: 'در انتظار',
};

/* =========================================================================
 * Page
 * ========================================================================= */

export default function BrandDetailPage() {
  const params = useParams();
  const brandId = typeof params.id === 'string' ? params.id : '';

  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Related-module data (Content / Finance / Tasks) — fetched once, lazily,
  // when one of those tabs is first opened.
  const [related, setRelated] = useState<RelatedPayload | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(false);

  // Form state (editable copy of the saved profile).
  const [form, setForm] = useState<ProfileFormState>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brandId)}/status`,
      );
      const data = (await res.json()) as StatusPayload;
      if (!res.ok || !data.ok) {
        setLoadError(true);
        setPayload(null);
      } else {
        setPayload(data);
        setForm(
          data.profile
            ? { ...EMPTY_PROFILE, ...stripProfileMeta(data.profile) }
            : EMPTY_PROFILE,
        );
        setDirty(false);
      }
    } catch {
      setLoadError(true);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRelated = useCallback(async () => {
    if (!brandId || relatedLoading) return;
    setRelatedLoading(true);
    setRelatedError(false);
    try {
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brandId)}/related`,
      );
      const data = (await res.json()) as RelatedPayload;
      if (!res.ok || !data.ok) {
        setRelatedError(true);
      } else {
        setRelated(data);
      }
    } catch {
      setRelatedError(true);
    } finally {
      setRelatedLoading(false);
    }
  }, [brandId, relatedLoading]);

  const handleTabChange = (value: string) => {
    if (value === 'content' || value === 'finance' || value === 'tasks') {
      // Lazy-load on first open; retry automatically after a previous failure.
      if (!related && !relatedLoading) loadRelated();
    }
  };

  const setField = (key: keyof ProfileFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!brandId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const body: BrandStatusProfileInput = { ...form };
      const res = await fetch(
        `/api/brands/${encodeURIComponent(brandId)}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        profile?: BrandStatusProfile;
      };
      if (!res.ok || !data.ok) {
        setSaveError(data.error ?? 'ذخیره‌سازی با خطا مواجه شد.');
      } else {
        setSaveSuccess(true);
        setDirty(false);
        // Refresh social snapshot + summary without a full loading flash.
        await load();
      }
    } catch {
      setSaveError('ذخیره‌سازی با خطا مواجه شد.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            در حال بارگذاری اطلاعات...
          </p>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive/40" />
        <p className="text-sm text-muted-foreground">
          دریافت اطلاعات با خطا مواجه شد.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            تلاش مجدد
          </Button>
          <Link href="/brands">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              بازگشت به برندها
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { brand, socialPlatforms, socialSummary } = payload;
  const profile = payload.profile;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo
            brand={brand.name}
            className="h-12 w-12 rounded-xl"
            iconClassName="text-lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">
                {brand.name}
              </h1>
              <Badge
                variant="outline"
                className={
                  brand.status === 'active'
                    ? 'border-transparent bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {BRAND_STATUS_LABELS[brand.status]}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              صورت وضعیت مدیریتی برند — پرونده کامل وضعیت برند
            </p>
          </div>
        </div>
        <Link href="/brands">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" />
            بازگشت به برندها
          </Button>
        </Link>
      </div>

      <Tabs
        defaultValue="status"
        className="gap-4"
        onValueChange={handleTabChange}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-surface/60">
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="social">شبکه‌های اجتماعی</TabsTrigger>
          <TabsTrigger value="status">صورت وضعیت برند</TabsTrigger>
          <TabsTrigger value="content">محتوا</TabsTrigger>
          <TabsTrigger value="finance">مالی</TabsTrigger>
          <TabsTrigger value="tasks">وظایف</TabsTrigger>
        </TabsList>

        {/* ================= نمای کلی ================= */}
        <TabsContent value="overview" className="flex flex-col gap-4">
          <BrandSummaryCard
            profile={profile}
            socialPlatforms={socialPlatforms}
            socialSummary={socialSummary}
          />
          <BaseInfoCard brand={brand} />
        </TabsContent>

        {/* ================= شبکه‌های اجتماعی ================= */}
        <TabsContent value="social" className="flex flex-col gap-4">
          <SocialSummaryBar summary={socialSummary} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {socialPlatforms.length === 0 && (
              <div className="rounded-xl border border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground md:col-span-2">
                اطلاعاتی برای نمایش وجود ندارد.
              </div>
            )}
            {socialPlatforms.map((row) => (
              <SocialPlatformCard key={row.platform} row={row} />
            ))}
          </div>
        </TabsContent>

        {/* ================= محتوا ================= */}
        <TabsContent value="content" className="flex flex-col gap-3">
          <RelatedSection
            loading={relatedLoading}
            error={relatedError}
            data={related?.contents}
            emptyText="هیچ محتوایی برای این برند ثبت نشده است."
            onRetry={loadRelated}
          >
            {(items) => (
              <div className="flex flex-col gap-2">
                {items.map((c) => (
                  <ContentRow key={c.id} content={c} />
                ))}
              </div>
            )}
          </RelatedSection>
        </TabsContent>

        {/* ================= مالی ================= */}
        <TabsContent value="finance" className="flex flex-col gap-3">
          <RelatedSection
            loading={relatedLoading}
            error={relatedError}
            data={
              related
                ? {
                    expenses: related.expenses,
                    campaigns: related.campaigns,
                  }
                : null
            }
            emptyText="هیچ داده مالی برای این برند ثبت نشده است."
            onRetry={loadRelated}
          >
            {({ expenses, campaigns }) => (
              <FinanceView expenses={expenses} campaigns={campaigns} />
            )}
          </RelatedSection>
        </TabsContent>

        {/* ================= وظایف ================= */}
        <TabsContent value="tasks" className="flex flex-col gap-3">
          <RelatedSection
            loading={relatedLoading}
            error={relatedError}
            data={related?.tasks}
            emptyText="هیچ وظیفه‌ای برای این برند ثبت نشده است."
            onRetry={loadRelated}
          >
            {(items) => (
              <div className="flex flex-col gap-2">
                {items.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            )}
          </RelatedSection>
        </TabsContent>

        {/* ================= صورت وضعیت برند ================= */}
        <TabsContent value="status" className="flex flex-col gap-4">
          <BrandSummaryCard
            profile={profile}
            socialPlatforms={socialPlatforms}
            socialSummary={socialSummary}
          />
          <BaseInfoCard brand={brand} compact />

          {STATUS_SECTIONS.map((section) => (
            <div
              key={section.id}
              className="rounded-xl border border-border bg-surface/60 p-4"
            >
              <div className="mb-3">
                <h3 className="text-sm font-bold text-foreground">
                  {section.title}
                </h3>
                {section.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {section.description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.fields.map((f) => (
                  <div
                    key={f.key}
                    className={`flex flex-col gap-1.5 ${f.multiline ? 'md:col-span-1' : ''}`}
                  >
                    <Label
                      htmlFor={`status-${f.key}`}
                      className="text-xs text-muted-foreground"
                    >
                      {f.label}
                    </Label>
                    {f.multiline ? (
                      <Textarea
                        id={`status-${f.key}`}
                        value={form[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="min-h-[70px] bg-background/60 text-sm"
                      />
                    ) : (
                      <Input
                        id={`status-${f.key}`}
                        value={form[f.key]}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="bg-background/60 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save bar */}
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
            <div className="text-xs">
              {saveError && (
                <span className="text-destructive">{saveError}</span>
              )}
              {saveSuccess && !saveError && (
                <span className="text-green-600 dark:text-green-400">
                  تغییرات با موفقیت ذخیره شد.
                </span>
              )}
              {dirty && !saveSuccess && !saveError && (
                <span className="text-amber-500">
                  تغییرات ذخیره‌نشده دارید.
                </span>
              )}
              {!dirty && !saveSuccess && !saveError && (
                <span className="text-muted-foreground">
                  {profile
                    ? `آخرین ذخیره‌سازی: ${formatRelativeTime(new Date(profile.updatedAt))}`
                    : 'هنوز اطلاعاتی ثبت نشده است — فرم خالی است.'}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              ذخیره
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
 * Shared pieces
 * ========================================================================= */

function stripProfileMeta(p: BrandStatusProfile): ProfileFormState {
  const {
    id: _id,
    workspaceId: _w,
    brandId: _b,
    createdAt: _c,
    updatedAt: _u,
    ...rest
  } = p;
  return rest;
}

function SocialSummaryBar({ summary }: { summary: BrandSocialSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface/60 p-4 md:grid-cols-4">
      <div>
        <p className="text-[10px] text-muted-foreground">شبکه‌های فعال</p>
        <p className="text-lg font-bold tabular-nums text-foreground">
          {toPersianDigits(String(summary.activePlatformCount))}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">مجموع دنبال‌کنندگان</p>
        <p className="text-lg font-bold tabular-nums text-foreground">
          {summary.totalAudience > 0
            ? formatNumber(summary.totalAudience)
            : '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">آخرین بروزرسانی</p>
        <p className="text-lg font-bold text-foreground">
          {summary.latestUpdateAt
            ? formatRelativeTime(new Date(summary.latestUpdateAt))
            : '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">آمار ناقص</p>
        <p className="text-lg font-bold tabular-nums text-foreground">
          {toPersianDigits(String(summary.incompleteCount))}
        </p>
      </div>
    </div>
  );
}

function SocialPlatformCard({ row }: { row: BrandSocialPlatformStatus }) {
  const hasAudience = row.availability === 'ok' && row.audience !== null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SocialPlatformIcon
            platform={row.platform}
            className="h-9 w-9 rounded-lg"
            iconClassName="h-4 w-4"
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.platformLabel}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {row.username ? `@${row.username}` : 'شناسه ثبت نشده'}
            </p>
          </div>
        </div>
        {row.connectionStatus && (
          <Badge
            variant="outline"
            className={
              row.connectionStatus === 'connected'
                ? 'border-transparent bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }
          >
            {CONNECTION_LABELS[row.connectionStatus] ?? row.connectionStatus}
          </Badge>
        )}
      </div>

      <div className="mt-1">
        {hasAudience ? (
          <>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatNumber(row.audience!)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {platformFollowersLabel(row.platform)}
              {row.latestPeriodLabel
                ? ` — ${toPersianDigits(row.latestPeriodLabel)}`
                : ''}
            </p>
          </>
        ) : row.availability === 'no-metrics' ? (
          <>
            <p className="text-sm font-medium text-amber-500">
              حساب متصل است — آمار در دسترس نیست
            </p>
            <p className="text-[10px] text-muted-foreground">
              اطلاعاتی برای نمایش وجود ندارد.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">اطلاعات موجود نیست</p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">
          {row.lastSyncAt
            ? `آخرین همگام‌سازی: ${formatRelativeTime(new Date(row.lastSyncAt))}`
            : 'همگام‌سازی نشده'}
        </span>
        {row.url && (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-[10px] text-primary transition-opacity hover:opacity-80"
          >
            مشاهده صفحه
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function BaseInfoCard({ brand, compact }: { brand: Brand; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">اطلاعات پایه برند</h3>
        {!compact && (
          <span className="text-[10px] text-muted-foreground">
            از بخش مدیریت برندها — فقط قابل مشاهده
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BaseInfoItem label="نام برند" value={brand.name} />
        <BaseInfoItem label="شناسه (Slug)" value={brand.slug} mono />
        <BaseInfoItem label="وضعیت" value={BRAND_STATUS_LABELS[brand.status]} />
        <BaseInfoItem
          label="تاریخ ایجاد"
          value={formatRelativeTime(new Date(brand.createdAt))}
        />
      </div>
    </div>
  );
}

function BaseInfoItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={`text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function BrandSummaryCard({
  profile,
  socialPlatforms,
  socialSummary,
}: {
  profile: BrandStatusProfile | null;
  socialPlatforms: BrandSocialPlatformStatus[];
  socialSummary: BrandSocialSummary;
}) {
  // Derive a coarse overall band from what actually exists — no invention.
  const hasProfile = !!profile && Object.values(socialSummary).length >= 0;
  const filled = profile
    ? (['contentStatus', 'adCapacity', 'topNeed'] as const).filter(
        (k) => (profile[k] ?? '').trim().length > 0,
      ).length
    : 0;
  const overall = !hasProfile
    ? { label: 'تکمیل‌نشده', className: 'bg-muted text-muted-foreground' }
    : filled >= 3
      ? {
          label: 'پرونده کامل',
          className:
            'border-transparent bg-green-500/10 text-green-600 dark:text-green-400',
        }
      : {
          label: 'در حال تکمیل',
          className: 'border-transparent bg-amber-500/10 text-amber-500',
        };

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          خلاصه وضعیت برند
        </h2>
        <Badge variant="outline" className={overall.className}>
          {overall.label}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem
          label="شبکه‌های فعال"
          value={toPersianDigits(String(socialSummary.activePlatformCount))}
        />
        <SummaryItem
          label="مجموع دنبال‌کنندگان"
          value={
            socialSummary.totalAudience > 0
              ? formatNumber(socialSummary.totalAudience)
              : '—'
          }
        />
        <SummaryItem
          label="وضعیت تولید محتوا"
          value={
            profile?.contentStatus?.trim()
              ? trimLabel(profile.contentStatus)
              : 'ثبت نشده'
          }
          muted={!profile?.contentStatus?.trim()}
        />
        <SummaryItem
          label="مهم‌ترین نیاز برند"
          value={
            profile?.topNeed?.trim() ? trimLabel(profile.topNeed) : 'ثبت نشده'
          }
          muted={!profile?.topNeed?.trim()}
        />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {socialPlatforms.length > 0
          ? `${toPersianDigits(String(socialPlatforms.length))} شبکه اجتماعی ثبت شده — ${
              socialSummary.incompleteCount > 0
                ? `${toPersianDigits(String(socialSummary.incompleteCount))} مورد فاقد آمار معتبر`
                : 'آمار همه شبکه‌ها معتبر است'
            }`
          : 'هیچ حساب اجتماعی برای این برند ثبت نشده است.'}
      </p>
    </div>
  );
}

function trimLabel(v: string): string {
  const t = v.trim();
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

/* =========================================================================
 * Related-module tabs (Content / Finance / Tasks)
 * ========================================================================= */

/** Generic loading / error / empty wrapper for the related tabs. */
function RelatedSection<T>({
  loading,
  error,
  data,
  emptyText,
  onRetry,
  children,
}: {
  loading: boolean;
  error: boolean;
  data: T | null | undefined;
  emptyText: string;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          در حال بارگذاری اطلاعات...
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface/60 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive/40" />
        <p className="text-sm text-muted-foreground">
          دریافت اطلاعات با خطا مواجه شد.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تلاش مجدد
        </Button>
      </div>
    );
  }
  const isEmpty =
    data == null ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.values(data).every(
        (v) => v == null || (Array.isArray(v) && v.length === 0),
      ));
  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }
  return <>{children(data as T)}</>;
}

function ContentRow({ content }: { content: RelatedContent }) {
  const status = content.status as ContentStatus;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/60 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {content.title}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {CONTENT_TYPE_LABELS[
              content.type as keyof typeof CONTENT_TYPE_LABELS
            ] ?? content.type}
            {content.platform ? ` — ${content.platform}` : ''}
            {content.scheduledAt
              ? ` — زمان‌بندی: ${toPersianDigits(new Date(content.scheduledAt).toLocaleDateString('fa-IR'))}`
              : ''}
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className={
          CONTENT_STATUS_BADGE[status] ?? 'bg-muted text-muted-foreground'
        }
      >
        {CONTENT_STATUS_LABELS[status] ?? content.status}
      </Badge>
    </div>
  );
}

const CONTENT_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  review: 'border-transparent bg-amber-500/10 text-amber-500',
  approved: 'border-transparent bg-blue-500/10 text-blue-500',
  scheduled: 'border-transparent bg-blue-500/10 text-blue-500',
  published:
    'border-transparent bg-green-500/10 text-green-600 dark:text-green-400',
  rejected: 'border-transparent bg-red-500/10 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'border-transparent bg-red-500/10 text-red-500',
};

function FinanceView({
  expenses,
  campaigns,
}: {
  expenses: RelatedExpense[] | null;
  campaigns: RelatedCampaign[] | null;
}) {
  const total = (expenses ?? []).reduce((s, e) => s + (e.amount || 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface/60 p-4 md:grid-cols-4">
        <div>
          <p className="text-[10px] text-muted-foreground">مجموع هزینه‌ها</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {total > 0 ? formatNumber(total) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">تعداد هزینه‌ها</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {toPersianDigits(String(expenses?.length ?? 0))}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">کمپین‌های مالی</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {toPersianDigits(String(campaigns?.length ?? 0))}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">کمپین فعال</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {toPersianDigits(
              String(
                (campaigns ?? []).filter((c) => c.status === 'active').length,
              ),
            )}
          </p>
        </div>
      </div>

      {campaigns && campaigns.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-foreground">کمپین‌های مالی</p>
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {toPersianDigits(
                    new Date(c.startDate).toLocaleDateString('fa-IR'),
                  )}
                  {c.endDate
                    ? ` — ${toPersianDigits(new Date(c.endDate).toLocaleDateString('fa-IR'))}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {formatNumber(c.budget)}
                </span>
                <Badge
                  variant="outline"
                  className={
                    c.status === 'active'
                      ? 'border-transparent bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }
                >
                  {FINANCE_CAMPAIGN_STATUS_LABELS[
                    c.status as keyof typeof FINANCE_CAMPAIGN_STATUS_LABELS
                  ] ?? c.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {expenses && expenses.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-foreground">هزینه‌ها</p>
          {expenses.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {e.description ||
                    (EXPENSE_CATEGORY_LABELS[
                      e.category as keyof typeof EXPENSE_CATEGORY_LABELS
                    ] ??
                      'هزینه')}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {EXPENSE_CATEGORY_LABELS[
                    e.category as keyof typeof EXPENSE_CATEGORY_LABELS
                  ] ?? e.category}
                  {e.expenseDate
                    ? ` — ${toPersianDigits(new Date(e.expenseDate).toLocaleDateString('fa-IR'))}`
                    : ''}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatNumber(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: RelatedTask }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/60 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${task.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}
          >
            {task.title}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {task.board.title} / {task.list.title}
            {task.dueDate
              ? ` — مهلت: ${toPersianDigits(new Date(task.dueDate).toLocaleDateString('fa-IR'))}`
              : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {task.priority !== 'NONE' && (
          <Badge
            variant="outline"
            className={
              PRIORITY_BADGE[task.priority] ?? 'bg-muted text-muted-foreground'
            }
          >
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={
            task.isCompleted
              ? 'border-transparent bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }
        >
          {task.isCompleted ? 'انجام‌شده' : 'در جریان'}
        </Badge>
      </div>
    </div>
  );
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'border-transparent bg-amber-500/10 text-amber-500',
  URGENT: 'border-transparent bg-red-500/10 text-red-500',
  MEDIUM: 'border-transparent bg-blue-500/10 text-blue-500',
  LOW: 'bg-muted text-muted-foreground',
};

const PRIORITY_LABELS: Record<string, string> = {
  NONE: 'بدون اولویت',
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

function SummaryItem({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface/60 px-3 py-2">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium ${muted ? 'text-muted-foreground/60' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}
