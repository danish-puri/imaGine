const { test, expect } = require('@playwright/test');
const { openApp, expectNoOverlap } = require('./helpers');

const TOOLBAR_CONTROLS = [
  '#noteTitleInput',
  '#btnAirDrawToggle',
  '[data-tool="pen"]',
  '[data-tool="highlighter"]',
  '[data-tool="eraser"]',
  '#brushColor',
  '#btnUndo',
  '#btnRedo',
  '#brushSize',
  '#btnClearCanvas',
  '#btnExportPNG',
  '#btnExportPDF'
];

// A wide monitor, common laptops, a small laptop, and an upright tablet
for (const width of [1920, 1440, 1280, 1024, 820]) {
  test.describe(`desktop layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test.beforeEach(async ({ page }) => {
      // openApp blocks the Lucide CDN script. Draw 24px placeholders, the
      // size Lucide renders, so the toolbar buttons keep their real width.
      await page.addInitScript(() => {
        window.lucide = {
          createIcons() {
            document.querySelectorAll('i[data-lucide]').forEach((icon) => {
              icon.outerHTML = '<svg class="lucide" width="24" height="24"></svg>';
            });
          }
        };
      });
      await openApp(page);
    });

    test('keeps every toolbar control on screen', async ({ page }) => {
      for (const selector of TOOLBAR_CONTROLS) {
        const box = await page.locator(selector).boundingBox();

        expect(box, selector).not.toBeNull();
        expect(box.x, selector).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(width);
      }

      const overflow = await page.locator('.toolbar')
        .evaluate((toolbar) => toolbar.scrollWidth - toolbar.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('keeps the About link clear of the text note and clickable', async ({ page }) => {
      await expectNoOverlap(page, '.site-copyright', '.text-editor-container');

      await page.getByRole('link', { name: 'About imaGine' }).click();
      await expect(page).toHaveURL(/about\.html$/);
    });
  });
}
