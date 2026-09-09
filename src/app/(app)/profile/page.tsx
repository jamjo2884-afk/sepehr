'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Check,
  Loader2,
  Mail,
  Shield,
  User,
  Briefcase,
  Calendar,
  Pencil,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_LABELS } from '@/types/auth';
import { toPersianDigits } from '@/utils/persian';

interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const year = toPersianDigits(d.getFullYear().toString());
    const month = toPersianDigits((d.getMonth() + 1).toString().padStart(2, '0'));
    const day = toPersianDigits(d.getDate().toString().padStart(2, '0'));
    return `${year}/${month}/${day}`;
  } catch {
    return '—';
  }
}

export default function ProfilePage() {
  const authProfile = useAuthStore((s) => s.profile);
  const authWorkspace = useAuthStore((s) => s.workspace);
  const setProfile = useAuthStore((s) => s.setContext);

  const [profile, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (!res.ok) throw new Error('خطا در دریافت پروفایل');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'خطا در دریافت پروفایل');
      setProfileData(body.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری پروفایل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleStartEdit = () => {
    setEditName(profile?.fullName || authProfile?.fullName || '');
    setEditing(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError('نام نمی‌تواند خالی باشد.');
      return;
    }
    if (editName.trim().length < 2) {
      setSaveError('نام باید حداقل ۲ کاراکتر باشد.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editName.trim() }),
      });
      const body = await res.json();
      if (!body.ok) {
        setSaveError(body.error || 'خطا در ذخیره تغییرات');
        return;
      }
      setSaveSuccess(true);
      setEditing(false);

      // Update local state
      setProfileData((prev) =>
        prev ? { ...prev, fullName: editName.trim() } : prev,
      );

      // Also update auth store so header reflects the change immediately
      if (authProfile) {
        const workspace = authWorkspace
          ? {
              id: authWorkspace.id,
              name: authWorkspace.name,
              slug: authWorkspace.slug,
              logoUrl: authWorkspace.logoUrl,
              createdAt: authWorkspace.createdAt,
            }
          : null;
        setProfile({
          profile: { ...authProfile, fullName: editName.trim() },
          workspace,
          role: authProfile.role,
        });
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('خطا در ارتباط با سرور');
    } finally {
      setSaving(false);
    }
  };

  // Use auth store data as fallback while loading
  const data = profile || {
    id: authProfile?.id || '',
    fullName: authProfile?.fullName || '',
    email: authProfile?.email || '',
    avatarUrl: authProfile?.avatarUrl || null,
    role: authProfile?.role || 'viewer',
    workspaceId: authWorkspace?.id || '',
    workspaceName: authWorkspace?.name || '',
    createdAt: '',
    updatedAt: '',
  };

  const displayName = data.fullName || 'کاربر';
  const initial = displayName.charAt(0) || 'م';
  const roleLabel = ROLE_LABELS[data.role as keyof typeof ROLE_LABELS] || data.role;

  if (loading && !profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">در حال بارگذاری پروفایل…</p>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      >
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void loadProfile()}>
          تلاش مجدد
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          پروفایل
        </h1>
        <p className="text-sm text-muted-foreground">
          اطلاعات حساب کاربری شما
        </p>
      </header>

      {/* Profile Card */}
      <div className="rounded-xl border border-border bg-surface/60 p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="group relative">
            <Avatar className="h-24 w-24 border-2 border-border">
              {data.avatarUrl ? (
                <AvatarImage src={data.avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
              title="تغییر تصویر پروفایل"
              disabled
            >
              <Camera className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-1 text-center sm:text-right">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <h2 className="text-xl font-bold text-foreground">
                {displayName}
              </h2>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {roleLabel}
              </span>
            </div>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {data.email || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="rounded-xl border border-border bg-surface/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">اطلاعات شخصی</h2>
          {!editing ? (
            <Button size="sm" variant="ghost" onClick={handleStartEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              ویرایش
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={saving}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                انصراف
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
                {saving
                  ? 'در حال ذخیره…'
                  : saveSuccess
                    ? 'ذخیره شد'
                    : 'ذخیره'}
              </Button>
            </div>
          )}
        </div>

        {saveSuccess && (
          <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            تغییرات با موفقیت ذخیره شد.
          </div>
        )}
        {saveError && (
          <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {saveError}
          </div>
        )}

        <Separator className="my-4" />

        <div className="flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              نام و نام خانوادگی
            </label>
            {editing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="نام و نام خانوادگی"
                className="max-w-md"
              />
            ) : (
              <p className="text-sm text-foreground">{displayName}</p>
            )}
          </div>

          <Separator />

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Mail className="h-4 w-4" />
              ایمیل
            </label>
            <p className="text-sm text-foreground" dir="ltr">
              {data.email || '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              ایمیل از طریق سیستم احراز هویت مدیریت می‌شود.
            </p>
          </div>

          <Separator />

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              نقش
            </label>
            <p className="text-sm text-foreground">{roleLabel}</p>
          </div>

          <Separator />

          {/* Workspace */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              فضای کاری
            </label>
            <p className="text-sm text-foreground">
              {data.workspaceName || '—'}
            </p>
          </div>

          <Separator />

          {/* Join Date */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              تاریخ عضویت
            </label>
            <p className="text-sm text-foreground">
              {data.createdAt ? formatDate(data.createdAt) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-border bg-surface/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          دسترسی سریع
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = '/settings')}
            className="gap-1.5"
          >
            تنظیمات حساب
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
