'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from '@/lib/auth-schemas';
import { resetPasswordForEmail } from '@/services/auth.service';
import { AuthShell } from '@/components/common/auth-shell';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setSubmitError(null);
    try {
      await resetPasswordForEmail(values.email);
      setSent(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'ارسال لینک بازنشانی ناموفق بود. دوباره تلاش کنید.',
      );
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="لینک بازنشانی ارسال شد"
        subtitle="ایمیل بازنشانی رمز عبور ارسال شد."
      >
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            لینک بازنشانی رمز عبور به آدرس ایمیل شما ارسال شد. لطفاً صندوق ورودی
            (و پوشه هرزنامه) را بررسی کنید.
          </p>
          <Button asChild className="h-10 w-full">
            <Link href="/login">بازگشت به ورود</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="فراموشی رمز عبور"
      subtitle="لینک بازنشانی رمز عبور برایتان ارسال می‌کنیم."
      footer={
        <span>
          رمز را به یاد آوردید؟{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            ورود
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField label="ایمیل" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            dir="ltr"
            placeholder="you@example.com"
            autoComplete="email"
            hasError={!!errors.email}
            {...register('email')}
          />
        </FormField>

        {submitError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
          {isSubmitting ? 'در حال ارسال…' : 'ارسال لینک بازنشانی'}
        </Button>
      </form>
    </AuthShell>
  );
}
