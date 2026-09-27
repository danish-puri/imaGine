const { test, expect } = require('@playwright/test');
const { openApp, expectNoOverlap } = require('./helpers');

const DIAGONAL_STROKE = [
  [35, 80],
  [70, 105],
  [110, 125],
  [155, 150],
  [205, 165]
];

async function drawTouchLine(page, points = DIAGONAL_STROKE) {
  await page.locator('#sketchCanvas').evaluate((canvas, points) => {
    const rect = canvas.getBoundingClientRect();

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
  }, points);
}

// Reads a note from localStorage and its drawing from IndexedDB
async function readSavedNote(page, title) {
  return page.evaluate(async (title) => {
    const notes = JSON.parse(localStorage.getItem('imagine_air_notes'));
    const note = notes.find((n) => n.title === title);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('imagine_air_notes');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const drawing = await new Promise((resolve, reject) => {
      const request = db.transaction('drawings').objectStore('drawings').get(note.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { note, drawing };
  }, title);
}

function canvasImage(page) {
  return page.locator('#sketchCanvas').evaluate((element) => element.toDataURL('image/png'));
}

const WELCOME_TITLE = 'Welcome to Air Notes ✨';

test.describe('mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('keeps the canvas primary without page-level horizontal overflow', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
      const workspace = document.querySelector('.workspace').getBoundingClientRect();
      const dock = document.querySelector('.toolbar-controls').getBoundingClientRect();
      const canvas = document.querySelector('#sketchCanvas');

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyScrollWidth: document.body.scrollWidth,
        canvasTouchAction: getComputedStyle(canvas).touchAction,
        sidebarHeight: sidebar.height,
        sidebarBottom: sidebar.bottom,
        workspaceTop: workspace.top,
        workspaceBottom: workspace.bottom,
        dockBottom: dock.bottom
      };
    });

    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.canvasTouchAction).toBe('none');
    expect(layout.sidebarHeight).toBe(56);
    expect(Math.abs(layout.sidebarBottom - layout.workspaceTop)).toBeLessThanOrEqual(1);
    expect(layout.workspaceBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.dockBottom).toBeLessThanOrEqual(layout.viewportHeight);

    for (const selector of [
      '#btnAirDrawToggle',
      '[data-tool="pen"]',
      '[data-tool="highlighter"]',
      '[data-tool="eraser"]',
      '#btnUndo',
      '#btnRedo',
      '#btnMobileMore',
      '#btnMobileNotes',
      '#btnTextEditorToggle'
    ]) {
      await expect(page.locator(selector)).toBeVisible();
    }

    await expect(page.locator('#notesPanel')).toBeHidden();
    await page.locator('#btnMobileNotes').click();
    await expect(page.locator('#notesPanel')).toBeVisible();
    await expect(page.locator('#btnNotesClose')).toBeVisible();
  });

  test('keeps floating editors inside the viewport', async ({ page }) => {
    await page.locator('#btnTextEditorToggle').click();
    const bounds = await page.locator('.text-editor-container').boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.width).toBeLessThanOrEqual(366);
  });

  test('keeps the copyright line clear of the text note button', async ({ page }) => {
    await expectNoOverlap(page, '.site-copyright', '.text-editor-container');
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
      airLabelWidth: getComputedStyle(document.querySelector('#airDrawLabel')).width,
      notesLabelWidth: getComputedStyle(document.querySelector('.mobile-notes-trigger > span:not(.mobile-note-count)')).width,
      navDisplay: getComputedStyle(document.querySelector('.sidebar nav')).display,
      dockWidth: document.querySelector('.toolbar-controls').getBoundingClientRect().width,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth
    }));

    expect(compactStyles.airLabelWidth).toBe('1px');
    expect(compactStyles.notesLabelWidth).toBe('1px');
    expect(compactStyles.navDisplay).toBe('none');
    expect(compactStyles.dockWidth).toBeLessThanOrEqual(compactStyles.viewportWidth - 16);
    expect(compactStyles.bodyScrollWidth).toBeLessThanOrEqual(compactStyles.viewportWidth);

    await page.locator('#btnMobileMore').click();
    await expect(page.locator('#btnExportPDF')).toBeVisible();
    await expect(page.locator('#btnExportPDF')).toHaveAccessibleName('Export PDF');
  });

  test('keeps the copyright line clear of the text note button', async ({ page }) => {
    await expectNoOverlap(page, '.site-copyright', '.text-editor-container');
  });
});

