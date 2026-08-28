import { z } from 'zod';

/* =========================================================================
 * Team Member
 * ========================================================================= */

export const teamMemberSchema = z.object({
  name: z.string().min(1, 'نام الزامی است.').max(200).trim(),
  employmentType: z.enum(['full_time', 'part_time', 'project', 'intern']),
  monthlyCost: z.number().min(0, 'هزینه ماهانه نمی‌تواند منفی باشد.'),
  startDate: z.string().min(1, 'تاریخ شروع الزامی است.'),
  endDate: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  notes: z.string().max(500).optional().default(''),
  allocations: z
    .array(
      z.object({
        brand: z.string().min(1, 'نام برند الزامی است.'),
        allocationPercentage: z
          .number()
          .min(0)
          .max(100, 'درصد تخصیص نمی‌تواند بیشتر از ۱۰۰٪ باشد.'),
      }),
    )
    .optional()
    .default([]),
}).refine(
  (data) => {
    if (data.allocations && data.allocations.length > 0) {
      const total = data.allocations.reduce(
        (sum, a) => sum + a.allocationPercentage,
        0,
      );
      return total <= 100;
    }
    return true;
  },
  {
    message: 'مجموع درصدهای تخصیص نمی‌تواند بیشتر از ۱۰۰٪ باشد.',
    path: ['allocations'],
  },
);

export type TeamMemberSchemaValues = z.infer<typeof teamMemberSchema>;

export function validateTeamMember(input: unknown) {
  return teamMemberSchema.safeParse(input);
}
