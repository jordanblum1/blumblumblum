import { test, expect } from '@playwright/test';

const open = async page => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  await page.getByRole('button', { name: 'Feeling lucky?', exact: true }).click();
  await expect(page.locator('[data-lucky-machine]')).toBeVisible();
  await expect(page.locator('.links-nav')).toBeHidden();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('data-lucky-state', 'idle');
};
const lever = page => page.getByRole('button', { name: 'Pull the lever', exact: true });
const result = page => page.locator('[data-lucky-winner]');
const centers = page => page.locator('[data-lucky-reel]').evaluateAll(reels =>
  reels.map(reel => reel.children[1].dataset.luckySymbol),
);

test('the discoverable clue reveals nine native symbols in the site palette with unique local definitions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await expect(lever(page)).toBeFocused();
  await expect(page.locator('[data-lucky-symbol]')).toHaveCount(9);
  expect(await page.locator('[data-lucky-symbol]').evaluateAll(elements =>
    new Set(elements.map(element => getComputedStyle(element).color)).size,
  )).toBe(1);
  expect(await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return ids.length === new Set(ids).size;
  })).toBe(true);
  await expect(page.locator('[data-lucky-open]')).toHaveAttribute('aria-expanded', 'true');
  expect(errors).toEqual([]);
});

test('the lever settles on three matching icons and an actual destination', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 2.5 / 9; });
  await open(page);
  await lever(page).click();
  await expect(lever(page)).toBeDisabled();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('aria-busy', 'true');
  await expect(result(page)).toBeVisible();
  await expect(result(page)).toHaveAttribute('href', 'https://github.com/jordanblum1');
  await expect(page.locator('[data-lucky-status]')).toContainText('GitHub selected.');
  await expect(result(page)).toHaveText('GitHub ↗');
  expect(await centers(page)).toEqual(['GitHub', 'GitHub', 'GitHub']);
  await expect(lever(page)).toBeEnabled();
  await page.route('https://github.com/jordanblum1', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Chosen destination</title>',
  }));
  await result(page).click();
  await expect(page).toHaveTitle('Chosen destination');
});

test('every original destination can win and reduced motion settles without spinning', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const choices = await page.locator('.outpost-link').evaluateAll(elements => elements.map(element => ({
    href: element.getAttribute('href'),
    label: element.querySelector('.link-label').textContent.trim(),
  })));
  for (const [index, choice] of choices.entries()) {
    await page.evaluate(value => { Math.random = () => value; }, (index + .5) / choices.length);
    await lever(page).click();
    await expect(result(page)).toHaveAttribute('href', choice.href);
    expect(await centers(page)).toEqual([choice.label, choice.label, choice.label]);
    expect(await page.locator('[data-lucky-machine]').evaluate(element =>
      element.getAnimations({ subtree: true })
        .filter(animation => !(animation instanceof CSSTransition && animation.transitionProperty === 'color'))
        .map(animation => animation.constructor.name),
    ), choice.label).toEqual([]);
  }
});

test('closing during a spin cancels it, restores links and returns focus to the clue', async ({ page }) => {
  await open(page);
  await lever(page).click();
  await page.getByRole('button', { name: 'Return to links', exact: true }).click();
  await expect(page.locator('[data-lucky-machine]')).toBeHidden();
  await expect(page.locator('.outpost-link')).toHaveCount(9);
  await expect(page.locator('.links-nav')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feeling lucky?', exact: true })).toBeFocused();
  await expect(page.locator('[data-lucky-symbol]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Feeling lucky?', exact: true }).click();
  await expect(result(page)).toBeHidden();
  await expect(lever(page)).toBeEnabled();
  await lever(page).press('Enter');
  await expect(result(page)).toBeVisible();
  await expect(lever(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-lucky-machine]')).toBeHidden();
});

for (const motion of ['no-preference', 'reduce']) test('one arm drag makes one choice with motion ' + motion, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(() => {
    window.luckyDraws = 0;
    Math.random = () => { window.luckyDraws++; return 2.5 / 9; };
  });
  await open(page);
  const before = await page.evaluate(() => window.luckyDraws);
  const box = await lever(page).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + 25;
  const knob = page.locator('.lucky-knob');
  const resting = await knob.boundingBox();
  if (info.project.use.isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 40 }] });
    const pulled = await knob.boundingBox();
    expect(Math.abs(pulled.x - resting.x)).toBeLessThan(1);
    if (motion === 'no-preference') expect(pulled.y - resting.y).toBeGreaterThan(30);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 8 });
    const pulled = await knob.boundingBox();
    expect(Math.abs(pulled.x - resting.x)).toBeLessThan(1);
    if (motion === 'no-preference') expect(pulled.y - resting.y).toBeGreaterThan(30);
    await page.mouse.up();
  }
  if (motion === 'no-preference') await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('aria-busy', 'true');
  await expect(result(page)).toBeVisible();
  await expect(page.locator('[data-lucky-symbol]')).toHaveCount(9);
  expect(await page.evaluate(() => window.luckyDraws)).toBe(before + 1);
  await lever(page).click();
  await expect(result(page)).toBeVisible();
  expect(await page.evaluate(() => window.luckyDraws)).toBe(before + 2);
});

