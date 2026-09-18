-- =============================================================================
-- Guest Mode (2026-09-19) — idempotent seed for the guest demo workspace
--
-- Populates the dedicated guest demo workspace so unauthenticated visitors
-- (GUEST_MODE_ENABLED=true) see a realistic, fully fictional product demo.
--
-- Safety:
-- - Fixed workspace uuid mirrors GUEST_WORKSPACE_UUID in src/lib/guest-mode.ts.
-- - Idempotent: ON CONFLICT DO NOTHING on the unique keys; safe to re-run.
--   Never touches rows outside the demo uuid.
-- - All brand/content names are fictional sample data.
-- - No deletes, no updates of existing rows, no tenant tables touched.
--
-- Apply only after explicit confirmation (per guest-mode rollout plan).
-- =============================================================================

-- 1. Demo workspace (also required by the anon read policy)
INSERT INTO workspaces (id, name, slug)
VALUES ('deb00d00-0000-4000-8000-deb00d000001', 'فضای کاری نمایشی', 'demo-workspace-000')
ON CONFLICT (id) DO NOTHING;

-- 2. Fictional brands (5)
INSERT INTO brands (workspace_id, name, slug, status, color)
VALUES
  ('deb00d00-0000-4000-8000-deb00d000001', 'برند نمایشی آفتاب', 'demo-brand-1', 'active', '#f59e0b'),
  ('deb00d00-0000-4000-8000-deb00d000001', 'برند نمایشی مروارید', 'demo-brand-2', 'active', '#06b6d4'),
  ('deb00d00-0000-4000-8000-deb00d000001', 'برند نمایشی صدف', 'demo-brand-3', 'active', '#8b5cf6'),
  ('deb00d00-0000-4000-8000-deb00d000001', 'برند نمایشی نارون', 'demo-brand-4', 'inactive', '#10b981'),
  ('deb00d00-0000-4000-8000-deb00d000001', 'برند نمایشی چنار', 'demo-brand-5', 'inactive', '#ef4444')
ON CONFLICT (workspace_id, name) DO NOTHING;

-- 3. Fictional contents (12, across pipeline statuses; brand_id resolved by
--    slug so the seed stays idempotent without hard-coded content uuids)
INSERT INTO contents
  (workspace_id, brand_id, title, type, status, body, platform, scheduled_at, published_at)
SELECT
  'deb00d00-0000-4000-8000-deb00d000001'::uuid,
  b.id,
  v.title,
  v.type,
  v.status,
  v.body,
  v.platform,
  v.scheduled_at,
  v.published_at
FROM (VALUES
  ('demo-brand-1', 'کمپین بهاره آفتاب — پست معرفی', 'post', 'published', 'متن نمونهٔ پست معرفی کمپین بهاره.', 'instagram', NULL::timestamptz, now() - interval '9 days'),
  ('demo-brand-1', 'استوری پشت‌صحنه تولید', 'story', 'published', 'روایت پشت‌صحنهٔ خط تولید.', 'instagram', NULL::timestamptz, now() - interval '3 days'),
  ('demo-brand-1', 'ویدیوی تبلیغاتی ۳۰ ثانیه‌ای', 'video', 'scheduled', 'سناریوی ویدیوی تبلیغاتی فصل پاییز.', 'aparat', now() + interval '2 days', NULL::timestamptz),
  ('demo-brand-2', 'کپسول آموزشی مروارید', 'reel', 'published', 'کپسول کوتاه آموزشی برای شبکه‌های اجتماعی.', 'instagram', NULL::timestamptz, now() - interval '6 days'),
  ('demo-brand-2', 'پست مقایسهٔ محصولات', 'carousel', 'approved', 'کروسل مقایسهٔ دو محصول شاخص.', 'instagram', now() + interval '4 days', NULL::timestamptz),
  ('demo-brand-2', 'یادداشت وبلاگ پاییزی', 'document', 'draft', 'پیش‌نویس یادداشت وبلاگ برای فصل جدید.', NULL, NULL::timestamptz, NULL::timestamptz),
  ('demo-brand-3', 'تیزر رونمایی صدف', 'reel', 'review', 'تیزر کوتاه رونمایی محصول جدید.', 'instagram', NULL::timestamptz, NULL::timestamptz),
  ('demo-brand-3', 'پست همکاری با اینفلوئنسر', 'post', 'scheduled', 'پست مشترک با اینفلوئنسر همکار.', 'instagram', now() + interval '6 days', NULL::timestamptz),
  ('demo-brand-4', 'اطلاعیهٔ تغییر ساعات کاری', 'post', 'published', 'اطلاعیهٔ رسمی تغییر ساعات پاسخگویی.', 'telegram', NULL::timestamptz, now() - interval '12 days'),
  ('demo-brand-4', 'گزارش ماهانهٔ عملکرد', 'document', 'draft', 'پیش‌نویس گزارش ماهانهٔ رسانه‌ها.', NULL, NULL::timestamptz, NULL::timestamptz),
  ('demo-brand-5', 'پست بازگشایی شعبه', 'post', 'rejected', 'پست بازگشایی — نیازمند بازنویسی.', 'instagram', NULL::timestamptz, NULL::timestamptz),
  ('demo-brand-5', 'کروسل نکات نگهداری', 'carousel', 'cancelled', 'کروسل آموزشی لغو شده در برنامه‌ریزی.', 'instagram', NULL::timestamptz, NULL::timestamptz)
) AS v(brand_slug, title, type, status, body, platform, scheduled_at, published_at)
JOIN brands b
  ON b.slug = v.brand_slug
 AND b.workspace_id = 'deb00d00-0000-4000-8000-deb00d000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM contents c
  WHERE c.workspace_id = 'deb00d00-0000-4000-8000-deb00d000001'::uuid
    AND c.title = v.title
);
