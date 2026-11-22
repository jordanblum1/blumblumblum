import { test, expect } from '@playwright/test';

const open = async page => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  await page.getByRole('button', { name: 'Feeling lucky?', exact: true }).click();
  await expect(page.locator('[data-lucky-machine]')).toBeVisible();
  await expect(page.locator('.links-nav')).toBeHidden();
};
const lever = page => page.getByRole('button', { name: 'Pull the lever', exact: true });
const result = page => page.locator('[data-lucky-winner]');

test('the discoverable clue reveals three colored native symbols with unique local definitions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await expect(lever(page)).toBeFocused();
  await expect(page.locator('[data-lucky-symbol]')).toHaveCount(3);
  expect(await page.locator('[data-lucky-symbol]').evaluateAll(elements =>
    new Set(elements.map(element => getComputedStyle(element).color)).size,
  )).toBe(3);
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
  await expect(page.locator('[data-lucky-status]')).toContainText('Jackpot!');
  expect(await page.locator('[data-lucky-symbol]').evaluateAll(elements =>
    elements.map(element => element.dataset.luckySymbol),
  )).toEqual(['GitHub', 'GitHub', 'GitHub']);
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
    expect(await page.locator('[data-lucky-symbol]').evaluateAll(elements =>
      elements.map(element => element.dataset.luckySymbol),
    )).toEqual([choice.label, choice.label, choice.label]);
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
  await page.getByRole('button', { name: '← Back to links', exact: true }).click();
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
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-lucky-machine]')).toBeHidden();
});

test('dragging the physical arm starts one spin on mouse and touch', async ({ page }, info) => {
  await open(page);
  const box = await lever(page).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + 25;
  if (info.project.use.isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 40 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 8 });
    await page.mouse.up();
  }
  await expect(page.locator('[data-lucky-machine]')).toHaveAttribute('aria-busy', 'true');
  await expect(result(page)).toBeVisible();
  await expect(page.locator('[data-lucky-symbol]')).toHaveCount(3);
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
    await expect(cell.locator('[data-lucky-symbol]')).toHaveCount(1);
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
