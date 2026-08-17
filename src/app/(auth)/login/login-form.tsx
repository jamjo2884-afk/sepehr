'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginValues } from '@/lib/auth-schemas';
import { signIn } from '@/services/auth.service';
import { AuthShell } from '@/components/common/auth-shell';
import { FormField } from '@/components/forms/form-field';
import { PasswordInput } from '@/components/forms/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toPersianDigits } from '@/utils/persian';

/**
 * Login form. Kept intact for re-enabling authentication later;
 * currently the /login route redirects straight to the dashboard
 * (see page.tsx in this directory).
 */
export function LoginForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitError(null);
    try {
      await signIn(values);
      router.replace('/command-center');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'ورود ناموفق بود. دوباره تلاش کنید.';
      setSubmitError(
        /invalid|credentials|password/i.test(message)
          ? 'ایمیل یا رمز عبور نادرست است.'
          : message,
      );
    }
  };

  return (
    <AuthShell
      title="ورود به حساب"
      subtitle="برای ادامه وارد حساب کاربری خود شوید."
      footer={
        <span>
          حساب ندارید؟{' '}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            ساخت حساب جدید
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

        <FormField
          label="رمز عبور"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            dir="ltr"
            placeholder="••••••••"
            autoComplete="current-password"
            hasError={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            حداقل ۸ کاراکتر ({toPersianDigits(8)})
          </span>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            فراموشی رمز عبور؟
          </Link>
        </div>

        {submitError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {submitError}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitting}
          className="h-10 w-full"
        >
          {isSubmitting ? 'در حال ورود…' : 'ورود'}
        </Button>
      </form>
    </AuthShell>
  );
}
