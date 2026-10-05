# طرح: مدیریت اعضا و دسترسی ماتریسی per-module

> مرحله ۱ — فقط طرح، بدون کد. منتظر تأیید مالک.
>
> **تصمیمات تأییدشده‌ی مالک (۲۰۲۶-۱۰-۰۱):**
> 1. پیش‌فرض member جدید = **همه هیچ** (هیچ ماژولی را نمی‌بیند تا مالک دستی ست کند).
> 2. دعوت بدون SMTP = **لینک دستی** (مالک لینک را کپی و خودش می‌فرستد).
> 3. دامنه‌ی اعمال = **فاز A + B با هم** (چک permission روی همه‌ی روت‌های نوشتن و خواندن).
> 4. خروج اختیاری member = **بسته شود** (خروج فقط با حذف توسط مالک/ادمین).

## ۱. وضعیت فعلی (یافته‌های بررسی)

### ۱.۱ دیتابیس (Supabase)
- جدول `workspace_members` (مایگریشن `20260719155903`): `workspace_id`, `user_id`, `role app_role`, `created_at`، یکتا روی (workspace, user).
- Enum `app_role`: `owner | admin | editor | writer | viewer` — پنج مقدار، ولی **فقط یک فیلد متنی**؛ هیچ ساختاری برای permission ریزدانه وجود ندارد.
- RLS روی `workspace_members`: هر عضو می‌تواند ردیف خودش را INSERT/UPDATE/DELETE کند (policyهای `insert_own_workspace_member` و...) — یعنی الان هر عضو می‌تواند role خودش را عوض کند! این با ورود سیستم permission باید بسته شود.
- `audit_logs` (مایگریشن `20260907_phase23`) با RLS و ایندکس‌ها موجود است — همان الگوی guest-mode.
- الگوی guest-mode: RPC امنیتی `SECURITY DEFINER` + policy های read-only برای کلاینت + لاگ در audit_logs از داخل RPC.

### ۱.۲ لایه‌ی API
- `withAuth` / `requireAuth` / `requireRole` در [route-auth.ts](../src/lib/route-auth.ts). فقط **۲ روت** از `requireRole` استفاده می‌کنند (guest-mode و social/platform). بقیه‌ی ~۹۰ روت فقط `withAuth`/`requireAuth` دارند.
- ~۲۰ روت social و ۲ روت assets از `requireAuth` قدیمی (`@/lib/auth`) استفاده می‌کنند که workspace چک نمی‌کند (فقط session).
- FlowBoard (Prisma) سیستم role موازی خودش را دارد (`OWNER/ADMIN/MEMBER/VIEWER` در `flow_workspace_members`) — از این طرح جدا است.

### ۱.۳ UI
- `role` در zustand store (`auth.store`) از `profiles.role` می‌آید — نه از `workspace_members.role` (ناسازگاری بالقوه).
- یک‌جا در UI چک role هست: `content/page.tsx` (canEdit/canDelete بر اساس owner/admin/editor).
- تنظیمات: `settings-layout.tsx` + `SETTINGS_CATEGORIES` در [types/settings.ts](../src/types/settings.ts) — افزودن تب جدید آسان است.

### ۱.۴ دعوت / عضویت
- **سیستم دعوت وجود ندارد.** تنها چیز مشابه، دعوت FlowBoard است (`/api/flowboard/workspaces/[id]/members`) که فقط کاربر از قبل موجود در `flow_users` را اضافه می‌کند.
- Media Deck هیچ UI یا APIای برای افزودن عضو به `workspace_members` ندارد. ثبت‌نام آزاد است (`/register`) و هر کاربر جدید workspace خودش را می‌گیرد.
- RLS فعلی اجازه‌ی INSERT فقط به `user_id = auth.uid()` می‌دهد — یعنی مالک نمی‌تواند از طریق کلاینت عضو اضافه کند.

## ۲. تصمیمات طرح

### ۲.۱ مدل دسترسی: ۴ سطح (نه ۳)
`none` / `view` / `create` / `edit`

