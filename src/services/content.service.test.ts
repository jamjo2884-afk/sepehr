import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Content Workflow Service tests.
 *
 * Tests the in-memory fallback path (no Supabase required), matching the
 * brand.service test convention. Covers CRUD, workspace isolation,
 * status-transition validation and NULL-safe updates.
 */

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

import {
  getContents,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
  transitionContentStatus,
} from '@/services/content.service';

const WS_A = 'ws-a';
const WS_B = 'ws-b';
const USER = 'user-1';

describe('Content Service (in-memory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. createContent creates a draft with trimmed title and links', async () => {
    const content = await createContent(
      {
        title: '  پست برند ازما  ',
        type: 'post',
        brandId: 'brand-1',
        campaignId: 'camp-1',
        platform: 'instagram',
        scheduledAt: '2026-09-10T08:00:00.000Z',
      },
      WS_A,
      USER,
    );

    expect(content).not.toBeNull();
    expect(content!.title).toBe('پست برند ازما');
    expect(content!.status).toBe('draft');
    expect(content!.brandId).toBe('brand-1');
    expect(content!.campaignId).toBe('camp-1');
    expect(content!.platform).toBe('instagram');
    expect(content!.workspaceId).toBe(WS_A);
  });

  it('2. getContents returns only rows of the same workspace', async () => {
    await createContent({ title: 'محتوا در فضای A' }, WS_A, USER);
    await createContent({ title: 'محتوا در فضای B' }, WS_B, USER);

    const inA = await getContents(WS_A);
    const inB = await getContents(WS_B);

    expect(inA.some((c) => c.title === 'محتوا در فضای A')).toBe(true);
    expect(inA.some((c) => c.title === 'محتوا در فضای B')).toBe(false);
    expect(inB.some((c) => c.title === 'محتوا در فضای B')).toBe(true);
    expect(inB.some((c) => c.title === 'محتوا در فضای A')).toBe(false);
  });

  it('3. getContents filters by status and brandId', async () => {
    const c1 = await createContent({ title: 'پیش‌نویس', brandId: 'b1' }, WS_A, USER);
    const c2 = await createContent({ title: 'تأییدشده', brandId: 'b2' }, WS_A, USER);
    await transitionContentStatus(c2!.id, 'review', WS_A, USER);
    await transitionContentStatus(c2!.id, 'approved', WS_A, USER);

    const drafts = await getContents(WS_A, { status: 'draft' });
    const approved = await getContents(WS_A, { status: 'approved' });
    const byBrand = await getContents(WS_A, { brandId: 'b1' });

    expect(drafts.map((c) => c.id)).toContain(c1!.id);
    expect(drafts.map((c) => c.id)).not.toContain(c2!.id);
    expect(approved.map((c) => c.id)).toContain(c2!.id);
    expect(byBrand.map((c) => c.id)).toContain(c1!.id);
    expect(byBrand.map((c) => c.id)).not.toContain(c2!.id);
  });

  it('4. getContentById is workspace-scoped', async () => {
    const content = await createContent({ title: 'محدوده‌دار' }, WS_A, USER);

    const found = await getContentById(content!.id, WS_A);
    const notFound = await getContentById(content!.id, WS_B);

    expect(found?.id).toBe(content!.id);
    expect(notFound).toBeNull();
  });

  it('5. updateContent updates fields and allows NULL for optional links', async () => {
    const content = await createContent(
      { title: 'قبل', brandId: 'b1', platform: 'telegram' },
      WS_A,
      USER,
    );

    const updated = await updateContent(
      content!.id,
      { title: 'بعد', brandId: null, platform: null },
      WS_A,
      USER,
    );

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('بعد');
    expect(updated!.brandId).toBeNull();
    expect(updated!.platform).toBeNull();
    expect(updated!.status).toBe('draft'); // status untouched by updateContent
  });

  it('6. updateContent returns null for unknown or cross-workspace id', async () => {
    const content = await createContent({ title: 'آزمون' }, WS_A, USER);

    const missing = await updateContent('no-such-id', { title: 'x' }, WS_A, USER);
    const crossWs = await updateContent(content!.id, { title: 'x' }, WS_B, USER);

    expect(missing).toBeNull();
    expect(crossWs).toBeNull();
  });

  it('7. valid transitions succeed and publish sets published_at', async () => {
    const content = await createContent({ title: 'چرخه کامل' }, WS_A, USER);
    const id = content!.id;

    const toReview = await transitionContentStatus(id, 'review', WS_A, USER);
    expect(toReview.ok).toBe(true);
    if (toReview.ok) expect(toReview.content.status).toBe('review');

    const toApproved = await transitionContentStatus(id, 'approved', WS_A, USER);
    expect(toApproved.ok).toBe(true);

    const toScheduled = await transitionContentStatus(id, 'scheduled', WS_A, USER);
    expect(toScheduled.ok).toBe(true);

    const toPublished = await transitionContentStatus(id, 'published', WS_A, USER);
    expect(toPublished.ok).toBe(true);
    if (toPublished.ok) {
      expect(toPublished.content.status).toBe('published');
      expect(toPublished.content.publishedAt).not.toBeNull();
    }
  });

  it('8. invalid transitions are rejected', async () => {
    const content = await createContent({ title: 'پرش نامعتبر' }, WS_A, USER);

    // draft → published is not allowed (must go through review/approved)
    const jump = await transitionContentStatus(content!.id, 'published', WS_A, USER);
    expect(jump.ok).toBe(false);
    if (!jump.ok) expect(jump.error).toContain('مجاز نیست');

    // published → draft is not allowed
    const c2 = await createContent({ title: 'پس از انتشار' }, WS_A, USER);
    await transitionContentStatus(c2!.id, 'review', WS_A, USER);
    await transitionContentStatus(c2!.id, 'approved', WS_A, USER);
    await transitionContentStatus(c2!.id, 'published', WS_A, USER);
    const back = await transitionContentStatus(c2!.id, 'draft', WS_A, USER);
    expect(back.ok).toBe(false);
  });

  it('9. rejected → draft and failed → draft are allowed (rework paths)', async () => {
    const rejected = await createContent({ title: 'ردشده' }, WS_A, USER);
    await transitionContentStatus(rejected!.id, 'review', WS_A, USER);
    const rej = await transitionContentStatus(rejected!.id, 'rejected', WS_A, USER);
    expect(rej.ok).toBe(true);
    const rework = await transitionContentStatus(rejected!.id, 'draft', WS_A, USER);
    expect(rework.ok).toBe(true);

    const failed = await createContent({ title: 'ناموفق' }, WS_A, USER);
    await transitionContentStatus(failed!.id, 'review', WS_A, USER);
    await transitionContentStatus(failed!.id, 'approved', WS_A, USER);
    await transitionContentStatus(failed!.id, 'scheduled', WS_A, USER);
    const fail = await transitionContentStatus(failed!.id, 'failed', WS_A, USER);
    expect(fail.ok).toBe(true);
    const retry = await transitionContentStatus(failed!.id, 'draft', WS_A, USER);
    expect(retry.ok).toBe(true);
  });

  it('10. transition rejects unknown content and same-status moves', async () => {
    const missing = await transitionContentStatus('no-such-id', 'review', WS_A, USER);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('یافت نشد');

    const content = await createContent({ title: 'تکرار وضعیت' }, WS_A, USER);
    const same = await transitionContentStatus(content!.id, 'draft', WS_A, USER);
    expect(same.ok).toBe(false);
  });

  it('11. transition is workspace-scoped (cross-workspace denied)', async () => {
    const content = await createContent({ title: 'فضای دیگر' }, WS_A, USER);
    const result = await transitionContentStatus(content!.id, 'review', WS_B, USER);
    expect(result.ok).toBe(false);
  });

  it('12. deleteContent removes the row and is workspace-scoped', async () => {
    const content = await createContent({ title: 'حذف' }, WS_A, USER);

    const crossWs = await deleteContent(content!.id, WS_B, USER);
    expect(crossWs).toBe(false);
    expect(await getContentById(content!.id, WS_A)).not.toBeNull();

    const deleted = await deleteContent(content!.id, WS_A, USER);
    expect(deleted).toBe(true);
    expect(await getContentById(content!.id, WS_A)).toBeNull();
  });
});