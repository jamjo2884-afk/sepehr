'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/lib/auth-schemas';
import { updatePassword } from '@/services/auth.service';
import { AuthShell } from '@/components/common/auth-shell';
import { FormField } from '@/components/forms/form-field';
import { PasswordInput } from '@/components/forms/password-input';
import { Button } from '@/components/ui/button';
import { toPersianDigits } from '@/utils/persian';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    setSubmitError(null);
    try {
      await updatePassword(values.password);
      setDone(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'بازنشانی رمز عبور ناموفق بود. دوباره تلاش کنید.',
      );
    }
  };

  if (done) {
    return (
      <AuthShell
        title="رمز عبور تغییر کرد"
        subtitle="رمز عبور شما با موفقیت بازنشانی شد."
      >
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            اکنون می‌توانید با رمز عبور جدید وارد شوید.
          </p>
          <Button
            type="button"
            className="h-10 w-full"
            onClick={() => router.push('/login')}
          >
            ورود به حساب
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="بازنشانی رمز عبور"
      subtitle="رمز عبور جدید خود را وارد کنید."
      footer={
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          بازگشت به ورود
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="رمز عبور جدید"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            dir="ltr"
            placeholder="••••••••"
            autoComplete="new-password"
            hasError={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <FormField
          label="تکرار رمز عبور"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            dir="ltr"
            placeholder="••••••••"
            autoComplete="new-password"
            hasError={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </FormField>

        {submitError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
          {isSubmitting ? 'در حال بازنشانی…' : 'بازنشانی رمز عبور'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          حداقل {toPersianDigits(8)} کاراکتر
        </p>
      </form>
    </AuthShell>
  );
}