دلیل جدا کردن `create` از `edit`:
- «افزودن» ریسک کمتری از «ویرایش» دارد (مثلاً ثبت هزینه‌ی جدید OK است ولی دستکاری هزینه‌های ثبت‌شده نه).
- در برخی ماژول‌ها ویرایشِ داده‌ی تاریخی (social metrics، finance) حساس است ولی افزودن رکورد جدید عادی.
- اگر مالک فقط «مشاهده/ویرایش» بخواهد، کافی است هر دو را با هم فعال کند؛ پس سطح اضافه، محدودیت ایجاد نمی‌کند.
- UI ماتریس با ۴ سطح (dropdown یا کلیک چرخشی) همچنان ساده می‌ماند.

قاعده‌ی شمول: `edit ⇒ create ⇒ view` (هر سطح بالاتر، سطوح پایین‌تر را شامل می‌شود).

### ۲.۲ نقش‌ها: سه نقش + override per-member
- `owner`: دسترسی کامل ثابت + مدیریت اعضا. قابل تغییر نیست (حداقل یک owner در هر workspace).
- `admin`: دسترسی کامل به همه‌ی ماژول‌ها + مدیریت اعضا (جز انتقال مالکیت / حذف owner).
- `member`: دقیقاً طبق ماتریس per-member که برایش ثبت شده.

**چرا role-per-user مستقیم و بدون جدول نقش‌های واسط؟** workspace در این محصول یک واحد کوچک است (یک آژانس/برند). جدول نقش‌های سفارشی (role + role_permissions) برای سازمان‌های بزرگ با نقش‌های زیاد طراحی می‌شود؛ اینجا فقط پیچیدگی اضافه می‌کرد (UI مدیریت نقش، migration دو جدولی، رزلوشن دو مرحله‌ای). اگر بعداً لازم شد، ستون `role` و ماتریس per-member بدون تغییر اسکیما به نقش‌های سفارشی قابل ارتقا است.

**Override per-member:** بله — ماتریس مستقیماً per-member ذخیره می‌شود (نه per-role). برای member جدید، پیش‌فرض از قالب پیش‌فرض نقش member کپی می‌شود (مثلاً همه‌ی ماژول‌ها = view) و سپس مالک آزادانه تغییرش می‌دهد. این ساده‌تر از «role template + overrideها» است و برای اندازه‌ی تیم این محصول کافی است.

### ۲.۳ اسکیما (مایگریشن جدید `20261001_create_workspace_member_permissions.sql`)

```sql
-- ستون جدید برای جدا کردن «دسترسی‌دهنده» از «عضو»
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}';

-- شکل JSON (per member):
-- {
--   "brands":   "edit",     // none | view | create | edit
--   "social":   "view",
--   "finance":  "none",
--   "tasks":    "create",
--   "content":  "edit",
--   "settings": "view"      // فقط owner/admin — برای member نادیده گرفته می‌شود
-- }
-- کلید غایب = پیش‌فرض نقش (برای member: view همه‌ی ماژول‌های خواندنی؟ — تصمیم پایین)

CREATE TABLE IF NOT EXISTS permission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id uuid,                       -- چه کسی تغییر داد
  target_user_id uuid NOT NULL,        -- عضوِ تغییرکردگی
  changes jsonb NOT NULL,              -- { "brands": {before:"view", after:"edit"} }
  created_at timestamptz NOT NULL DEFAULT now()
);
-- + RLS: read برای اعضا، insert فقط از طریق RPC؛ ایندکس (workspace_id, created_at DESC)
```

چرا ستون jsonb داخل `workspace_members` و نه جدول رابطه‌ای `(member_id, module, level)`:
- تعداد ماژول‌ها ثابت و کوچک است (۶ ماژول) — کوئری «همه‌ی دسترسی‌های یک عضو» همیشه یک ردیف است (همان SELECTی که `getCurrentWorkspace` الان می‌زند؛ فقط ستون اضافه می‌شود → صفر round-trip اضافه در هر request).
- اعتبار سنجی سطح/ماژول با CHECK function + constraint در سمت DB و با zod در سمت API انجام می‌شود.
- اگر تعداد ماژول‌ها بعدها داینامیک شود، مهاجرت به جدول رابطه‌ای ساده است.

### ۲.۴ ماژول‌ها و نگاشت به روت‌ها

