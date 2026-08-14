'use client';

import { useEffect, useState } from 'react';
import { SOCIAL_PLATFORM_LABELS } from '@/types/domain';
import type { SocialPlatform } from '@/types/domain';
import { SUPPORTED_PLATFORMS } from '@/services/social.service';
import type { SocialAccount, SocialAccountInput } from '@/types/social';
import { SOCIAL_ACCOUNT_STATUS_LABELS } from '@/types/social';
import type { SocialAccountStatus } from '@/types/social';
import { toLatinDigits } from '@/utils/persian';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_OPTIONS: SocialAccountStatus[] = [
  'active',
  'inactive',
  'archived',
  'suspended',
];

/**
 * Create / edit a social account row. In edit mode the identity fields
 * (brand, platform, username) are editable too — the UNIQUE constraint
 * still prevents duplicates. A duplicate insert/update surfaces as a
 * friendly Persian error instead of a raw Supabase message.
 */
export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this account; otherwise it creates one. */
  account?: SocialAccount | null;
  onSaved: (account: SocialAccount, mode: 'create' | 'update') => void;
}) {
  const isEdit = Boolean(account);
  const [brand, setBrand] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<SocialAccountStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (account) {
      setBrand(account.brand);
      setPlatform(account.platform);
      setUsername(account.username ?? '');
      setDisplayName(account.displayName ?? '');
      setUrl(account.url ?? '');
      setStatus(account.status);
    } else {
      setBrand('');
      setPlatform('instagram');
      setUsername('');
      setDisplayName('');
      setUrl('');
      setStatus('active');
    }
    setErrors({});
    setFormError(null);
    setSaving(false);
  }, [open, account]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!brand.trim()) next.brand = 'نام برند را وارد کنید.';
    if (!username.trim()) next.username = 'نام کاربری را وارد کنید.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const input: SocialAccountInput = {
      brand: toLatinDigits(brand),
      platform,
      username: toLatinDigits(username),
      displayName: displayName.trim() || null,
      url: url.trim() || null,
      status,
    };
    setSaving(true);
    setFormError(null);

    const { createSocialAccount, updateSocialAccount } =
      await import('@/services/social.service');
    const result = isEdit
      ? await updateSocialAccount(account!.id, input)
      : await createSocialAccount(input);
    setSaving(false);
    if (!result) {
      setFormError(
        isEdit
          ? 'ذخیره تغییرات انجام نشد. احتمالاً این برند، پلتفرم و نام کاربری قبلاً ثبت شده است.'
          : 'افزودن حساب انجام نشد. احتمالاً این برند، پلتفرم و نام کاربری قبلاً ثبت شده است.',
      );
      return;
    }
    onSaved(result, isEdit ? 'update' : 'create');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'ویرایش حساب' : 'افزودن حساب جدید'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'اطلاعات حساب را ویرایش کنید. ترکیب برند، پلتفرم و نام کاربری باید یکتا باشد.'
              : 'یک حساب جدید برای ثبت آمار اضافه کنید. ترکیب برند، پلتفرم و نام کاربری باید یکتا باشد.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">برند *</Label>
            <Input
              className="h-9 text-xs"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="مثلاً ازما"
              hasError={Boolean(errors.brand)}
            />
            {errors.brand ? (
              <p className="text-[11px] text-destructive">{errors.brand}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">پلتفرم *</Label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as SocialPlatform)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {SOCIAL_PLATFORM_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              نام کاربری * (به انگلیسی)
            </Label>
            <Input
              className="h-9 text-xs"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="azmaa_net"
              hasError={Boolean(errors.username)}
            />
            {errors.username ? (
              <p className="text-[11px] text-destructive">{errors.username}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">نام نمایشی</Label>
            <Input
              className="h-9 text-xs"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="مثلاً شبکه ازما"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              لینک عمومی صفحه
            </Label>
            <Input
              className="h-9 text-xs"
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/azmaa_net"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">وضعیت</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SocialAccountStatus)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOCIAL_ACCOUNT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {formError ? (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            انصراف
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? 'در حال ذخیره…'
              : isEdit
                ? 'ذخیره تغییرات'
                : 'افزودن حساب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
