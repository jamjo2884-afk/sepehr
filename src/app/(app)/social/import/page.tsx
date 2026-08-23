'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  FileSpreadsheet,
  History,
  Loader2,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import { toPersianDigits } from '@/utils/persian';
import {
  ERROR_TYPE_LABELS,
} from '@/types/import-review';
import type {
  ImportSession,
  ImportRow,
  ImportErrorType,
  CandidateAccount,
} from '@/types/import-review';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار',
  valid: 'آماده',
  error: 'خطادار',
  ambiguous: 'مبهم',
  resolved: 'حل‌شده',
  rejected: 'ردشده',
  imported: 'واردشده',
};

const STATUS_COLORS: Record<string, string> = {
  valid: 'bg-success/10 text-success border-success/20',
  resolved: 'bg-success/10 text-success border-success/20',
  imported: 'bg-success/10 text-success border-success/20',
  ambiguous: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  rejected: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-muted text-muted-foreground border-border',
};

const REJECT_REASONS = [
  'اطلاعات اشتباه',
  'Account دیگر وجود ندارد',
  'داده قدیمی',
  'خارج از Scope',
  'Duplicate',
  'سایر',
];

const PERIOD_LABELS: Record<string, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ImportReviewPage() {
  const [view, setView] = useState<'history' | 'review'>('history');
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/social/import/review/sessions');
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      toast.error('خطا در خواندن تاریخچه.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/social/import/review/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.fileErrors?.length) {
        toast.error(data.fileErrors[0]);
        setUploading(false);
        return;
      }
      if (data.sessionId) {
        toast.success('فایل با موفقیت بارگذاری شد.');
        void loadSessions();
        openSession(data.sessionId);
      }
    } catch {
      toast.error('بارگذاری فایل انجام نشد.');
    } finally {
      setUploading(false);
    }
  };

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const openSession = (id: string) => {
    setActiveSessionId(id);
    setView('review');
  };

  if (view === 'review' && activeSessionId) {
    return (
      <ReviewView
        sessionId={activeSessionId}
        onBack={() => { setView('history'); void loadSessions(); }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">تاریخچه ورودهای انبوه</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            فایل Excel یا CSV آپلود کنید و قبل از ورود نهایی، هر ردیف را بررسی و اصلاح کنید.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => document.getElementById('import-file-input')?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
            آپلود فایل جدید
          </Button>
          <input
            id="import-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleUpload(file);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-surface/30',
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          فایل را اینجا رها کنید یا دکمه «آپلود فایل جدید» را بزنید
        </p>
      </div>

      {/* Session list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <History className="h-8 w-8" />
          <p className="text-sm">هنوز فایلی آپلود نشده است.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSession(s.id)}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/50 px-4 py-3 text-right transition-colors hover:bg-surface/80"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {toPersianDigits(String(s.total_rows))} ردیف —{' '}
                    {new Date(s.created_at).toLocaleDateString('fa-IR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[s.status] ?? '')}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </Badge>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Review View ─────────────────────────────────────────────────────────────

function ReviewView({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewRow, setReviewRow] = useState<ImportRow | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [committing] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/import/review/sessions/${sessionId}`);
      const data = await res.json();
      setSession(data.session);
      setRows(data.rows ?? []);
    } catch {
      toast.error('خطا در خواندن جلسه.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const filteredRows = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchFields = [r.account_identifier, r.username, r.display_name, r.brand, r.platform].filter(Boolean).join(' ').toLowerCase();
      if (!searchFields.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    total: rows.length,
    valid: rows.filter((r) => r.status === 'valid').length,
    error: rows.filter((r) => r.status === 'error').length,
    ambiguous: rows.filter((r) => r.status === 'ambiguous').length,
    resolved: rows.filter((r) => r.status === 'resolved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    imported: rows.filter((r) => r.status === 'imported').length,
  };

  const canCommit = counts.error === 0 && counts.ambiguous === 0 && (counts.valid + counts.resolved) > 0;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6" dir="rtl">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          بازگشت
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">مرکز بررسی ورود انبوه</h1>
          <p className="text-xs text-muted-foreground">{session?.filename}</p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        <DashboardCard label="کل" value={counts.total} tone="default" />
        <DashboardCard label="آماده" value={counts.valid} tone="success" />
        <DashboardCard label="خطادار" value={counts.error} tone="danger" />
        <DashboardCard label="مبهم" value={counts.ambiguous} tone="warning" />
        <DashboardCard label="حل‌شده" value={counts.resolved} tone="success" />
        <DashboardCard label="ردشده" value={counts.rejected} tone="muted" />
        <DashboardCard label="واردشده" value={counts.imported} tone="info" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه</SelectItem>
            <SelectItem value="error">خطادار</SelectItem>
            <SelectItem value="ambiguous">مبهم</SelectItem>
            <SelectItem value="resolved">حل‌شده</SelectItem>
            <SelectItem value="rejected">ردشده</SelectItem>
            <SelectItem value="valid">آماده</SelectItem>
            <SelectItem value="imported">واردشده</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-48 pr-7 text-xs"
            placeholder="جستجو..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {toPersianDigits(String(filteredRows.length))} ردیف
        </span>
      </div>

      {/* Row table */}
      <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-xs">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">ردیف</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">پلتفرم</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">حساب</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">برند</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">دوره</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">وضعیت</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                  {toPersianDigits(String(r.row_number))}
                </td>
                <td className="px-3 py-1.5 text-foreground">
                  {SOCIAL_PLATFORM_LABELS[r.platform as never] ?? r.platform}
                </td>
                <td className="px-3 py-1.5 text-foreground">
                  {r.account_identifier || '—'}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.brand || '—'}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {PERIOD_LABELS[r.period ?? ''] ?? r.period} — {toPersianDigits(r.period_label || '—')}
                </td>
                <td className="px-3 py-1.5">
                  <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[r.status] ?? '')}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                  {r.error_type && (
                    <span className="mr-1 text-[10px] text-destructive">
                      {ERROR_TYPE_LABELS[r.error_type as ImportErrorType] ?? r.error_type}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {(r.status === 'error' || r.status === 'ambiguous' || r.status === 'pending') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setReviewRow(r)}
                    >
                      بررسی
                    </Button>
                  )}
                  {r.status === 'resolved' && (
                    <span className="text-[10px] text-success">✓ حل شده</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Commit button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => void loadSession()}
        >
          بروزرسانی
        </Button>
        <Button
          disabled={!canCommit || committing}
          onClick={() => setShowCommitDialog(true)}
        >
          {committing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
          تأیید نهایی و ورود به Supabase
        </Button>
      </div>

      {/* Review Dialog */}
      {reviewRow && (
        <ReviewDialog
          row={reviewRow}
          onClose={() => setReviewRow(null)}
          onUpdated={() => { setReviewRow(null); void loadSession(); }}
        />
      )}

      {/* Commit Dialog */}
      {showCommitDialog && (
        <CommitDialog
          sessionId={sessionId}
          counts={counts}
          onClose={() => setShowCommitDialog(false)}
          onCommitted={() => { setShowCommitDialog(false); void loadSession(); }}
        />
      )}
    </div>
  );
}