| ماژول | صفحات UI | روت‌های API |
|---|---|---|
| `brands` | `/brands` | `/api/brands*` |
| `social` | `/social`, `/audience`, `/analytics`, `/intelligence` | `/api/social/*` |
| `finance` | `/finance`, `/campaigns` | `/api/finance/*` |
| `tasks` | `/tasks` | `/api/flowboard/*` (خواندن) |
| `content` | `/content` | `/api/content*` |
| `settings` | `/settings` | `/api/settings/*` |
| — (همیشه باز) | `/command-center`, `/notifications`, `/profile`, `/assets` | `/api/command-center`, `/api/notifications*`, `/api/profile`, `/api/assets*` |

FlowBoard (tasks): مسیر Prisma و بدون RLS است؛ چک permission فقط در لایه‌ی route انجام می‌شود (`requireModuleAccess('tasks')` روی `/api/flowboard/*`). این با وضعیت فعلی FlowBoard سازگار است (خودش role موازی دارد) — در فاز بعد می‌توان یکی کرد.

### ۲.۵ لایه‌ی چک permission (فایل جدید `src/lib/permissions.ts`)

```ts
export type ModuleKey = 'brands'|'social'|'finance'|'tasks'|'content'|'settings';
export type AccessLevel = 'none'|'view'|'create'|'edit';

// WorkspaceContext.role + permissions را می‌خواند (از getCurrentWorkspace)
export function moduleAccess(ws: WorkspaceContext, m: ModuleKey): AccessLevel;
export function canView(ws, m)  { return level(ws,m) !== 'none'; }
export function canCreate(ws, m){ return level(ws,m) === 'create' || level(ws,m) === 'edit'; }
export function canEdit(ws, m)  { return level(ws,m) === 'edit'; }
// owner/admin همیشه edit

// Wrapperهای route-auth
export function requireModuleView(m: ModuleKey)   { /* withAuth + 403 */ }
export function requireModuleCreate(m: ModuleKey) { /* withAuth + 403 */ }
export function requireModuleEdit(m: ModuleKey)   { /* withAuth + 403 */ }
```

نقاط وصل در route-auth: هر سه wrapper از `withAuth` عبور می‌کنند و بعد از حل workspace، سطح دسترسی را از `WorkspaceContext.permissions` چک می‌کنند. تغییر `getCurrentWorkspace` (workspace.ts): ستون `permissions` را هم SELECT کند و در context برگرداند (بدون شکستن call sites موجود).

فازبندی اعمال روی روت‌ها (تا ریسک شکستن صفر شود):
1. **فاز A (این PR):** روت‌های نوشتنِ هر ماژول → `requireModuleCreate/Edit`. روت‌های خواندن → `requireModuleView` فقط روی ماژول‌هایی که مالک خواسته باشد (finance و settings اولویت).
2. **فاز B (بعدی):** بقیه‌ی روت‌های خواندن + صفحات UI (middleware نمی‌شود چون role در آن لایه در دسترس نیست — فقط redirect سمت کلاینت/لِی‌اوت).

### ۲.۶ روت‌های API جدید

```
GET    /api/workspace/members            → لیست اعضا + role + permissions (owner/admin؛ memberها فقط لیست ساده)
PATCH  /api/workspace/members/[userId]   → تغییر role یا permissions (فقط owner/admin)
DELETE /api/workspace/members/[userId]   → حذف عضو (owner فقط؛ admin نمی‌تواند owner را حذف کند)
POST   /api/workspace/invitations        → دعوت با ایمیل
GET    /api/workspace/invitations        → لیست دعوت‌های باز (owner/admin)
DELETE /api/workspace/invitations/[id]   → لغو دعوت
POST   /api/workspace/invitations/accept → پذیرش دعوت (کاربر لاگین‌شده با ایمیل منطبق)
GET    /api/workspace/permissions/audit  → تاریخچه‌ی تغییرات permission
```

همه از `requireRole('owner','admin')` (و برای حذف/audit: `requireRole('owner')`) عبور می‌کنند + گیت دوم داخل RPC امنیتی (الگوی set_guest_mode).

### ۲.۷ دعوت — طراحی (از صفر، چون هیچی نیست)