test('motion preference changes and resizing settle a pending result safely', async ({ page }) => {
  await open(page);
  await lever(page).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(result(page)).toBeVisible();
  await expect(lever(page)).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await lever(page).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(result(page)).toBeVisible();
  await expect(lever(page)).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const cell of await page.locator('[data-lucky-reel]').all()) {
    await expect(cell.locator('[data-lucky-symbol]')).toHaveCount(3);
  }
});

test('without JavaScript all nine links remain available and the casino stays hidden', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.links-nav')).toBeVisible();
  await expect(page.locator('.outpost-link')).toHaveCount(9);
  await expect(page.locator('[data-lucky-machine]')).toBeHidden();
  await expect(page.locator('[data-lucky-open]')).toBeHidden();
  await context.close();
});

test('a keyboard long-press reveals the machine without accidentally spinning it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  const logo = page.locator('[data-logo-button]');
  await logo.focus();
  await page.keyboard.down('Space');
  await expect(page.locator('[data-lucky-machine]')).toBeVisible();
  await page.keyboard.up('Space');
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('aria-busy', 'false');
  await expect(result(page)).toBeHidden();
  await expect(logo).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lucky-close]')).toBeFocused();
});

test('the link artwork visibly gathers over its own stage into three tall reels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  const nav = await page.locator('.links-nav').boundingBox();
  await page.locator('[data-lucky-open]').click();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('data-lucky-state', 'opening');
  await expect(page.locator('.lucky-ghost')).toHaveCount(9);
  await expect(lever(page)).toBeDisabled();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('data-lucky-state', 'idle');
  await expect(page.locator('.lucky-ghost')).toHaveCount(0);
  const machine = await page.locator('[data-lucky-machine]').boundingBox();
  // It replaces the grid in its original stage rather than appearing below it.
  const stage = await page.locator('[data-link-stage]').boundingBox();
  expect(Math.abs(machine.y - stage.y)).toBeLessThan(1);
  expect(Math.abs(machine.x + machine.width / 2 - nav.x - nav.width / 2)).toBeLessThan(1);
  for (const reel of await page.locator('[data-lucky-reel]').all()) {
    const cells = await reel.locator('[data-lucky-symbol]').all();
    expect(cells).toHaveLength(3);
    const viewport = await reel.boundingBox();
    const row = await cells[1].boundingBox();
    expect(Math.abs(row.y + row.height / 2 - viewport.y - viewport.height / 2)).toBeLessThan(1);
    expect(Math.abs(row.height * 3 - viewport.height)).toBeLessThan(1);
  }
  await expect(page.locator('.lucky-cabinet-art')).toHaveJSProperty('complete', true);
  await expect(page.locator('#lucky-instructions')).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
  await expect(page.locator('[data-lucky-status]')).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
  await expect(page.locator('[data-lucky-machine] h1, [data-lucky-machine] h2, .lucky-lever-label')).toHaveCount(0);
});

test('opening and closing are interruptible without stranded overlays or inert links', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-lucky-open]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-lucky-machine]')).toBeHidden();
  await expect(page.locator('.lucky-gather')).toHaveCount(0);
  await expect(page.locator('.links-nav')).toBeVisible();
  await page.locator('[data-lucky-open]').click();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('data-lucky-state', 'idle');
  await page.locator('[data-lucky-close]').click();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('data-lucky-state', 'closing');
  await page.locator('[data-lucky-open]').click();
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('data-lucky-state', 'idle');
  await expect(page.locator('.lucky-gather')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-lucky-machine]')).toBeHidden();
  await expect(page.locator('.links-nav')).toHaveJSProperty('inert', false);
  await expect(page.locator('[data-lucky-open]')).toBeFocused();
});

test('a hidden tab settles the reels and cancels transient motion', async ({ page }) => {
  await open(page);
  await lever(page).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(result(page)).toBeVisible();
  await expect(lever(page)).toBeEnabled();
  expect(await page.locator('[data-lucky-machine]').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});
