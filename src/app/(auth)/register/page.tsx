'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterValues } from '@/lib/auth-schemas';
import { signUp } from '@/services/auth.service';
import { AuthShell } from '@/components/common/auth-shell';
import { FormField } from '@/components/forms/form-field';
import { PasswordInput } from '@/components/forms/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toPersianDigits } from '@/utils/persian';

export default function RegisterPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterValues) => {
    setSubmitError(null);
    try {
      const result = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      });
      // Email confirmation disabled → a session is returned; sign in directly.
      if (result.session) {
        const next = new URLSearchParams(window.location.search).get('next');
        router.replace(
          next && next.startsWith('/') && !next.startsWith('//')
            ? next
            : '/command-center',
        );
        return;
      }
      setDone(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'ثبت‌نام ناموفق بود.';
      setSubmitError(
        /already|exists|registered/i.test(message)
          ? 'حسابی با این ایمیل از قبل وجود دارد.'
          : message,
      );
    }
  };

  if (done) {
    return (
      <AuthShell title="حساب ساخته شد" subtitle="حساب شما با موفقیت ایجاد شد.">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            فضای کاری «Media Deck» برای شما ایجاد شد و نقش «مالک» به شما اختصاص
            یافت. اکنون می‌توانید وارد شوید.
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
      title="ساخت حساب جدید"
      subtitle="در چند ثانیه حساب خود را بسازید."
      footer={
        <span>
          حساب دارید؟{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            وارد شوید
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="نام و نام خانوادگی"
          htmlFor="fullName"
          error={errors.fullName?.message}
        >
          <Input
            id="fullName"
            type="text"
            placeholder="مثلاً: علی رضایی"
            autoComplete="name"
            hasError={!!errors.fullName}
            {...register('fullName')}
          />
        </FormField>

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

        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitting}
          className="h-10 w-full"
        >
          {isSubmitting ? 'در حال ساخت حساب…' : 'ساخت حساب'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          با ساخت حساب، نقش «مالک» به شما اختصاص می‌یابد ({toPersianDigits(1)}{' '}
          فضای کاری «Media Deck»).
        </p>
      </form>
    </AuthShell>
  );
}