جریان: مالک/ادمین ایمیل + ماژول‌های دسترسی را وارد می‌کند → ردیف `workspace_invitations` ساخته می‌شود (token تصادفی، انقضای ۷ روزه) → ایمیل با لینک `/invite/[token]` (اگر SMTP تنظیم نیست، لینک در UI به مالک نشان داده می‌شود تا خودش بفرستد — بدون سرویس ایمیل هم کار می‌کند) → کاربر از لینک: اگر حساب دارد و ایمیلش match است → دکمه‌ی «پذیرش» → عضو می‌شود؛ اگر ندارد → ثبت‌نام با همان ایمیل، سپس پذیرش خودکار.

```sql
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  permissions jsonb NOT NULL DEFAULT '{}',
  token text NOT NULL UNIQUE,          -- تصادفی ۳۲ بایتی
  invited_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)  -- جلوگیری از دعوت تکراری
);
```

نکته‌ی اجرایی مهم: ساخت ردیف دعوت و عضوِ جدید باید **بypass از RLS** باشد (policy فعلی اجازه‌ی INSERT برای user دیگر را نمی‌دهد). دو راه: (الف) RPC امنیتی `SECURITY DEFINER` با gate داخلی owner/admin (الگوی موجود و تأییدشده‌ی پروژه)؛ (ب) service-role key سمت سرور. **پیشنهاد: (الف)** — سازگار با الگوی set_guest_mode، بدون کلید اضافه.

### ۲.۸ RLS / امنیت دیتابیس

1. policyهای خطرناک فعلی `workspace_members` باید محدود شوند:
   - `update_own_workspace_member` → حذف یا محدود به ستون‌های غیر از role/permissions (تغییر role خودی = privilege escalation).
   - `delete_own_workspace_member` → بماند (خروج اختیاری از workspace) ولی با gate که owner خودش را حذف نکند.
   - `insert_own_workspace_member` → بماند فقط برای جریان پذیرش دعوت (با gate داخل RPC به‌جای policy).
2. ماتریس permissions فقط از طریق RPC امنیتی `update_member_permissions(workspace_id, user_id, permissions)` قابل نوشتن است — gate داخلی: فراخوان باید owner/admin همان workspace باشد و target خود فراخوان نباشد. هر تغییر موفق = یک ردیف در `permission_audit`.
3. `is_workspace_member()` کمکی موجود، مبنای policyهای read باقی می‌ماند.

### ۲.۹ UI

تب جدید «اعضا» (id: `members`) در `SETTINGS_CATEGORIES`، فقط برای owner/admin فعال (memberها آن را نمی‌بینند):

```
┌─────────────────────────────────────────────────────────────────┐
│ اعضای فضای کاری                                [+ دعوت عضو]      │
├─────────────────────────────────────────────────────────────────┤
│ نام            ایمیل           نقش      برندها  مالی  ...  عملیات │
│ مالک           a@x.com         مالک      ✓      ✓    ...  —     │
│ (ردیف‌های member):  dropdown سطح به‌ازای هر ماژول (هیچ/دیدن/افزودن/ویرایش) │
│                 ذخیره در batch + toast تأیید                     │
├─────────────────────────────────────────────────────────────────┤
│ دعوت‌های باز: ایمیل، وضعیت، انقضا، [لغو] [کپی لینک]              │
├─────────────────────────────────────────────────────────────────┤
│ تاریخچه‌ی تغییرات (permission_audit، ۲۰ مورد آخر)                │
└─────────────────────────────────────────────────────────────────┘
```

- کامپوننت: `sections/members-settings.tsx` + زیرکامپوننت `members-permission-matrix.tsx`.
- state محلی برای ویرایش‌های ذخیره‌نشده + دکمه‌ی ذخیره (بدون اتوسیو سیو، تا تغییرات قابل بازبینی باشد).
- UI هرگز قابل اتکا نیست: همه‌ی دکمه‌ها در سمت سرور هم چک می‌شوند (requireRole + RPC gate).

### ۲.۱۰ audit