test.describe('mobile interactions', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('draws with touch input and saves the drawing to IndexedDB', async ({ page }) => {
    const blankCanvas = await canvasImage(page);

    await drawTouchLine(page);
    const drawnCanvas = await canvasImage(page);
    expect(drawnCanvas).not.toBe(blankCanvas);

    await expect.poll(async () => (await readSavedNote(page, WELCOME_TITLE)).drawing)
      .toBe(drawnCanvas);

    // Only the text stays in localStorage, so it can't fill up with images
    const { note } = await readSavedNote(page, WELCOME_TITLE);
    expect(note.hasDrawing).toBe(true);
    expect(note).not.toHaveProperty('canvasDataUrl');
  });

  test('undo after switching notes keeps the other note\'s drawing out', async ({ page }) => {
    await drawTouchLine(page);
    const welcomeDrawing = await canvasImage(page);

    await page.locator('#btnMobileNotes').click();
    await page.locator('#btnNewNote').click();
    await drawTouchLine(page, [[40, 200], [120, 220], [200, 240]]);

    await page.locator('#btnMobileNotes').click();
    await page.locator('.note-card-title', { hasText: 'Welcome to Air Notes' }).click();
    await expect.poll(() => canvasImage(page)).toBe(welcomeDrawing);

    await page.locator('#btnUndo').click();
    expect(await canvasImage(page)).toBe(welcomeDrawing);
    await expect.poll(async () => (await readSavedNote(page, WELCOME_TITLE)).drawing)
      .toBe(welcomeDrawing);
  });

  test('the eraser fully removes lines after the highlighter was used', async ({ page }) => {
    await page.locator('[data-tool="highlighter"]').click();
    await drawTouchLine(page);

    await page.locator('[data-tool="eraser"]').click();
    await drawTouchLine(page);

    const paintedPixels = await page.locator('#sketchCanvas').evaluate((canvas) => {
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) count++;
      }
      return count;
    });
    expect(paintedPixels).toBe(0);

    // A fully erased note is stored as having no drawing at all
    await expect.poll(async () => (await readSavedNote(page, WELCOME_TITLE)).drawing)
      .toBeUndefined();
  });

  test('warns when browser storage is full instead of failing silently', async ({ page }) => {
    await expect(page.locator('#storageWarning')).toBeHidden();

    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      };
    });
    await page.locator('#noteTitleInput').fill('One note too many');

    await expect(page.locator('#storageWarning')).toBeVisible();
    await expect(page.locator('#storageWarning')).toContainText('Export this note');
  });

  test('draws a continuous stroke when input points are far apart', async ({ page }) => {
    // Fast strokes and Air Draw frames can land tens of pixels apart
    await drawTouchLine(page, [[20, 100], [60, 100], [100, 100], [140, 100], [180, 100]]);

    const emptyPixels = await page.locator('#sketchCanvas').evaluate((canvas) => {
      const row = canvas.getContext('2d').getImageData(20, 100, 161, 1).data;
      const empty = [];
      for (let x = 0; x <= 160; x += 2) {
        if (row[x * 4 + 3] === 0) empty.push(20 + x);
      }
      return empty;
    });

    expect(emptyPixels).toEqual([]);
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
    await page.locator('#btnTextEditorToggle').click();
    await page.locator('#textEditor').fill('Triangle proof captured on a phone.');

    await page.locator('#btnMobileNotes').click();
    await page.locator('#btnNewNote').click();

    await expect(page.locator('#countAll')).toHaveText('2');
    await expect(page.locator('#noteTitleInput')).toHaveValue('New Air Sketch');

    await page.locator('#btnMobileNotes').click();
    await page.getByText('Mobile geometry sketch', { exact: true }).click();

    await expect(page.locator('#noteTitleInput')).toHaveValue('Mobile geometry sketch');
    await expect(page.locator('#textEditor')).toHaveValue('Triangle proof captured on a phone.');
  });

  test('downloads a PNG with the note title', async ({ page }) => {
    await page.locator('#noteTitleInput').fill('Mobile sketch');

    await page.locator('#btnMobileMore').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btnExportPNG').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Mobile_sketch.png');
  });
});

