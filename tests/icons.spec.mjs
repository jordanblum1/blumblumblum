import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const baselineHTML = execFileSync('git', ['show', '071630a:index.html'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  encoding: 'utf8',
});
const motionNames = ['jrb', 'toolbox', 'github', 'photos', 'instagram', 'strava', 'wings'];
const icon = (page, name) => page.locator(`svg[data-icon-motion="${name}"]`);
const linkFor = (page, name) => page.locator('.outpost-link').filter({ has: icon(page, name) });

const open = async (page) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  await expect(page.locator('svg[data-icon-motion]')).toHaveCount(7);
};

const readyToInteract = async (page, name) => {
  const link = linkFor(page, name);
  await link.scrollIntoViewIfNeeded();
  await expect(icon(page, name)).toBeInViewport({ ratio: 0.5 });
  // Let the browser deliver its intersection observation after scrolling.
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  return link;
};

const paint = locator => locator.evaluate(root =>
  [root, ...root.querySelectorAll('g, path, rect, circle, ellipse, line, polyline, polygon')]
    .filter(element => !element.closest('defs'))
    .map(element => {
      const style = getComputedStyle(element);
      return [style.transform, style.opacity, style.strokeDashoffset];
    }),
);

const runningAnimations = locator => locator.evaluate(root =>
  root.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
);

const activeAnimationDetails = locator => locator.evaluate(root =>
  root.getAnimations({ subtree: true })
    .filter(animation => animation.playState === 'running')
    .map(animation => ({
      root: root.dataset.iconMotion,
      type: animation.constructor.name,
      name: animation.animationName ?? animation.transitionProperty ?? animation.id,
      target: animation.effect.target?.getAttribute('class') ?? animation.effect.target?.localName,
      currentTime: animation.currentTime,
      duration: animation.effect.getTiming().duration,
    })),
);

// The existing hover ink-color transition is allowed; artwork motion is not.
const withoutColorTransitions = animations => animations.filter(animation =>
  animation.type !== 'CSSTransition' || animation.name !== 'color',
);

test('all seven native icon roots are controlled and keep native link semantics', async ({ page }) => {
  await open(page);
  const roots = page.locator('svg[data-icon-motion]');
  await expect.poll(() => roots.evaluateAll(elements => elements.map(element =>
    element.classList.contains('is-controlled') ? element.dataset.iconMotion : null,
  ))).toEqual(motionNames);
  expect(await roots.evaluateAll(elements => elements.every(element => {
    const link = element.closest('a');
    return link?.matches('a.outpost-link[href]') &&
      element.getAttribute('aria-hidden') === 'true' &&
      element.getAttribute('focusable') === 'false' &&
      !element.hasAttribute('tabindex') && link.getAttribute('role') !== 'button';
  }))).toBe(true);
  await expect(page.locator('.links-grid button, .links-grid [role="button"]')).toHaveCount(0);
});

test('the nine destinations and labels and the original native artwork match the baseline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const comparison = await page.evaluate(html => {
    const baseline = new DOMParser().parseFromString(html, 'text/html');
    const links = document => [...document.querySelectorAll('.outpost-link')].map(link => ({
      href: link.getAttribute('href'),
      label: link.querySelector('.link-label').textContent.trim(),
      accessibleName: link.getAttribute('aria-label'),
    }));
    const geometryAttributes = new Set(['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points']);
    const geometry = element => ({
      tag: element.localName,
      attributes: Object.fromEntries([...element.attributes]
        .filter(attribute => geometryAttributes.has(attribute.name))
        .map(attribute => [attribute.name, ['d', 'points'].includes(attribute.name)
          ? attribute.value : Number(attribute.value)])),
    });
    const painted = element => {
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (Number(style.opacity) === 0 || style.display === 'none' || style.visibility === 'hidden') return false;
        if (ancestor.localName === 'svg') break;
      }
      return !element.closest('defs');
    };
    const visibleGeometry = name => [...document.querySelectorAll(
      `svg[data-icon-motion="${name}"] path, svg[data-icon-motion="${name}"] rect, svg[data-icon-motion="${name}"] circle`,
    )].filter(painted).map(geometry);
    return {
      links: links(document),
      originalLinks: links(baseline),
      artwork: [
        {
          name: 'github',
          original: [geometry(baseline.querySelector('.github-mark path'))],
          current: visibleGeometry('github'),
        },
        {
          name: 'instagram',
          original: [...baseline.querySelectorAll('.instagram-frame, .instagram-lens, .instagram-dot')].map(geometry),
          current: visibleGeometry('instagram'),
        },
        {
          name: 'photos',
          original: [...baseline.querySelectorAll('.photo-frame, .photo-sun, .photo-hills')].map(geometry),
          current: visibleGeometry('photos'),
        },
      ],
    };
  }, baselineHTML);
  expect(comparison.originalLinks).toHaveLength(9);
  expect(comparison.links).toEqual(comparison.originalLinks);
  for (const artwork of comparison.artwork) {
    for (const original of artwork.original) {
      expect(artwork.current, `${artwork.name} must retain its original ${original.tag}`).toContainEqual(original);
    }
  }
});