- هر تغییر permission/role/عضویت → یک ردیف در `permission_audit` (قبل/بعد به تفکیک ماژول) + یک ردیف در `audit_logs` (الگوی موجود: `entity_type='workspace_member'`, `entity_id=user_id`) تا در Command Center هم دیده شود.
- خواندن audit از طریق `GET /api/workspace/permissions/audit` (فقط owner/admin).

## ۳. ترتیب اجرا در مرحله ۲ (پیشنهادی)

> **✅ پیش‌نیاز امنیتی انجام شد (۲۰۲۶-۱۰-۰۱) — قبل از شروع مرحله ۲:**
> 1. مایگریشن `20261001120000_harden_workspace_members_rls.sql`: هر سه policy نوشتنِ کلاینتی روی `workspace_members`
>    (`insert_own` / `update_own` / `delete_own`) حذف شدند — دیگر هیچ کاربر احراز‌هویت‌شده‌ای نمی‌تواند role خودش را عوض کند
>    (حفره privilege escalation)، خودش را به workspace دلخواه اضافه کند، یا خودسرانه خارج شود (تصمیم ۴). عضویت از این پس فقط
>    از طریق trigger ثبت‌نام و RPCهای SECURITY DEFINER (فاز invite/RPC همین طرح) تغییر می‌کند.
> 2. گیت workspace روی **همه‌ی ۲۵ روت** `/api/social/*` اعمال شد: ۱۲ روت با wrapper به `withAuth` تبدیل شدند
>    (عضویت را خودکار چک می‌کنند) و ۱۳ روت با `requireAuth` قدیمیِ session-only گیت دستی `getCurrentWorkspace()` گرفتند
>    (الگوی `content/[id]/status`). تست رگرسیون: `src/app/api/social/workspace-gate.test.ts` (۱۰ مورد).
>    typecheck پاک؛ ۴۶۶/۴۶۶ تست پاس.

1. مایگریشن SQL: ستون permissions + جدول permission_audit + جدول workspace_invitations + RPCها + اصلاح policyهای workspace_members.
2. `src/lib/permissions.ts` + توسعه‌ی WorkspaceContext (ستون permissions) + تست.
3. روت‌های API اعضا/دعوت/audit + سرویس `workspace-members.service.ts` (با demo-mode fallback مثل بقیه سرویس‌ها).
4. اعمال wrapperهای ماژولی روی روت‌های نوشتن هر ماژول (فاز A).
5. UI تب «اعضا» + ماتریس + دعوت + تاریخچه.
6. تست: unit برای permissions/service + e2e سبک برای تغییر permission به‌عنوان owner.

## ۴. تصمیمات نهایی (تأیید مالک)

1. **پیش‌فرض member جدید:** همه هیچ — JSON پیش‌فرض `{brands:none, social:none, finance:none, tasks:none, content:none}` (settings برای member اصلاً اعمال نمی‌شود).
2. **دعوت:** لینک دستی — UI مالک دکمه‌ی «کپی لینک دعوت» دارد؛ ارسال خودکار ایمیل در فاز بعد (نیاز به SMTP).
3. **دامنه‌ی اعمال:** فاز A + B با هم — همه‌ی روت‌های نوشتن (requireModuleCreate/Edit) و همه‌ی روت‌های خواندن (requireModuleView) هر شش ماژول در همین اجرا پوشش داده می‌شوند. روت‌های همیشه‌باز (command-center، notifications، profile، assets) دست‌نخورده می‌مانند؛ command-center خودش بر اساس ماژول‌های مجاز، خانه‌های خالی/صفر برمی‌گرداند.
4. **خروج اختیاری:** بسته — policy `delete_own_workspace_member` حذف می‌شود؛ حذف عضو فقط از طریق RPC امنیتی (owner: همه، admin: به‌جز ownerها).

---

## ۵. وضعیت اجرا (۲۰۲۶-۱۰-۰۴) — فاز ۲ کامل شد

**گیت:** `npm run typecheck` پاک · `npm test` = ۳۲ فایل / ۵۰۳ تست پاس · تست E2E زنده = ۵۶/۵۶.

### ۵.۱ کشف مهم: هیچ‌کدام از مایگریشن‌های فاز ۲ اجرا نشده بود

