# اتصال Supabase به GitHub برای اعمال خودکار Migration ها

این راهنما GitHub integration سوپابیس را به ریپوی `sepehr` وصل میکند تا هر بار
migration جدیدی به `supabase/migrations/` اضافه و push شود، **بهصورت خودکار**
روی پروژه سوپابیس اعمال شود — بدون نیاز به باز کردن SQL Editor یا دستور دستی.

---

## چرا الان کار نمیکند؟

Migration های فعلی (`supabase/migrations/`) **قبلاً دستی** اعمال شدهاند، ولی
GitHub integration هنوز به ریپو وصل نیست — به همین دلیل push کردن migration ها
اثری نداشت. بعد از اتصال، فقط migration های **جدید** (که قبلاً اعمال نشدهاند)
خودکار اجرا میشوند.

---

## پیشنیازها (از قبل آماده است ✅)

- ریپو `sepehr` → https://github.com/jamjo2884-afk/sepehr
- پوشه `supabase/migrations/` در **ریشه ریپو** (ریشه ریپو = پوشه `project/`)
  - ✅ تأیید شد: `git ls-files supabase/` هر ۶ migration را نشان میدهد
- پروژه سوپابیس `sepehr` (ref: `sksbltwbbiuweqeiypyo`)

---

## گامهای اتصال

### ۱) وارد داشبورد سوپابیس شوید
به https://supabase.com/dashboard بروید و پروژه **sepehr** را باز کنید.

### ۲) به صفحه Integrations بروید
از منوی کناری: **Project Settings → Integrations**

(یا مستقیم: `https://supabase.com/dashboard/project/sksbltwbbiuweqeiypyo/settings/integrations`)

### ۳) GitHub Integration را فعال کنید
- زیر بخش **GitHub Integration** روی دکمه **Authorize GitHub** کلیک کنید
- به صفحه مجوز GitHub منتقل میشوید → روی **Authorize Supabase** کلیک کنید
- دوباره به داشبورد برمیگردید

### ۴) ریپو و تنظیمات را انتخاب کنید
- **Repository:** ریپوی `jamjo2884-afk/sepehr` را انتخاب کنید
- **Working directory:** مقدار `.` بگذارید
  - ⚠️ مهم: چون پوشه `supabase/` در ریشه ریپو است، Working directory باید `.` باشد.
    اگر خالی بگذارید یا مسیر اشتباه بدهید، migration ها پیدا نمیشوند.
- **Branch:** `main`
- **Automatic branching:** میتوانید خاموش بگذارید (فعلاً نیازی به preview branch نیست)
- **Deploy to production:** ✅ فعال کنید — تا migration های جدید روی `main` بهصورت
  خودکار روی پروژه اصلی اعمال شوند

### ۵) Enable integration
روی **Enable integration** کلیک کنید. اتصال کامل میشود.

---

## تست

بعد از اتصال، یک migration تستی بسازید و push کنید:

1. یک فایل جدید در `supabase/migrations/` بسازید، مثلاً:
   `20260815000000_test_connection.sql` با محتوای:
   ```sql
   -- Test migration
   SELECT 1;
   ```
2. کامیت و push به `main`:
   ```bash
   git add supabase/migrations/20260815000000_test_connection.sql
   git commit -m "test github integration"
   git push origin main
   ```
3. چند دقیقه صبر کنید، سپس در داشبورد سوپابیس بروید به
   **Database → Migrations** — باید migration جدید را ببینید.

---

## نکته مهم درباره migration های قبلی

Migration های فعلی (auth foundation، social_followers، business tables و seed ها)
با Management API اعمال شدهاند ولی در جدول `supabase_migrations.schema_migrations`
ثبت **نشدهاند**. یعنی اگر GitHub integration اولین بار همه ۶ فایل را ببیند، ممکن است
سعی کند همه را دوباره اجرا کند. این **خطا نیست** چون همه migration ها idempotent
هستند (CREATE TABLE IF NOT EXISTS، ON CONFLICT DO NOTHING، DROP POLICY قبل از
CREATE) — اجرای مجدد امن است و دادهها را تکرار نمیکند.

اگر خواستید از اجرای مجدد جلوگیری شود، دو راه دارید:
- **راه ساده:** بگذارید اجرا شود (امن است — نتیجه همان دیتابیس فعلی است)
- **راه تمیزتر:** migration های اعمالشده را بهعنوان «قبلاً اجرا شده» ثبت کنید:
  ```bash
  supabase migration repair --status applied
  ```
  (نیاز به لینک شدن CLI به پروژه و پسورد دیتابیس دارد)

---

## خطاهای رایج

| خطا | علت | راهحل |
|---|---|---|
| Migration ها پیدا نمیشوند | Working directory اشتباه است | مقدار `.` بگذارید |
| 401/403 هنگام Authorize | دسترسی GitHub کافی نیست | با اکانتی که مالک ریپو sepehr است (jamjo2884-afk) لاگین کنید |
| Preview branch ساخته میشود | Automatic branching فعال است | آن را خاموش کنید |
| Migration روی پروژه اعمال نشد | Deploy to production خاموش است | آن را فعال کنید و دوباره push کنید |
