import { z } from 'zod';

const emailSchema = z
  .string()
  .min(1, 'ایمیل الزامی است.')
  .email('ایمیل معتبر نیست.');

const passwordSchema = z
  .string()
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر داشته باشد.');

const fullNameSchema = z
  .string()
  .min(2, 'نام و نام خانوادگی الزامی است.')
  .max(80, 'نام نمی‌تواند بیش از ۸۰ کاراکتر باشد.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'رمز عبور الزامی است.'),
});

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'تکرار رمز عبور الزامی است.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'رمز عبور و تکرار آن یکسان نیستند.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'تکرار رمز عبور الزامی است.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'رمز عبور و تکرار آن یکسان نیستند.',
    path: ['confirmPassword'],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