test('focusing each native link starts an actual visible icon action', async ({ page }) => {
  await open(page);
  for (const name of motionNames) {
    const root = icon(page, name);
    const link = await readyToInteract(page, name);
    const rest = await paint(root);
    await link.focus();
    await expect(root).toHaveClass(/is-playing/);
    await expect.poll(() => runningAnimations(root), { intervals: [16, 16, 32] }).toBeGreaterThan(0);
    await expect.poll(() => paint(root), { intervals: [16, 16, 32], timeout: 1000 }).not.toEqual(rest);
  }
});

test('hover or focus re-entry leaves the current phrase running and returns to its original rest', async ({ page }, info) => {
  await open(page);
  const root = icon(page, 'photos');
  const link = await readyToInteract(page, 'photos');
  const rest = await paint(root);
  if (info.project.use.isMobile) await link.focus();
  else await link.hover();
  await expect(root).toHaveClass(/is-playing/);
  await expect.poll(() => paint(root), { intervals: [16, 16, 32], timeout: 1000 }).not.toEqual(rest);
  await root.evaluate(async element => {
    const animations = element.getAnimations({ subtree: true }).filter(animation =>
      !(animation instanceof CSSTransition && animation.transitionProperty === 'color'),
    );
    await Promise.all(animations.map(animation => animation.ready));
    window.iconPhraseUnderTest = animations.map(animation => ({
      animation, startTime: animation.startTime, currentTime: animation.currentTime,
    }));
  });
  expect(await root.evaluate(() => window.iconPhraseUnderTest.length)).toBeGreaterThan(0);
  if (info.project.use.isMobile) {
    await link.blur();
    await link.focus();
  } else {
    await page.mouse.move(0, 0);
    await link.hover();
    await link.focus();
  }
  expect(await root.evaluate(element => {
    const current = element.getAnimations({ subtree: true }).filter(animation =>
      !(animation instanceof CSSTransition && animation.transitionProperty === 'color'),
    );
    return window.iconPhraseUnderTest.every(({ animation, startTime, currentTime }) =>
      current.includes(animation) && animation.startTime === startTime && animation.currentTime >= currentTime,
    ) && current.length === window.iconPhraseUnderTest.length;
  })).toBe(true);
  await expect(root).not.toHaveClass(/is-playing/, { timeout: 4000 });
  expect(await runningAnimations(root)).toBe(0);
  expect(await paint(root)).toEqual(rest);
});

test('reduced motion keeps every icon static and cancels an action when the preference changes', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const name of motionNames) {
    const root = icon(page, name);
    const link = await readyToInteract(page, name);
    const rest = await paint(root);
    await link.focus();
    if (!info.project.use.isMobile) await link.hover();
    await expect(root).not.toHaveClass(/is-playing/);
    const active = await activeAnimationDetails(root);
    expect(withoutColorTransitions(active), `${name} reduced-motion animations: ${JSON.stringify(active)}`).toEqual([]);
    expect(await paint(root)).toEqual(rest);
  }
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const link = await readyToInteract(page, 'photos');
  await link.blur();
  const rest = await paint(icon(page, 'photos'));
  await link.focus();
  await expect(icon(page, 'photos')).toHaveClass(/is-playing/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('svg[data-icon-motion].is-playing')).toHaveCount(0);
  const active = (await Promise.all(motionNames.map(name => activeAnimationDetails(icon(page, name))))).flat();
  expect(withoutColorTransitions(active), `Reduced-motion animations after preference change: ${JSON.stringify(active)}`).toEqual([]);
  expect(await paint(icon(page, 'photos'))).toEqual(rest);
});

