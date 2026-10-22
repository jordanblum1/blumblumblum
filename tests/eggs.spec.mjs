// Easter-egg checks. Run: npx playwright test (EVIDENCE=1 also saves
// screenshots to docs/egg-evidence and records videos in test-results).
import { test, expect, chromium } from '@playwright/test';

const shot = (page, name) =>
  process.env.EVIDENCE &&
  page.screenshot({ path: `docs/egg-evidence/${test.info().project.name}-${name}.png`, scale: 'css' });

const isMobile = () => Boolean(test.info().project.use.isMobile);
const tap = (locator) => (isMobile() ? locator.tap() : locator.click());

const open = async (page) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
};

const center = async (locator) => {
  const box = await locator.boundingBox();
  return [box.x + box.width / 2, box.y + box.height / 2];
};

// A point that actually lands on the piece's paint, nearest its center.
const hit = (page, selector) =>
  page.locator(selector).evaluate((piece) => {
    const r = piece.getBoundingClientRect();
    const points = [];
    for (let i = 0; i <= 12; i += 1) {
      for (let j = 0; j <= 12; j += 1) points.push([r.x + (r.width * i) / 12, r.y + (r.height * j) / 12]);
    }
    const d = ([x, y]) => Math.hypot(x - r.x - r.width / 2, y - r.y - r.height / 2);
    points.sort((a, b) => d(a) - d(b));
    return points.find(([x, y]) => document.elementFromPoint(x, y)?.closest('.logo-piece') === piece);
  });

// Real touch input on the phone project, mouse on desktop.
const pointer = async (page) => {
  if (!isMobile()) {
    return {
      down: async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); },
      move: (x, y) => page.mouse.move(x, y, { steps: 10 }),
      up: () => page.mouse.up(),
    };
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  let at;
  return {
    down: (x, y) => touch('touchStart', [(at = { x, y })]),
    move: async (x, y) => {
      const from = at;
      for (let i = 1; i <= 10; i += 1) {
        at = { x: from.x + ((x - from.x) * i) / 10, y: from.y + ((y - from.y) * i) / 10 };
        await touch('touchMove', [at]);
      }
    },
    up: () => touch('touchEnd', []),
  };
};

test('clay egg: triple tap morphs into clay, squishes, and Esc exits', async ({ page }) => {
  await open(page);
  const logo = page.locator('[data-logo-button]');
  const grab = await hit(page, '.logo-piece-1');
  for (let i = 0; i < 3; i += 1) await tap(logo);
  await expect(page.locator('.logo-panel')).toHaveClass(/is-clay/, { timeout: 20_000 });
  await page.waitForTimeout(900);
  await shot(page, 'clay');

  const p = await pointer(page);
  await p.down(...grab);
  await page.waitForTimeout(350);
  await shot(page, 'clay-squish');
  await p.move(grab[0] + 140, grab[1] + 20);
  await p.up();
  await page.waitForTimeout(500);
  await shot(page, 'clay-spin');

  await page.keyboard.press('Escape');
  await expect(page.locator('.logo-panel')).not.toHaveClass(/is-clay/);
});

test('catch the letters: bbb drops the pieces, dragging them home rebuilds the logo', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('b');
  await expect(page.locator('.logo-ghost')).toHaveCount(4);
  await page.waitForTimeout(1800);
  await shot(page, 'catch-fallen');

  const p = await pointer(page);
  for (let i = 1; i <= 4; i += 1) {
    const piece = page.locator(`.brand-mark .logo-piece-${i}`);
    const grab = await hit(page, `.brand-mark .logo-piece-${i}`);
    const [px, py] = await center(piece);
    const [sx, sy] = await center(page.locator('.logo-ghost').nth(i - 1));
    await p.down(...grab);
    await p.move(sx + grab[0] - px, sy + grab[1] - py);
    await p.up();
    await expect(piece).toHaveClass(/is-home/);
    if (i === 2) await shot(page, 'catch-half');
  }

  await expect(page.locator('[data-toast]')).toContainText('blumblumblum');
  await expect(page.locator('.logo-ghost')).toHaveCount(0);
  await shot(page, 'catch-done');
});

test('catch the letters: Esc puts the pieces back', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('b');
  await expect(page.locator('.logo-ghost')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(page.locator('.logo-ghost')).toHaveCount(0);
  await expect
    .poll(() => page.locator('.logo-piece-4').evaluate((el) => getComputedStyle(el).translate))
    .toBe('none');
});

test('link roulette: long-press picks a link and does not count as a tap', async ({ page }) => {
  await open(page);
  const logo = page.locator('[data-logo-button]');
  const p = await pointer(page);
  await p.down(...(await hit(page, '.logo-piece-1')));
  await page.waitForTimeout(750);
  await p.up();
  await page.waitForTimeout(600);
  await shot(page, 'roulette-spin');

  await expect(page.locator('.links-grid li.is-picked')).toHaveCount(1, { timeout: 5_000 });
  await expect(page.locator('[data-toast]')).toContainText('Today you should look at');
  await shot(page, 'roulette-pick');

  // Had the long-press counted as tap one, two more taps would summon the clay.
  await tap(logo);
  await tap(logo);
  await page.waitForTimeout(1_500);
  await expect(page.locator('.logo-panel')).not.toHaveClass(/is-clay/);
});

test('a short tap replays the logo and never spins the roulette', async ({ page }) => {
  await open(page);
  const logo = page.locator('[data-logo-button]');
  await tap(logo);
  await expect(logo).toHaveClass(/is-replaying/);
  await page.waitForTimeout(1_500);
  await expect(page.locator('.links-grid li:is(.is-rolling, .is-picked)')).toHaveCount(0);
  await expect(page.locator('[data-toast]')).not.toContainText('Today');
});

test('HTML-in-Canvas feature probe', async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'probe once');
  const args = ['--enable-blink-features=CanvasDrawElement', '--enable-features=CanvasDrawElement'];
  for (const channel of [undefined, 'chrome']) {
    const browser = await chromium.launch({ channel, args }).catch(() => null);
    if (!browser) {
      console.log(`[html-in-canvas] ${channel} is not installed`);
      continue;
    }
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4501/');
    const detect = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      return {
        drawElementImage: 'drawElementImage' in CanvasRenderingContext2D.prototype,
        texElementImage2D: gl?.texElementImage2D?.length ?? false,
        texElementSubImage2D: Boolean(gl && 'texElementSubImage2D' in gl),
        requestPaint: 'requestPaint' in HTMLCanvasElement.prototype,
        contentDrawable: 'content' in HTMLCanvasElement.prototype,
      };
    });
    console.log(`[html-in-canvas] ${channel ?? 'bundled chromium'} ${browser.version()} ${JSON.stringify(detect)}`);
    await browser.close();
  }
});