test.describe('older saved notes', () => {
  test('moves drawings stored in localStorage into IndexedDB', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('imagine_air_notes')) return;
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 20;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, 20, 20);
      window.legacyDrawing = canvas.toDataURL('image/png');
      localStorage.setItem('imagine_air_notes', JSON.stringify([{
        id: 'note_legacy',
        title: 'Old sketch',
        contentText: '',
        canvasDataUrl: window.legacyDrawing,
        folder: 'air',
        updatedAt: new Date().toISOString()
      }]));
    });
    await openApp(page);

    await expect.poll(() => page.locator('#sketchCanvas').evaluate((canvas) =>
      canvas.getContext('2d').getImageData(10, 10, 1, 1).data[0]
    )).toBe(255);

    const legacyDrawing = await page.evaluate(() => window.legacyDrawing);
    const { note, drawing } = await readSavedNote(page, 'Old sketch');
    expect(drawing).toBe(legacyDrawing);
    expect(note.hasDrawing).toBe(true);
    expect(note).not.toHaveProperty('canvasDataUrl');
  });
});

test.describe('air draw', () => {
  test('releases the webcam when Air Draw turns off', async ({ page }) => {
    // openApp blocks the MediaPipe CDN scripts, so provide stand-ins that
    // record how the app drives the camera.
    await page.addInitScript(() => {
      window.cameraCalls = [];
      window.Hands = class {
        setOptions() {}
        onResults() {}
        async send() {}
      };
      window.Camera = class {
        async start() { window.cameraCalls.push('start'); }
        async stop() { window.cameraCalls.push('stop'); }
      };
    });
    await openApp(page);

    const toggle = page.locator('#btnAirDrawToggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Turn off Air Draw');

    await page.locator('#btnHudClose').click();
    await expect(toggle).toHaveAttribute('aria-label', 'Turn on Air Draw');
    expect(await page.evaluate(() => window.cameraCalls)).toEqual(['start', 'stop']);
  });

  test('saves a pinch stroke when the pinch is released', async ({ page }) => {
    // Stand-ins for the blocked MediaPipe scripts. The test drives the hand
    // tracking callback directly with fingertip positions.
    await page.addInitScript(() => {
      window.Hands = class {
        setOptions() {}
        onResults(callback) { window.sendHandResults = callback; }
        async send() {}
      };
      window.Camera = class {
        async start() {}
        async stop() {}
      };
      window.drawConnectors = () => {};
      window.drawLandmarks = () => {};
      window.HAND_CONNECTIONS = [];
    });
    await openApp(page);
    await page.locator('#btnAirDrawToggle').click();
    await expect(page.locator('#btnAirDrawToggle')).toHaveAttribute('aria-label', 'Turn off Air Draw');

    await page.evaluate(async () => {
      const hand = (x, y, pinched) => {
        const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
        landmarks[8] = { x, y, z: 0 };
        landmarks[4] = pinched ? { x, y, z: 0 } : { x: x + 0.3, y, z: 0 };
        return { multiHandLandmarks: [landmarks] };
      };
      for (const x of [0.8, 0.7, 0.6, 0.5, 0.4]) {
        window.sendHandResults(hand(x, 0.4, true));
      }
      window.sendHandResults(hand(0.4, 0.4, false));
    });

    const drawnCanvas = await canvasImage(page);
    await expect.poll(async () => (await readSavedNote(page, WELCOME_TITLE)).drawing)
      .toBe(drawnCanvas);
  });
});