test('taking an icon offscreen cancels its current phrase and restores its rest', async ({ page }) => {
  await open(page);
  const root = icon(page, 'photos');
  const link = await readyToInteract(page, 'photos');
  const rest = await paint(root);
  await link.focus();
  await expect(root).toHaveClass(/is-playing/);
  await page.evaluate(() => {
    document.body.style.paddingBottom = '200vh';
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await expect(root).not.toBeInViewport();
  await expect(root).not.toHaveClass(/is-playing/);
  expect(await runningAnimations(root)).toBe(0);
  expect(await paint(root)).toEqual(rest);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(root).toBeInViewport({ ratio: 0.5 });
  await expect(root).not.toHaveClass(/is-playing/);
});

test('native icon links navigate without canceling the click or waiting for animation completion', async ({ page, baseURL }) => {
  const clicks = [];
  await page.exposeFunction('recordIconLinkClick', details => clicks.push(details));
  await page.addInitScript(() => {
    window.addEventListener('click', event => {
      const link = event.target.closest?.('a.outpost-link');
      const root = link?.querySelector('svg[data-icon-motion]');
      if (!root) return;
      queueMicrotask(() => window.recordIconLinkClick({
        href: link.getAttribute('href'),
        prevented: event.defaultPrevented,
        playing: root.classList.contains('is-playing'),
      }));
    });
  });
  await open(page);
  const targets = await page.locator('svg[data-icon-motion]').evaluateAll(elements => elements.map(element => ({
    name: element.dataset.iconMotion,
    href: element.closest('a').getAttribute('href'),
  })));
  const destinations = new Set(targets.map(target => new URL(target.href, baseURL).href));
  // Keep destination requests local; navigation still uses each real anchor's default action.
  await page.route(url => destinations.has(url.href), route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Native destination reached</title>',
  }));
  for (const [index, target] of targets.entries()) {
    if (index > 0) await open(page);
    const link = await readyToInteract(page, target.name);
    if (target.name === 'photos') {
      await link.focus();
      await expect(icon(page, 'photos')).toHaveClass(/is-playing/);
    }
    const destination = new URL(target.href, baseURL).href;
    await Promise.all([page.waitForURL(destination), link.click()]);
    await expect(page).toHaveTitle('Native destination reached');
    await expect.poll(() => clicks.find(click => click.href === target.href)).toBeTruthy();
    const click = clicks.find(click => click.href === target.href);
    expect(click.prevented, `${target.name} must leave navigation to the anchor`).toBe(false);
    if (target.name === 'photos') expect(click.playing).toBe(true);
  }
});

test('all nine links fit the viewport without horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.locator('.outpost-link')).toHaveCount(9);
  expect(await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    linksFit: [...document.querySelectorAll('.outpost-link')].every(link => {
      const rectangle = link.getBoundingClientRect();
      return rectangle.left >= -1 && rectangle.right <= window.innerWidth + 1;
    }),
  }))).toEqual({
    viewport: page.viewportSize().width,
    document: page.viewportSize().width,
    body: page.viewportSize().width,
    linksFit: true,
  });
});

for (const device of [
  { name: 'small iPhone', width: 320, height: 568, touch: true, rows: [3, 3, 3] },
  { name: 'iPhone', width: 390, height: 844, touch: true, rows: [3, 3, 3] },
  { name: 'iPad', width: 768, height: 1024, touch: true, rows: [3, 3, 3] },
  { name: 'large iPad', width: 1024, height: 1366, touch: true, rows: [3, 3, 3] },
  { name: 'landscape iPad', width: 1366, height: 1024, touch: true, rows: [3, 3, 3] },
  { name: 'desktop', width: 1280, height: 860, touch: false, rows: [5, 4] },
]) test('balanced link rows on ' + device.name, async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'One explicit viewport matrix; not duplicated by the mobile project.');
  const context = await browser.newContext({ baseURL, viewport: { width: device.width, height: device.height },
    hasTouch: device.touch, isMobile: device.touch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/is-ready/);
  const geometry = await page.locator('.links-grid li').evaluateAll(elements => elements.map(element => {
    const { x, y, width } = element.getBoundingClientRect();
    return { x, y, width };
  }));
  const rows = [];
  for (const cell of geometry) {
    let row = rows.find(row => Math.abs(row.y - cell.y) < 2);
    if (!row) { row = { y: cell.y, cells: [] }; rows.push(row); }
    row.cells.push(cell);
  }
  expect(rows.map(row => row.cells.length)).toEqual(device.rows);
  const centers = rows.map(row => (row.cells[0].x + row.cells.at(-1).x + row.cells.at(-1).width) / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.link-label').first()).toHaveCSS('border-top-left-radius', '10px');
  await context.close();
});
