/*
# Seed demo business data

Loads the same demo content that `src/features/mock-data/index.ts`
provides (projects, campaigns, assets, operations, knowledge items,
audience segments, automations, reports, notifications, activity feed)
into the business tables, so the dashboard shows real database data.

Timestamps are relative to migration run time to mirror the mock-data
`days(n)` / `hours(n)` helpers.

Re-running is safe: INSERT ... ON CONFLICT (id) DO NOTHING.
*/

-- ===========================================================================
-- Projects
-- ===========================================================================
INSERT INTO projects (id, workspace_id, name, slug, description, status, progress, thumbnail_url, owner_id, created_at, updated_at) VALUES
  ('prj-001', 'demo', 'کمپین تابستانه', 'summer-campaign', 'بسته محتوایی و توزیع برای فصل تابستان', 'active', 62, NULL, 'demo', now() - interval '18 days', now() - interval '3 hours'),
  ('prj-002', 'demo', 'راه‌اندازی پادکست فصل دوم', 'podcast-season-2', 'تولید و انتشار هشت قسمت پادکست', 'planning', 24, NULL, 'demo', now() - interval '9 days', now() - interval '20 hours'),
  ('prj-003', 'demo', 'بازسازی هویت بصری', 'visual-identity-refresh', 'بازطراحی لوگو، رنگ و سیستم بصری', 'active', 48, NULL, 'demo', now() - interval '30 days', now() - interval '1 day'),
  ('prj-004', 'demo', 'گزارش سالانه عملکرد', 'annual-performance-report', 'تدوین گزارش تحلیلی عملکرد یک سال', 'completed', 100, NULL, 'demo', now() - interval '60 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Campaigns
-- ===========================================================================
INSERT INTO campaigns (id, project_id, name, description, status, start_date, end_date, created_at, updated_at) VALUES
  ('cmp-001', 'prj-001', 'موج اول تابستانه', 'رشد آگاهی از برند در شبکه‌های اجتماعی', 'running', now() - interval '10 days', now() + interval '12 days', now() - interval '15 days', now() - interval '5 hours')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Media assets
-- ===========================================================================
INSERT INTO media_assets (id, project_id, name, type, url, thumbnail_url, size_bytes, tags, created_at, updated_at) VALUES
  ('ast-001', 'prj-001', 'تیزر تابستانه.mp4', 'video', '', NULL, 84000000, ARRAY['تیزر','تابستان'], now() - interval '6 days', now() - interval '6 days'),
  ('ast-002', 'prj-003', 'پالت رنگی نسخه ۲.pdf', 'document', '', NULL, 1200000, ARRAY['هویت بصری','رنگ'], now() - interval '4 days', now() - interval '4 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Operations
-- ===========================================================================
INSERT INTO operations (id, project_id, title, description, type, status, assignee_id, due_date, created_at, updated_at) VALUES
  ('op-001', 'prj-001', 'بازبینی نهایی تیزر', 'تأیید کیفیت و نسخه نهایی تیزر تابستانه', 'review', 'in_progress', 'demo', now() + interval '26 hours', now() - interval '3 days', now() - interval '2 hours'),
  ('op-002', 'prj-002', 'نوشتن طرح قسمت اول', 'تدوین طرح محتوایی قسمت اول پادکست', 'planning', 'todo', 'demo', now() + interval '3 days', now() - interval '2 days', now() - interval '2 days'),
  ('op-003', 'prj-003', 'انتخاب پالت رنگی', 'ارائه و تأیید پالت رنگی نهایی', 'production', 'done', 'demo', now() + interval '1 day', now() - interval '7 days', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Knowledge items
-- ===========================================================================
INSERT INTO knowledge_items (id, project_id, title, body, type, tags, created_at, updated_at) VALUES
  ('knw-001', 'prj-001', 'راهنمای تولید تیزر', 'مراحل تولید یک تیزر استاندارد از ایده تا انتشار.', 'playbook', ARRAY['تیزر','تولید'], now() - interval '12 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Audience segments
-- ===========================================================================
INSERT INTO audience_segments (id, project_id, name, description, size, criteria, created_at, updated_at) VALUES
  ('seg-001', 'prj-001', 'مخاطبان فعال شبکه اجتماعی', 'کاربران فعال در اینستاگرام و تلگرام', 12400, ARRAY['فعالیت بالا','۱۸ تا ۳۵ سال'], now() - interval '8 days', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Automations
-- ===========================================================================
INSERT INTO automations (id, project_id, name, description, trigger, action, enabled, created_at, updated_at) VALUES
  ('aut-001', 'prj-001', 'اعلان انتشار خودکار', 'هنگام انتشار محتوا، اعلان در کانال داخلی ارسال شود', 'محتوا منتشر شد', 'ارسال اعلان به کانال داخلی', true, now() - interval '6 days', now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Analytics reports
-- ===========================================================================
INSERT INTO analytics_reports (id, project_id, name, period, summary, created_at) VALUES
  ('rpt-001', 'prj-001', 'گزارش هفتگی کمپین تابستانه', 'هفته دوم تیر', 'رشد ۱۸ درصدی تعامل نسبت به هفته قبل.', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Notifications
-- ===========================================================================
INSERT INTO notifications (id, user_id, title, description, read, created_at) VALUES
  ('ntf-001', 'demo', 'مهلت عملیات نزدیک است', '«بازبینی نهایی تیزر» تا فردا باید تکمیل شود', false, now() - interval '1 hour'),
  ('ntf-002', 'demo', 'دارایی جدید', 'فایل جدید به دارایی‌های رسانه‌ای اضافه شد', false, now() - interval '5 hours'),
  ('ntf-003', 'demo', 'گزارش هفتگی آماده است', 'گزارش تحلیلی هفته دوم تیر منتشر شد', true, now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- Activity feed
-- ===========================================================================
INSERT INTO activity_items (id, title, description, project_id, created_at) VALUES
  ('act-001', 'تیزر تابستانه بازبینی شد', 'نسخه نهایی تیزر توسط تیم بازبینی تأیید شد', 'prj-001', now() - interval '2 hours'),
  ('act-002', 'دارایی جدید آپلود شد', 'فایل «پالت رنگی نسخه ۲» به پروژه هویت بصری اضافه شد', 'prj-003', now() - interval '6 hours'),
  ('act-003', 'عملیات جدید ثبت شد', '«نوشتن طرح قسمت اول» به عملیات پادکست اضافه شد', 'prj-002', now() - interval '1 day'),
  ('act-004', 'گزارش عملکرد آماده شد', 'گزارش سالانه عملکرد برای بازبینی نهایی ارسال شد', 'prj-004', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;