هر دو مایگریشن فاز ۲ فقط روی دیسک بودند و **هرگز روی پایگاه‌داده‌ی واقعی اجرا نشده بودند**:
`supabase_migrations.schema_migrations` روی `20260823150000` متوقف بود، جدول `workspace_members` ستون `permissions` نداشت،
`permission_audit` و `workspace_invitations` وجود نداشتند، هیچ‌کدام از ۵ RPC نصب نشده بودند، و policyهای
`insert_own` / `update_own` / `delete_own` همچنان فعال بودند (یعنی هر عضو می‌توانست role خودش را عوض کند).

### ۵.۲ چهار باگ مسدودکننده (همه با اجرای واقعی SQL کشف شدند، نه با خواندن)

| # | مشکل | خطای واقعی | رفع |
|---|------|------------|-----|
| ۱ | `app_role` مقدار `member` نداشت ولی مایگریشن `DEFAULT 'member'` می‌ساخت | `invalid input value for enum app_role: "member"` | `ALTER TYPE app_role ADD VALUE 'member'` |
| ۲ | policy دعوت‌ها `user_id_check(email)` را صدا می‌زد که اصلاً در DB نیست | `function user_id_check(text) does not exist` | حذف شد؛ clause هم خراب بود هم بی‌استفاده (پذیرش از راه RPC انجام می‌شود) |
| ۳ | `gen_random_bytes(32)` بدون ذکر schema | `function gen_random_bytes(integer) does not exist` | `extensions.gen_random_bytes` (روی Supabase در schema `extensions` است و `search_path` روی `public` قفل است) |
| ۴ | `encode(..., 'base64url')` | `unrecognized encoding: "base64url"` | `'base64'` + `translate()` به الفبای URL-safe (base64url نام Node است، نه PostgreSQL) |

دو محافظت ایمنی هم اضافه شد: `update_member_access` دیگر اجازه‌ی هدف‌گذاری خودِ کاربر را نمی‌دهد، و
`remove_workspace_member` حذف خود و حذف **آخرین مالک** را رد می‌کند (وگرنه فضای کاری هیچ‌کسی نمی‌ماند که بتواند اعضا را مدیریت کند).

### ۵.۳ فایل‌های جدید

- `src/services/workspace-members.service.ts` — همه‌ی mutationها فقط از طریق RPC امنیتی؛ خطاها بر اساس SQLSTATE به `errorCode` نگاشت می‌شوند (`42501`→forbidden, `P0002`→not_found, `23505`→conflict, `PGRST202`→not_configured).
- `src/app/api/workspace/` — `members` (GET باز برای همه‌ی اعضا), `members/[userId]` (PATCH/DELETE، owner+admin), `invitations` (GET/POST، owner+admin), `invitations/[token]` (DELETE)، `invitations/accept` (requireAuth)، `permissions/audit` (owner+admin).
- `src/components/settings/sections/members-settings.tsx` + `members-permission-matrix.tsx` — تب «اعضا و دسترسی».
- `src/app/invite/[token]/page.tsx` — صفحه‌ی پذیرش دعوت (چون ایمیلی در پروژه نیست، لینک دستی است).
- تست‌ها: `src/lib/permissions.test.ts` (۱۳)، `src/services/workspace-members.service.test.ts` (۲۴)، `e2e-members-verify.mjs` (۵۶ چک زنده).

### ۵.۴ ایمیل: وجود ندارد (تصمیم قطعی)

هیچ سیستم ایمیلی در پروژه نیست: نه در `package.json` (resend/nodemailer/sendgrid/postmark/mailgun/SMTP)، نه نصب‌شده در
`node_modules`، نه متغیر محیطی در `.env*`. تنها مورد، [send-test-email.mjs](../scripts/send-test-email.mjs) است که یک
اسکریپت رهاشده با کلید `re_xxxxxxxxx` و TODO است و هرگز اجرا نشده. بنابراین طبق تصمیم شما، **لینک دعوت فقط تولید و
برای کپی/ارسال دستی نمایش داده می‌شود** — دقیقاً همان چیزی که در بخش ۴ بند ۲ مصوب بود.

### ۵.۵ شکاف کشف‌شده: چند-فضای‌کاری بودن (نیاز به تصمیم بعدی)

