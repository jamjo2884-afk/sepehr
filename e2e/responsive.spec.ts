import { expect, test, type Page } from '@playwright/test';

const MOBILE_BREAKPOINT = 1024;

const TARGET_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

/** Data-quality and review-center surfaces live in /social/accounts. */
const MAIN_ROUTES = [
  '/command-center',
  '/projects',
  '/operations',
  '/assets',
  '/distribution',
  '/social',
  '/social/accounts',
  '/campaigns',
  '/audience',
  '/analytics',
  '/intelligence',
  '/automation',
  '/knowledge',
  '/settings',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const;

type LayoutReport = {
  clientWidth: number;
  bodyScrollWidth: number;
  documentScrollWidth: number;
  overflow: number;
  sidebar: null | {
    left: number;
    right: number;
    visible: boolean;
    offscreen: boolean;
  };
  mobileMenuVisible: boolean;
  header: null | { left: number; right: number; width: number };
  oversizedElements: Array<{
    tag: string;
    className: string;
    left: number;
    right: number;
    width: number;
  }>;
};

async function inspectLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const round = (value: number) => Math.round(value);
    const rectOf = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: round(rect.left),
        right: round(rect.right),
        width: round(rect.width),
      };
    };

    const oversizedElements = Array.from(document.body.querySelectorAll('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className).slice(0, 120),
          left: round(rect.left),
          right: round(rect.right),
          width: round(rect.width),
          visible:
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.pointerEvents !== 'none' &&
            rect.width > 0 &&
            rect.height > 0,
        };
      })
      .filter(
        (element) =>
          element.visible &&
          (element.left < -1 || element.right > clientWidth + 1),
      )
      .slice(0, 12)
      .map(({ visible: _visible, ...element }) => element);

    const sidebar = document.querySelector('aside');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const mobileMenu = document.querySelector(
      'header button[aria-label="منو"]',
    );
    const header = document.querySelector('header');

    return {
      clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: root.scrollWidth,
      overflow:
        Math.max(document.body.scrollWidth, root.scrollWidth) - clientWidth,
      sidebar: sidebarRect
        ? {
            left: round(sidebarRect.left),
            right: round(sidebarRect.right),
            visible: getComputedStyle(sidebar!).display !== 'none',
            offscreen:
              sidebarRect.left >= clientWidth - 1 || sidebarRect.right <= 0,
          }
        : null,
      mobileMenuVisible: Boolean(
        mobileMenu && getComputedStyle(mobileMenu).display !== 'none',
      ),
      header: header ? rectOf(header) : null,
      oversizedElements,
    };
  });
}

async function waitForResponsiveLayout(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  await page.waitForFunction(
    () => {
      const sidebar = document.querySelector('aside');
      if (!sidebar || window.innerWidth >= 1024) return true;

      const rect = sidebar.getBoundingClientRect();
      const hidden = getComputedStyle(sidebar).display === 'none';
      return hidden || rect.left >= document.documentElement.clientWidth - 1;
    },
    undefined,
    { timeout: 5_000 },
  );
}

for (const viewport of TARGET_VIEWPORTS) {
  test(`responsive layout at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);

    for (const route of MAIN_ROUTES) {
      await test.step(`${route} @ ${viewport.width}px`, async () => {
        const response = await page.goto(route, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        await waitForResponsiveLayout(page);

        expect(
          response?.status() ?? 0,
          `${route} did not return a successful document response`,
        ).toBeLessThan(400);

        const report = await inspectLayout(page);
        const mobile = viewport.width < MOBILE_BREAKPOINT;
        const appShellPresent = Boolean(report.header || report.sidebar);

        expect(
          report.overflow,
          `${route} @ ${viewport.width}px overflow report: ${JSON.stringify(report)}`,
        ).toBeLessThanOrEqual(1);

        expect(
          report.oversizedElements,
          `${route} @ ${viewport.width}px has elements outside the viewport`,
        ).toEqual([]);

        if (report.header) {
          expect(report.header.left).toBeGreaterThanOrEqual(0);
          expect(report.header.right).toBeLessThanOrEqual(
            report.clientWidth + 1,
          );
        }

        if (report.sidebar) {
          expect(
            mobile
              ? !report.sidebar.visible || report.sidebar.offscreen
              : report.sidebar.visible && !report.sidebar.offscreen,
            `${route} @ ${viewport.width}px sidebar state is incorrect: ${JSON.stringify(report.sidebar)}`,
          ).toBe(true);
        }

        if (appShellPresent) {
          expect(
            report.mobileMenuVisible,
            `${route} @ ${viewport.width}px mobile menu visibility is incorrect`,
          ).toBe(mobile);
        }
      });
    }
  });
}