// ─── Dashboard Card ──────────────────────────────────────────────────────────

function DashboardCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-success',
    danger: 'text-destructive',
    warning: 'text-amber-500',
    muted: 'text-muted-foreground',
    info: 'text-primary',
  }[tone] ?? 'text-foreground';

  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface/50 p-2">
      <span className={cn('text-lg font-bold tabular-nums', toneClass)}>
        {toPersianDigits(String(value))}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Review Dialog ───────────────────────────────────────────────────────────

function ReviewDialog({
  row,
  onClose,
  onUpdated,
}: {
  row: ImportRow;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [candidates, setCandidates] = useState<CandidateAccount[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editPlatform, setEditPlatform] = useState(row.platform ?? '');
  const [editIdentifier, setEditIdentifier] = useState(row.account_identifier ?? '');
  const [editBrand, setEditBrand] = useState(row.brand ?? '');

  // Load candidates for ambiguous rows
  useEffect(() => {
    if (row.status === 'ambiguous') {
      setLoadingCandidates(true);
      fetch(`/api/social/import/review/sessions/${row.session_id}/rows/${row.id}/candidates`)
        .then((r) => r.json())
        .then((d) => setCandidates(d.candidates ?? []))
        .catch(() => {})
        .finally(() => setLoadingCandidates(false));
    }
  }, [row]);

  const resolveMatch = async (accountId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/social/import/review/sessions/${row.session_id}/rows/${row.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matched_account_id: accountId }),
      });
      toast.success('ردیف حل شد.');
      onUpdated();
    } catch {
      toast.error('حل ردیف انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejectReason) { toast.error('دلیل رد را وارد کنید.'); return; }
    setBusy(true);
    try {
      await fetch(`/api/social/import/review/sessions/${row.session_id}/rows/${row.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      toast.success('ردیف رد شد.');
      onUpdated();
    } catch {
      toast.error('رد کردن انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await fetch(`/api/social/import/review/sessions/${row.session_id}/rows/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: editPlatform,
          account_identifier: editIdentifier,
          brand: editBrand,
        }),
      });
      toast.success('اصلاحات ذخیره شد.');
      setEditing(false);
      onUpdated();
    } catch {
      toast.error('ذخیره اصلاحات انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const raw = (row.raw_data as Record<string, unknown>) ?? {};
  const nd = (row.normalized_data as Record<string, unknown>) ?? {};
  const values = (nd.values as Record<string, unknown>) ?? {};

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>بررسی ردیف {toPersianDigits(String(row.row_number))}</DialogTitle>
          <DialogDescription>
            {row.error_type && ERROR_TYPE_LABELS[row.error_type as ImportErrorType]}
            {row.error_message && ` — ${row.error_message}`}
          </DialogDescription>
        </DialogHeader>

        {/* Raw Excel Data */}
        <div className="rounded-lg border border-border bg-surface/50 p-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">داده خام Excel</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">پلتفرم:</span> {String(raw.platform ?? row.platform)}</div>
            <div><span className="text-muted-foreground">شناسه:</span> {String(raw.accountIdentifier ?? row.account_identifier)}</div>
            <div><span className="text-muted-foreground">دوره:</span> {String(raw.period ?? row.period)}</div>
            <div><span className="text-muted-foreground">برچسب:</span> {String(raw.periodLabel ?? row.period_label)}</div>
          </div>
          {Object.keys(values).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
              {Object.entries(values).filter(([,v]) => v != null).map(([k, v]) => (
                <div key={k}><span className="text-muted-foreground">{k}:</span> {toPersianDigits(String(v))}</div>
              ))}
            </div>
          )}
        </div>

        {/* Candidates for ambiguous */}
        {row.status === 'ambiguous' && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <h3 className="mb-2 text-xs font-medium text-amber-600">حساب‌های پیشنهادی</h3>
            {loadingCandidates ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">کاندیدایی یافت نشد.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded border border-border bg-surface/50 p-2">
                    <div className="text-xs">
                      <p className="font-medium text-foreground">{c.brand} / {c.username}</p>
                      <p className="text-muted-foreground">{SOCIAL_PLATFORM_LABELS[c.platform as never] ?? c.platform} — ID: {c.id.slice(0, 8)}…</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={busy}
                      onClick={() => void resolveMatch(c.id)}
                    >
                      انتخاب این Account
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        {editing ? (
          <div className="rounded-lg border border-border bg-surface/50 p-3">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">ویرایش ردیف</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">پلتفرم</label>
                <Input className="h-7 text-xs" value={editPlatform} onChange={(e) => setEditPlatform(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">شناسه حساب</label>
                <Input className="h-7 text-xs" value={editIdentifier} onChange={(e) => setEditIdentifier(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">برند</label>
                <Input className="h-7 text-xs" value={editBrand} onChange={(e) => setEditBrand(e.target.value)} />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-7 text-[10px]" disabled={busy} onClick={() => void saveEdit()}>
                ذخیره و اعتبارسنجی مجدد
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditing(false)}>
                انصراف
              </Button>
            </div>
          </div>
        ) : null}

        {/* Reject form */}
        {showReject ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <h3 className="mb-2 text-xs font-medium text-destructive">رد کردن ردیف</h3>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[10px] transition-colors',
                    rejectReason === r
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'border-border text-muted-foreground hover:bg-surface',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" className="h-7 text-[10px]" disabled={busy || !rejectReason} onClick={() => void reject()}>
                تأیید رد
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setShowReject(false); setRejectReason(''); }}>
                انصراف
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {!editing && !showReject && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(true)}>
                ویرایش ردیف
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs text-destructive" onClick={() => setShowReject(true)}>
                رد کردن
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
                بستن
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Commit Dialog ───────────────────────────────────────────────────────────

function CommitDialog({
  sessionId,
  counts,
  onClose,
  onCommitted,
}: {
  sessionId: string;
  counts: { valid: number; resolved: number; error: number; ambiguous: number; rejected: number };
  onClose: () => void;
  onCommitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const rowsToImport = counts.valid + counts.resolved;

  const commit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/social/import/review/sessions/${sessionId}/commit`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`${toPersianDigits(String(data.inserted))} ردیف با موفقیت ثبت شد.`);
        onCommitted();
      }
    } catch {
      toast.error('ثبت اطلاعات انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تأیید نهایی و ورود به Supabase</DialogTitle>
          <DialogDescription>
            آیا مطمئن هستید؟ عملیات غیرقابل بازگشت است.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>ردیف‌های آماده: <span className="font-bold">{toPersianDigits(String(counts.valid))}</span></div>
          <div>ردیف‌های حل‌شده: <span className="font-bold">{toPersianDigits(String(counts.resolved))}</span></div>
          <div>ردیف‌های ردشده: <span className="font-bold">{toPersianDigits(String(counts.rejected))}</span></div>
          <div className="col-span-2 font-bold text-primary">
            مجموع ورود: {toPersianDigits(String(rowsToImport))} ردیف
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button disabled={busy} onClick={() => void commit()}>
            {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            تأیید نهایی و ورود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
