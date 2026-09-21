/**
 * Guest Mode toggle — full end-to-end.
 *
 * Flow:
 *  1. Register a fresh owner (email confirmation disabled → instant session).
 *  2. Baseline: an anonymous browser context GET /api/brands → 401.
 *  3. Owner opens Settings → «حالت مهمان» → Switch → confirmation Dialog
 *     (explicit "demo data only" wording) → confirm → success toast with the
 *     10-second propagation notice.
 *  4. DB assertions: app_settings.guest_mode_enabled = true, changed_by set,
 *     audit_logs row 'guest_mode.toggled' with the actor id.
 *  5. After ~10s (TTL propagation) anon GET /api/brands → 200 with seeded
 *     demo brands (>0).
 *  6. Owner toggles OFF (no dialog) → DB flag false + audit row.
 *  7. After ~10s anon GET /api/brands → 401/403 again.
 *
 * Requires the dev server to run in AUTH mode (DEMO_MODE=false) — start it
 * with:  DEMO_MODE=false npm run dev   (Playwright reuses an existing :3000).
 */
import { test, expect } from '@playwright/test';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const email = `guest-e2e-${Date.now()}@example.com`;
const password = 'Passw0rd!123';

let db: pg.Client;

function connectionString(): string {
  const cs = process.env.DATABASE_URL ?? '';
  return `${cs}${cs.includes('?') ? '&' : '?'}sslmode=no-verify`;
}

test.beforeAll(async () => {
  db = new pg.Client({ connectionString: connectionString() });
  await db.connect();
});

test.afterAll(async () => {
  await db.end();
});

test('guest mode toggle: UI → DB → anon access on/off', async ({ browser }) => {
  test.setTimeout(180_000);

  // ── 1. Register a fresh owner ──────────────────────────────────────────
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto('/register');
  await ownerPage.fill('#fullName', 'Guest Mode E2E');
  await ownerPage.fill('#email', email);
  await ownerPage.fill('#password', password);
  await ownerPage.fill('#confirmPassword', password);
  await ownerPage.click('button[type=submit]');
  await ownerPage.waitForURL('**/command-center', { timeout: 45_000 });

  // ── 2. Baseline: anon is unauthorized ─────────────────────────────────
  const anonCtx = await browser.newContext();
  const anonPage = await anonCtx.newPage();
  let anonRes = await anonPage.request.get('http://127.0.0.1:3000/api/brands');
  expect(anonRes.status()).toBe(401);

  // ── 3. Toggle ON through the Settings UI ──────────────────────────────
  await ownerPage.goto('/settings');
  await ownerPage.getByRole('button', { name: 'حالت مهمان' }).click();
  const sw = ownerPage.getByRole('switch', { name: 'حالت مهمان' });
  // Generous timeout: first hit compiles /api/settings in dev mode.
  await expect(sw).toBeVisible({ timeout: 45_000 });
  await sw.click();

  // Confirmation dialog with the explicit demo-data-only wording.
  await expect(
    ownerPage.getByRole('heading', { name: 'فعال‌سازی حالت مهمان' }),
  ).toBeVisible();
  await expect(
    ownerPage.getByText(/داده‌های نمایشی.*در دسترس عموم/),
  ).toBeVisible();
  await ownerPage
    .getByRole('button', { name: 'تأیید و فعال‌سازی' })
    .click({ timeout: 15_000 });

  // Success toast with the 10s propagation notice; switch stays ON.
  await expect(ownerPage.getByText(/اعمال می‌شود/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(sw).toBeChecked({ timeout: 10_000 });

  // ── 4. DB assertions: flag + actor + audit trail ──────────────────────
  let ownerId = '';
  for (let i = 0; i < 10; i++) {
    const flag = await db.query(
      'SELECT guest_mode_enabled, changed_by FROM app_settings WHERE id = 1',
    );
    if (flag.rows[0]?.guest_mode_enabled === true) {
      ownerId = flag.rows[0].changed_by ?? '';
      break;
    }
    await ownerPage.waitForTimeout(500);
  }
  const audit = await db.query(
    `SELECT user_id, action, entity_type, metadata, created_at
     FROM audit_logs
     WHERE entity_type = 'app_settings' AND entity_id = 'guest_mode'
       AND metadata->>'enabled' = 'true'
     ORDER BY created_at DESC LIMIT 1`,
  );
  expect(audit.rows).toHaveLength(1);
  expect(audit.rows[0].action).toBe('guest_mode.toggled');
  expect(audit.rows[0].user_id).toBeTruthy();

  // ── 5. After ~10s TTL: anon read succeeds with seeded demo brands ─────
  await ownerPage.waitForTimeout(10_500);
  anonRes = await anonPage.request.get('http://127.0.0.1:3000/api/brands');
  expect(anonRes.status()).toBe(200);
  const body = (await anonRes.json()) as { ok: boolean; brands: unknown[] };
  expect(body.ok).toBe(true);
  expect(Array.isArray(body.brands)).toBe(true);
  expect(body.brands.length).toBeGreaterThan(0);

  // ── 6. Toggle OFF (no dialog) ─────────────────────────────────────────
  await sw.click();
  await expect(sw).toBeChecked({ checked: false, timeout: 15_000 });
  const auditOff = await db.query(
    `SELECT user_id FROM audit_logs
     WHERE entity_type = 'app_settings' AND entity_id = 'guest_mode'
       AND metadata->>'enabled' = 'false'
     ORDER BY created_at DESC LIMIT 1`,
  );
  expect(auditOff.rows).toHaveLength(1);

  // ── 7. After ~10s TTL: anon is locked out again ───────────────────────
  await ownerPage.waitForTimeout(10_500);
  anonRes = await anonPage.request.get('http://127.0.0.1:3000/api/brands');
  expect([401, 403]).toContain(anonRes.status());

  await ownerCtx.close();
  await anonCtx.close();
});
