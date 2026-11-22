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
  await expect(page.locator('[data-lucky-reel] [data-lucky-symbol]')).toHaveCount(9);
  expect(await page.locator('[data-lucky-reel] [data-lucky-symbol]').evaluateAll(elements =>
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
  await expect(result(page)).toHaveAttribute('aria-label', 'GitHub');
  await expect(result(page).locator('.lucky-ticket-label')).toHaveText('GitHub');
  await expect(page.locator('.lucky-payline')).toHaveCSS('opacity', '1');
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
  await expect(page.locator('[data-lucky-reel] [data-lucky-symbol]')).toHaveCount(0);
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
  await expect(page.locator('[data-lucky-reel] [data-lucky-symbol]')).toHaveCount(9);
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

test('the footer uses a slot-machine clue and opaque readable captions without glass containers', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-lucky-open] svg')).toBeVisible();
  await expect(page.locator('[data-grain-hint]')).toHaveAccessibleName('Reveal the grain hint');
  await expect(page.getByText('developed by hand', { exact: true })).toHaveCount(0);
  await expect(page.locator('.site-footer')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  for (const theme of ['light', 'darkroom']) {
    if (theme === 'darkroom') await page.keyboard.type('grain');
    const text = await page.locator('.link-label, .site-signature, .toast.is-visible').evaluateAll(elements => {
      const luminance = rgb => rgb.slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const parse = color => color.match(/[\d.]+/g).map(Number);
      return elements.map(element => {
        const style = getComputedStyle(element);
        const foreground = parse(style.color);
        const background = parse(style.backgroundColor);
        const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
        return { label: element.textContent.trim(), ratio: (values[1] + .05) / (values[0] + .05),
          alpha: background[3] ?? 1, fits: element.scrollHeight <= element.clientHeight + 1 };
      });
    });
    for (const item of text) {
      expect(item.alpha, theme + ': ' + item.label).toBe(1);
      expect(item.ratio, theme + ': ' + item.label).toBeGreaterThanOrEqual(4.5);
      expect(item.fits, theme + ': ' + item.label).toBe(true);
    }
  }
  await page.locator('[data-grain-hint]').click();
  await expect(page.locator('[data-toast]')).toContainText('grain');
});

test('the slower reels end in sequence and the ticket identifies the center winner', async ({ page }) => {
  await open(page);
  await lever(page).click();
  const rotations = await page.locator('.lucky-strip').evaluateAll(strips => strips.map(strip => {
    const animation = strip.getAnimations()[0];
    return { duration: animation.effect.getTiming().duration, frames: animation.effect.getKeyframes().length };
  }));
  expect(rotations.map(rotation => rotation.duration)).toEqual([2800, 3180, 3600]);
  expect(rotations.every(rotation => rotation.frames > 2)).toBe(true);
  await expect(result(page)).toBeVisible();
  const choice = await result(page).getAttribute('aria-label');
  expect(await centers(page)).toEqual([choice, choice, choice]);
  await expect(result(page).locator('.lucky-ticket-label')).toHaveText(choice);
  await expect(result(page).locator('.lucky-ticket-art')).toBeVisible();
  const ticket = await result(page).boundingBox();
  expect(ticket.height).toBeGreaterThanOrEqual(64);
  await expect(page.locator('.lucky-payline')).toHaveCSS('opacity', '1');
  await lever(page).click();
  await expect(result(page)).toBeHidden();
  await expect(page.locator('.lucky-payline')).toHaveCSS('opacity', '0');
  await page.keyboard.press('Escape');
});

test('real local audio starts only after a lever action and stops on interruption', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.slotAudioStarts = [];
    window.slotActiveAudio = new Set();
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.slotAudioContext = this; }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => {
          window.slotAudioStarts.push({ loop: source.loop, duration: source.buffer.duration });
          window.slotActiveAudio.add(source);
          return start(...args);
        };
        source.addEventListener('ended', () => window.slotActiveAudio.delete(source));
        return source;
      }
    };
  });
  await open(page);
  expect(await page.evaluate(() => window.slotAudioContext)).toBeUndefined();
  await lever(page).click();
  await expect.poll(() => page.evaluate(() => window.slotAudioStarts.length)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.slotAudioContext.state)).toBe('running');
  expect(await page.evaluate(() => window.slotAudioStarts.filter(source => source.loop).length)).toBe(1);
  await expect(result(page)).toBeVisible();
  // Pull, rolling bed, three actual reel stops, and one winning bell.
  expect(await page.evaluate(() => window.slotAudioStarts.length)).toBe(6);
  await lever(page).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.slotActiveAudio.size)).toBe(0);
});

for (const failure of ['unavailable samples', 'blocked audio']) test('sound failure preserves the picker: ' + failure, async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (failure === 'unavailable samples') {
    await page.route('**/assets/audio/*.mp3', route => route.fulfill({ status: 404, body: '' }));
  } else {
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        resume() { return Promise.reject(new DOMException('Audio blocked', 'NotAllowedError')); }
      };
    });
  }
  await open(page);
  await lever(page).click();
  await expect(result(page)).toBeVisible();
  await expect(lever(page)).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('.links-nav')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const interruption of ['reduce', 'hide', 'resize']) test('the ticket reveal settles when interrupted by ' + interruption, async ({ page }) => {
  await open(page);
  await lever(page).click();
  // Wait on the actual reveal start, not a sleep that can miss its 240ms window.
  await page.evaluate(() => new Promise(resolve => {
    const ticket = document.querySelector('[data-lucky-winner]');
    const observer = new MutationObserver(() => {
      if (!ticket.hidden) { observer.disconnect(); resolve(); }
    });
    if (!ticket.hidden) resolve();
    else observer.observe(ticket, { attributes: true, attributeFilter: ['hidden'] });
  }));
  if (interruption === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
  else if (interruption === 'resize') await page.setViewportSize({ width: 320, height: 640 });
  else await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(result(page)).toBeVisible();
  expect(await page.locator('[data-lucky-machine]').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(lever(page)).toBeEnabled();
});
