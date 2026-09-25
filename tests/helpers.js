const { expect } = require('@playwright/test');

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

async function expectNoOverlap(page, selectorA, selectorB) {
  const a = await page.locator(selectorA).boundingBox();
  const b = await page.locator(selectorB).boundingBox();
  const overlaps =
    a.x < b.x + b.width && b.x < a.x + a.width &&
    a.y < b.y + b.height && b.y < a.y + a.height;

  expect(overlaps, `${selectorA} overlaps ${selectorB}`).toBe(false);
}

module.exports = { openApp, expectNoOverlap };
