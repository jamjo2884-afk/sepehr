import { metricColumnHeader } from '@/services/social-import/normalize';
import { SOCIAL_METRIC_FIELDS } from '@/constants/social-fields';
import type { SocialMetricFieldKey } from '@/constants/social-fields';

/**
 * Import templates.
 *
 * The template is generated FROM the project's own architecture — headers
 * are the snake_case `social_metrics` columns (the documented format), and
 * sample rows are clearly marked DEMO so they can never be mistaken for
 * real data and never enter Supabase.
 */

/** Column order: platform, account_identifier, period, period_label, then metrics. */
export const TEMPLATE_BASE_COLUMNS = [
  'platform',
  'account_identifier',
  'period',
  'period_label',
] as const;

export const TEMPLATE_METRIC_COLUMNS: SocialMetricFieldKey[] = [
  'followers',
  'following',
  'posts',
  'views',
  'likes',
  'comments',
  'shares',
  'saves',
  'reach',
  'impressions',
  'engagementRate',
  'storyViews',
  'channelMembers',
  'retweets',
  'subscribers',
];

export function templateHeaders(): string[] {
  return [
    ...TEMPLATE_BASE_COLUMNS,
    ...TEMPLATE_METRIC_COLUMNS.map(metricColumnHeader),
  ];
}

/** Clearly-marked demo rows (never importable data). */
export function templateSampleRows(): string[][] {
  return [
    [
      'instagram',
      '@example',
      'monthly',
      '1405-05',
      '125000',
      '45000',
      '120',
      '450000',
      '12000',
      '800',
      '300',
      '1500',
      '280000',
      '340000',
      '4.5',
      '52000',
      '',
      '',
      '',
    ],
    [
      'telegram',
      '@examplechannel',
      'monthly',
      '1405-05',
      '',
      '',
      '',
      '35000',
      '1800',
      '120',
      '45',
      '',
      '',
      '',
      '6.2',
      '',
      '3500',
      '',
      '',
    ],
  ];
}

/**
 * Column guide rows for the Excel "راهنما" sheet: name, Persian label,
 * required?, description.
 */
export function templateGuideRows(): string[][] {
  const rows: string[][] = [
    ['ستون', 'نام فارسی', 'الزامی', 'توضیح'],
    [
      'platform',
      'پلتفرم',
      'بله',
      'instagram / telegram / youtube / twitter / bale / eita / rubika / soroushplus / aparat / threads / shad / igap / site / gap / virasty',
    ],
    [
      'account_identifier',
      'شناسهٔ حساب',
      'بله',
      'id حساب، external_id، username یا نام حساب',
    ],
    ['period', 'دوره', 'بله', 'daily / weekly / monthly'],
    [
      'period_label',
      'برچسب دوره',
      'بله',
      'ماهانه: 1405-05 یا «مرداد ۱۴۰۵» — روزانه: 1405-05-23 — هفتگی: 1405-W33',
    ],
  ];
  for (const key of TEMPLATE_METRIC_COLUMNS) {
    const spec = SOCIAL_METRIC_FIELDS[key];
    rows.push([
      metricColumnHeader(key),
      spec.label,
      'خیر',
      spec.kind === 'percent'
        ? 'درصد (۰ تا ۱۰۰) — خالی = بدون تغییر'
        : 'عدد غیرمنفی — خالی = بدون تغییر',
    ]);
  }
  rows.push([
    'DEMO',
    'نمونه',
    '—',
    'ردیف‌های نمونه فقط برای راهنما هستند و هرگز وارد سیستم نمی‌شوند.',
  ]);
  return rows;
}

/** Build an .xlsx template buffer. */
export async function buildXlsxTemplate(): Promise<Uint8Array> {
  const { utils, write } = await import('xlsx');
  const wb = utils.book_new();
  const data = utils.aoa_to_sheet([templateHeaders(), ...templateSampleRows()]);
  data['!cols'] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
  ];
  utils.book_append_sheet(wb, data, 'داده');
  const guide = utils.aoa_to_sheet(templateGuideRows());
  guide['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 8 }, { wch: 60 }];
  utils.book_append_sheet(wb, guide, 'راهنما');
  return write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}

/** Build the .csv template text (UTF-8 with BOM for Persian Excel). */
export function buildCsvTemplate(): string {
  const escape = (v: string): string =>
    /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    templateHeaders().join(','),
    ...templateSampleRows().map((r) =>
      r
        .map((v) => escape(v ?? ''))
        // pad missing trailing cells so every row has all columns
        .concat(
          Array.from(
            { length: Math.max(0, templateHeaders().length - r.length) },
            () => '',
          ),
        )
        .join(','),
    ),
  ];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
