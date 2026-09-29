import Link from 'next/link';

const futureActions = [
  'ثبت و دسته‌بندی مقالات، یادداشت‌ها و راهنماها',
  'جستجوی سریع در میان دانش سازمانی',
  'اتصال آیتم‌های دانش به پروژه‌ها',
  'اشتراک‌گذاری راهنماهای عملیاتی با تیم',
];

/**
 * This module left the sidebar menu (2026-09-28 consolidation) but the
 * route stays reachable via bookmarks/direct links, self-contained —
 * no dependency on the nav config.
 */
export default function KnowledgePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
        پایگاه دانش
      </h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        این بخش به‌صورت موقت از منو خارج شده است.
      </p>
      <div className="w-full rounded-2xl border border-border bg-surface/60 p-5 text-right">
        <ul className="flex list-disc flex-col gap-2 pr-5">
          {futureActions.map((action) => (
            <li key={action} className="text-sm text-muted-foreground">
              {action}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/"
        className="mt-6 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        بازگشت به مرکز فرمان
      </Link>
    </div>
  );
}
