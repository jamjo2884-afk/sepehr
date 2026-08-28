/**
 * Finance Validation Schemas
 *
 * Zod schemas for validating finance inputs (budgets, expenses, campaigns).
 */

import { z } from 'zod';


/* =========================================================================
 * Shared
 * ========================================================================= */

const brandSchema = z
  .string()
  .min(1, 'برند الزامی است.')
  .max(200)
  .trim();

const amountSchema = z
  .number()
  .min(0.01, 'مبلغ باید بزرگ‌تر از صفر باشد.');

const expenseAmountSchema = z
  .number()
  .min(0.01, 'مبلغ هزینه باید بزرگ‌تر از صفر باشد.');

const descriptionSchema = z.string().max(500).optional().default('');

const notesSchema = z.string().max(500).optional().default('');

/* =========================================================================
 * Budget
 * ========================================================================= */

export const budgetSchema = z.object({
  brand: brandSchema,
  period: z.enum(['monthly', 'quarterly', 'yearly']),
  periodLabel: z.string().min(1, 'دوره الزامی است.'),
  amount: amountSchema,
  notes: notesSchema,
});

export type BudgetSchemaValues = z.infer<typeof budgetSchema>;

export function validateBudget(input: unknown) {
  return budgetSchema.safeParse(input);
}

/* =========================================================================
 * Expense Allocation
 * ========================================================================= */

export const allocationSchema = z.object({
  platform: z.string().min(1, 'پلتفرم الزامی است.'),
  socialAccountId: z.string().nullable().optional(),
  amount: z.number().min(0, 'مبلغ تخصیص نمی‌تواند منفی باشد.'),
  percentage: z.number().min(0).max(100).nullable().optional(),
});

export type AllocationSchemaValues = z.infer<typeof allocationSchema>;

/* =========================================================================
 * Expense
 * ========================================================================= */

export const expenseSchema = z
  .object({
    brand: brandSchema,
    expenseDate: z.string().min(1, 'تاریخ الزامی است.'),
    amount: expenseAmountSchema,
    category: z.enum([
      'advertising',
      'content_production',
      'human_resources',
      'influencer',
      'reportage',
      'equipment',
      'software',
      'other',
    ]),
    campaignId: z.string().nullable().optional(),
    description: descriptionSchema,
    allocations: z.array(allocationSchema).optional().default([]),
  })
  .refine(
    (data) => {
      // Validate that total allocations <= expense amount
      if (data.allocations && data.allocations.length > 0) {
        const totalAllocation = data.allocations.reduce(
          (sum, a) => sum + a.amount,
          0,
        );
        return totalAllocation <= data.amount;
      }
      return true;
    },
    {
      message: 'مجموع تخصیص‌ها نمی‌تواند از مبلغ هزینه بیشتر باشد.',
      path: ['allocations'],
    },
  );

export type ExpenseSchemaValues = z.infer<typeof expenseSchema>;

export function validateExpense(input: unknown) {
  return expenseSchema.safeParse(input);
}

/* =========================================================================
 * Campaign
 * ========================================================================= */

export const campaignSchema = z
  .object({
    brand: brandSchema,
    name: z.string().min(1, 'نام کمپین الزامی است.').max(200).trim(),
    startDate: z.string().min(1, 'تاریخ شروع الزامی است.'),
    endDate: z.string().nullable().optional(),
    budget: amountSchema,
    status: z.enum(['planned', 'active', 'completed', 'cancelled']),
    description: descriptionSchema,
  })
  .refine(
    (data) => {
      // Validate end_date >= start_date if provided
      if (data.endDate && data.startDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.',
      path: ['endDate'],
    },
  );

export type CampaignSchemaValues = z.infer<typeof campaignSchema>;

export function validateCampaign(input: unknown) {
  return campaignSchema.safeParse(input);
}