تریگر `handle_new_user` به **هر** حساب جدید یک فضای کاری شخصی با نقش owner می‌دهد. بعد از پذیرش دعوت، کاربر عضو
**دو** فضای کاری است و همچنان owner فضای شخصی خودش می‌ماند — ولی `getCurrentWorkspace()` با `limit(1)` قدیمی‌ترین
عضویت را برمی‌گرداند و اپلیکیشن workspace-switcher ندارد. یعنی فضای کاری‌ای که کاربر به آن دعوت شده عملاً
غیرقابل‌دسترسی است. تست E2E این را آشکارا assert می‌کند و سپس فضای شخصی را حذف می‌کند تا بقیه‌ی سناریوها معنادار بمانند.

راه‌حل‌ها: (الف) هنگام پذیرش دعوت، فضای شخصی خالیِ کاربر حذف/رها شود؛ (ب) `getCurrentWorkspace()` آخرین/فعال‌ترین
عضویت را برگرداند و UI انتخاب workspace داشته باشد؛ (ج) ثبت‌نام با دعوت، اصلاً فضای شخصی نسازد. **این نیاز به تصمیم مالک دارد.**

### ۵.۶ اجرای تست زنده

`node e2e-members-verify.mjs` (نیازمند دیتابیس در حال اجرا و یک سرور dev با `DEMO_MODE=false` روی پورت ۳۱۰۰).
خودش دو حساب واقعی می‌سازد، دعوت می‌سازد/می‌پذیرد، مجوز را تغییر می‌دهد، محدودیت را روی
`/api/finance/overview` و `/api/settings` از طریق HTTP واقعی بررسی می‌کند و در پایان همه‌چیز را پاک می‌کند.

---

## ۶. ثبت‌نام از لینک دعوت (۲۰۲۶-۱۰-۰۴) — شکاف چند-فضای‌کاری بسته شد

**تصمیم مالک:** «عدم ساخت فضای شخصی در ثبت‌نام با دعوت».

### ۶.۱ تفکیک ثبت‌نام عادی از ثبت‌نام با دعوت — کجا و چرا؟

توکن دعوت از طریق `auth.users.raw_user_meta_data` به تریگر می‌رسد (همان کانالی که همین حالا
`full_name` را حمل می‌کند). یعنی **تفکیک در سطح تریگر کاملاً شدنی بود**، و من آن را در تریگر گذاشتم
نه در اپلیکیشن. دلایل:

1. **اتمی بودن** — عضویت از لحظه‌ی ساخته‌شدن حساب وجود دارد. روش اپلیکیشنی (ثبت‌نام، بعد call به
   `accept_`) یک پنجره می‌سازد که کاربر در آن مالک یک فضای شخصی است و اگر خطا رخ دهد، فضای یتیم می‌ماند.
2. **بدون ساخت‌و‌حذف** — حذف cascade یک workspace که کاربر شاید در آن داده گذاشته باشد، خیلی بدتر از
   اصلاً ساختن نشدن آن است.
3. **یک منبع حقیقت** — تصمیم «این کاربر فضای شخصی دارد یا نه» در یک‌جا می‌ماند، نه در دو مسیر
   (تریگر و API) که هر دو workspace می‌سازند.

### ۶.۲ امنیت

`raw_user_meta_data` ورودی کنترل‌شده توسط کلاینت است، پس توکن **کاملاً در دیتابیس اعتبارسنجی می‌شود**:
دعوت باید وجود داشته، `status='pending'` و منقضی‌نشده باشد، و `lower(NEW.email)` باید دقیقاً برابر ایمیل
دعوت‌شده باشد. نقش و ماتریسی که داده می‌شود از **روی خود سطر دعوت** (انتخاب مالک) خوانده می‌شود، نه از
ورودی کلاینت. پس بدترین حالت یک توکن نامعتبر است که بی‌صدا به مسیر عادی (فضای شخصی) برمی‌گردد.

### ۶.۳ تأیید عملی (۶۹ چک E2E، همه PASS)

