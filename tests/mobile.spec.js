const { test, expect } = require('@playwright/test');

async function openApp(page) {
  // The application is usable without its optional CDN libraries. Blocking
  // them keeps layout and touch tests fast and independent of the network.
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const isLocal = ['127.0.0.1', 'localhost'].includes(requestUrl.hostname);

    if (isLocal) {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  await page.goto('/index.html');
  await expect(page.locator('#countAll')).toHaveText('1');
}

async function drawTouchLine(page) {
  await page.locator('#sketchCanvas').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const points = [
      [35, 80],
      [70, 105],
      [110, 125],
      [155, 150],
      [205, 165]
    ];

    const dispatchTouch = (type, point, isEnding = false) => {
      const touch = {
        identifier: 1,
        target: canvas,
        clientX: rect.left + point[0],
        clientY: rect.top + point[1]
      };
      const event = new Event(type, { bubbles: true, cancelable: true });

      Object.defineProperty(event, 'touches', {
        value: isEnding ? [] : [touch]
      });
      Object.defineProperty(event, 'changedTouches', {
        value: [touch]
      });

      canvas.dispatchEvent(event);
    };

    dispatchTouch('touchstart', points[0]);
    points.slice(1).forEach((point) => dispatchTouch('touchmove', point));
    dispatchTouch('touchend', points.at(-1), true);
  });
}

test.describe('mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('stacks the app without page-level horizontal overflow', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
      const notes = document.querySelector('.notes-panel').getBoundingClientRect();
      const workspace = document.querySelector('.workspace').getBoundingClientRect();
      const canvas = document.querySelector('#sketchCanvas');

      return {
        viewportWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        appColumns: getComputedStyle(document.querySelector('.app-container')).gridTemplateColumns,
        canvasTouchAction: getComputedStyle(canvas).touchAction,
        sidebarBottom: sidebar.bottom,
        notesTop: notes.top,
        notesBottom: notes.bottom,
        workspaceTop: workspace.top
      };
    });

    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.appColumns.split(' ')).toHaveLength(1);
    expect(layout.canvasTouchAction).toBe('none');
    expect(Math.abs(layout.sidebarBottom - layout.notesTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.notesBottom - layout.workspaceTop)).toBeLessThanOrEqual(1);

    for (const selector of [
      '#btnAirDrawToggle',
      '[data-tool="pen"]',
      '[data-tool="highlighter"]',
      '[data-tool="eraser"]',
      '#btnUndo',
      '#btnRedo',
      '#btnClearCanvas',
      '#btnExportPNG',
      '#btnExportPDF'
    ]) {
      await expect(page.locator(selector)).toBeVisible();
    }
  });

  test('keeps floating editors inside the viewport', async ({ page }) => {
    const bounds = await page.locator('.text-editor-container').boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.width).toBeLessThanOrEqual(366);
  });
});

test.describe('compact mobile layout', () => {
  // Start the browser context at this width. Chromium's mobile text autosizing
  // can retain the original form-control font size after a dynamic resize.
  test.use({ viewport: { width: 360, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('uses icon-first compact controls at 360px', async ({ page }) => {
    const compactStyles = await page.evaluate(() => ({
      airLabelFontSize: getComputedStyle(document.querySelector('#airDrawLabel')).fontSize,
      exportFontSize: getComputedStyle(document.querySelector('#btnExportPDF')).fontSize,
      clearFontSize: getComputedStyle(document.querySelector('#btnClearCanvas')).fontSize,
      folderLabelDisplay: getComputedStyle(document.querySelector('.nav-item-left span')).display,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth
    }));

    expect(compactStyles.airLabelFontSize).toBe('0px');
    expect(compactStyles.exportFontSize).toBe('0px');
    expect(compactStyles.clearFontSize).not.toBe('0px');
    expect(compactStyles.folderLabelDisplay).toBe('none');
    expect(compactStyles.bodyScrollWidth).toBeLessThanOrEqual(compactStyles.viewportWidth);
    await expect(page.locator('#btnExportPDF [data-lucide="file-down"]')).toBeAttached();
    await expect(page.locator('#btnExportPDF')).toHaveAccessibleName('Export PDF');
  });
});

test.describe('mobile interactions', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('draws with touch input and persists the canvas', async ({ page }) => {
    const canvas = page.locator('#sketchCanvas');
    const blankCanvas = await canvas.evaluate((element) => element.toDataURL('image/png'));

    await drawTouchLine(page);

    const drawnCanvas = await canvas.evaluate((element) => element.toDataURL('image/png'));
    const savedNote = await page.evaluate(() => {
      const notes = JSON.parse(localStorage.getItem('imagine_air_notes'));
      return notes[0];
    });

    expect(drawnCanvas).not.toBe(blankCanvas);
    expect(savedNote.canvasDataUrl).toBe(drawnCanvas);
  });

  test('undoes and redoes a touch stroke', async ({ page }) => {
    const canvas = page.locator('#sketchCanvas');
    const blankCanvas = await canvas.evaluate((element) => element.toDataURL('image/png'));

    await drawTouchLine(page);
    const drawnCanvas = await canvas.evaluate((element) => element.toDataURL('image/png'));

    await page.locator('#btnUndo').click();
    await expect.poll(() => canvas.evaluate((element) => element.toDataURL('image/png')))
      .toBe(blankCanvas);

    await page.locator('#btnRedo').click();
    await expect.poll(() => canvas.evaluate((element) => element.toDataURL('image/png')))
      .toBe(drawnCanvas);
  });

  test('saves and restores note text from the mobile editor', async ({ page }) => {
    await page.locator('#noteTitleInput').fill('Mobile geometry sketch');
    await page.locator('#textEditor').fill('Triangle proof captured on a phone.');
    await page.locator('#btnNewNote').click();

    await expect(page.locator('#countAll')).toHaveText('2');
    await expect(page.locator('#noteTitleInput')).toHaveValue('New Air Sketch');

    await page.getByText('Mobile geometry sketch', { exact: true }).click();

    await expect(page.locator('#noteTitleInput')).toHaveValue('Mobile geometry sketch');
    await expect(page.locator('#textEditor')).toHaveValue('Triangle proof captured on a phone.');
  });

  test('downloads a PNG with the note title', async ({ page }) => {
    await page.locator('#noteTitleInput').fill('Mobile sketch');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btnExportPNG').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Mobile_sketch.png');
  });
});
