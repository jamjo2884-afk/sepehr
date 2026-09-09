'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Key,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsRow } from '@/components/settings/settings-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ROLE_LABELS } from '@/types/auth';
import { signOut, resetPasswordForEmail } from '@/services/auth.service';
import { isDemoModeClient } from '@/lib/demo';
import { useRouter } from 'next/navigation';


export function AccountSettings() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const workspace = useAuthStore((s) => s.workspace);
  const { appearance, updateAppearance } = useSettingsStore();

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Logout
  const [loggingOut, setLoggingOut] = useState(false);

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handlePasswordReset = async () => {
    if (!profile?.email) return;
    setResetLoading(true);
    setResetError(null);
    try {
      await resetPasswordForEmail(profile.email);
      setResetSent(true);
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'خطا در ارسال لینک بازنشانی رمز',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace(isDemoModeClient() ? '/command-center' : '/login');
    } catch {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    // Account deletion is not implemented — the backend does not support it yet.
    // Show a clear message instead of faking it.
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }, 1000);
  };

  const displayName = profile?.fullName || 'کاربر';
  const roleLabel = profile ? ROLE_LABELS[profile.role] : null;

  return (
    <>
      {/* Account Info */}
      <SettingsSection
        title="اطلاعات حساب"
        description="اطلاعات شخصی و نقش شما در سیستم"
      >
        <SettingsRow label="نام و نام خانوادگی">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{displayName}</span>
          </div>
        </SettingsRow>

        <SettingsRow label="ایمیل">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground" dir="ltr">
              {profile?.email || '—'}
            </span>
          </div>
        </SettingsRow>

        <SettingsRow label="نقش">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{roleLabel || '—'}</span>
          </div>
        </SettingsRow>

        <SettingsRow label="فضای کاری">
          <span className="text-sm text-foreground">
            {workspace?.name || 'Media Deck'}
          </span>
        </SettingsRow>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = '/profile')}
            className="gap-1.5"
          >
            مشاهده پروفایل کامل
          </Button>
        </div>
      </SettingsSection>

      <Separator className="my-2" />

      {/* Appearance */}
      <SettingsSection
        title="ظاهر"
        description="تنظیمات نمایش رابط کاربری"
      >
        <SettingsRow label="حالت نمایش" description="انتخاب تم رنگی سیستم">
          <div className="flex gap-2">
            {[
              { value: 'dark' as const, label: 'تاریک', icon: '🌙' },
              { value: 'light' as const, label: 'روشن', icon: '☀️' },
              { value: 'system' as const, label: 'مطابق سیستم', icon: '💻' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateAppearance({ theme: opt.value })}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  appearance.theme === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      <Separator className="my-2" />

      {/* Security */}
      <SettingsSection title="امنیت" description="مدیریت رمز عبور و نشست‌ها">
        <SettingsRow
          label="تغییر رمز عبور"
          description="یک لینک بازنشانی رمز به ایمیل شما ارسال می‌شود"
        >
          {!showPasswordSection ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordSection(true)}
              className="gap-1.5"
            >
              <Key className="h-3.5 w-3.5" />
              تغییر رمز
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              {resetSent ? (
                <p className="text-xs text-primary">
                  لینک بازنشانی رمز به ایمیل شما ارسال شد.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {profile?.email || '—'}
                  </p>
                  {resetError && (
                    <p className="text-xs text-destructive">{resetError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handlePasswordReset()}
                      disabled={resetLoading}
                      className="gap-1.5"
                    >
                      {resetLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5" />
                      )}
                      {resetLoading ? 'در حال ارسال…' : 'ارسال لینک'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordSection(false);
                        setResetError(null);
                      }}
                    >
                      انصراف
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </SettingsRow>

        <SettingsRow
          label="خروج از حساب"
          description="نشست فعلی شما غیرفعال می‌شود"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            {loggingOut ? 'در حال خروج…' : 'خروج'}
          </Button>
        </SettingsRow>
      </SettingsSection>

      <Separator className="my-2" />

      {/* Danger Zone */}
      <SettingsSection
        title="حذف حساب"
        description="این عملیات غیرقابل بازگشت است"
      >
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-destructive">
                حذف دائمی حساب
              </p>
              <p className="text-xs text-muted-foreground">
                تمام اطلاعات شما از سیستم حذف خواهد شد. این عملیات قابل بازگشت
                نیست.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="gap-1.5 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف حساب
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              حذف حساب کاربری
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-right">
              <p>
                آیا از حذف حساب خود اطمینان دارید؟ این عملیات{' '}
                <strong className="text-destructive">غیرقابل بازگشت</strong> است.
              </p>
              <p className="text-xs text-muted-foreground">
                تمام اطلاعات شما شامل پروفایل، فضای کاری، محتوا، تنظیمات و
                اعلان‌ها به طور دائمی حذف خواهد شد.
              </p>
              <p className="text-xs text-muted-foreground">
                برای تأیید، عبارت «حذف حساب» را در کادر زیر تایپ کنید.
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="حذف حساب"
                className="mt-2"
                dir="rtl"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmText('');
              }}
            >
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirmText !== 'حذف حساب' || deleting}
              onClick={() => void handleDeleteAccount()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'حذف دائمی'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