- ثبت‌نام از لینک دعوت → کاربر **دقیقاً یک** workspace دارد و همان workspace تیم است.
- نقش `member` است، پروفایل به فضای تیم اشاره می‌کند، ماتریس از خود دعوت آمده.
- دعوت در لحظه‌ی ثبت‌نام `accepted` می‌شود و `audit_logs` رویداد `member.joined` با `via: signup` می‌نویسد.
- **تست منفی امنیتی:** توکن جعلی با ایمیل ناهمخوان، عضویت در فضای تیم نمی‌دهد و به فضای شخصی خودش برمی‌گردد.

### ۶.۴ آنچه هنوز باز است

کاربری که **قبلاً** حساب دارد و بعداً دعوت را می‌پذیرد، همچنان دو workspace دارد. این با تصمیم فعلی
(که فقط درباره‌ی «ثبت‌نام از لینک دعوت» بود) خارج از محدوده است و برای حل شدن به workspace-switcher نیاز دارد.

---

## ۷. پایدارسازی لینک دعوت (`NEXT_PUBLIC_APP_URL`)

### ۷.۱ مسئله

لینک دعوت دو جا ساخته می‌شد و هر دو می‌توانستند دامنه‌ی اشتباه بدهند:

- سرویس: `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` → **`VERCEL_URL`** (هر سه در آن زمان تنظیم نبودند،
  پس عملاً `VERCEL_URL` همیشه برنده بود).
- UI: `window.location.origin` در دکمه‌ی کپیِ لیست «در انتظار».

`VERCEL_URL` روی Vercel دامنه‌ی *همان deployment جاری* است؛ برای یک branch build این یک هاست preview است.
هاست‌های preview پشت **Deployment Protection** هستند، پس گیرنده قبل از رسیدن به اپ به صفحه‌ی
«عضو شوید در Vercel / وارد حساب Vercel» هدایت می‌شد. `window.location.origin` هم دقیقاً همان نشت را
داشت: مالکی که روی preview کار می‌کرد، لینک preview را کپی می‌کرد.

### ۷.۲ تصمیم

`NEXT_PUBLIC_APP_URL` تنها منبع لینک است. نه `VERCEL_URL` و نه `window.location.origin`.

**سرور تنها منبع حقیقت است:** فیلد `acceptUrl` روی خود رکورد دعوت قرار گرفت و در پاسخ لیست هم برمی‌گردد.
دلیل: تکرار نکردن منطق دامنه در کلاینت (دو نسخه که می‌توانستند از هم جدا شوند)، و اینکه `NEXT_PUBLIC_*`
در کلاینت هنگام build درون‌ریزی می‌شود — پس نسخه‌ی کلاینت تا redeploy کهنه می‌ماند ولی سرور بلافاصله درست است.

**نبود متغیر = خطای صریح، نه لینک خراب:** `createWorkspaceInvitation` **پیش از نوشتن** با
`not_configured` (HTTP 501) رد می‌شود و `console.error` می‌دهد. این ترتیب عمدی است: ساختن ردیف و شکست
بعد از آن، یک دعوتِ غیرقابل‌استفاده جا می‌گذاشت. `listWorkspaceInvitations` هم به‌جای لیستی با لینک
خالی، `not_configured` می‌دهد. `copyLink` در UI لینک خالی را کپی نمی‌کند.

### ۷.۳ پیش‌نیاز استقرار

`NEXT_PUBLIC_APP_URL` باید روی محیط **Production** (و اگر از preview استفاده می‌شود، روی Preview) با
دامنه‌ی عمومی برنامه تنظیم شود. تا پیش از آن، `POST /api/workspace/invitations` با 501 پاسخ می‌دهد.

### ۷.۴ تأیید عملی

- با `NEXT_PUBLIC_APP_URL=https://sepehr-phi.vercel.app`: لینک تولیدشده `sepehr-phi.vercel.app/invite/<token>`
  — مستقل از هاستی که سرویس روی آن اجرا می‌شود.
- تست منفی با `NEXT_PUBLIC_APP_URL` unset و `VERCEL_URL` عمداً ست‌شده روی هاست preview:
  **501**، صفر سطر یتیم در `workspace_invitations`، و پیام خطای صریح در لاگ.
- E2E: ۷۵ چک (۶ چک جدید) — همه PASS.
