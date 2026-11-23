import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../js/icon-motion.js', import.meta.url), 'utf8');
function setup(visible = true) {
  const link = new EventTarget();
  const classes = new Set();
  const icon = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    closest: () => link, dataset: { duration: '2160' } };
  const document = Object.assign(new EventTarget(), { hidden: false, querySelectorAll: () => [icon] });
  const window = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const fine = Object.assign(new EventTarget(), { matches: true });
  const timers = new Map();
  let sequence = 0;
  let observe;
  runInNewContext(source, { document, window,
    matchMedia: query => query.includes('reduced') ? reduced : fine,
    IntersectionObserver: class { constructor(callback) { observe = visible => callback([{ target: icon, isIntersecting: visible }]); } observe() {} },
    setTimeout: callback => { timers.set(++sequence, callback); return sequence; },
    clearTimeout: id => timers.delete(id),
  });
  if (visible) observe(true);
  const pointer = (type, pointerType = 'mouse') => link.dispatchEvent(Object.assign(new Event(type), { pointerType }));
  const playing = () => classes.has('is-playing');
  const change = (query, matches) => { query.matches = matches; query.dispatchEvent(new Event('change')); };
  return { pointer, playing, link, document, window, reduced, fine, change, observe, timers };
}

test('rest, focus and touch do not start motion; one fine hover does', () => {
  const state = setup();
  assert.equal(state.timers.size, 0);
  state.link.dispatchEvent(new Event('focus'));
  state.pointer('pointerenter', 'touch');
  assert.equal(state.playing(), false);
  state.pointer('pointerenter');
  assert.equal(state.playing(), true);
  const finish = [...state.timers.values()][0];
  finish();
  assert.equal(state.playing(), false);
  assert.equal(state.timers.size, 0, 'no idle replay is scheduled');
  state.pointer('pointerleave'); state.pointer('pointerenter');
  assert.equal(state.playing(), true);
  state.pointer('pointerleave');
  assert.equal(state.playing(), false);
});

test('visibility, reduced motion and pointer changes cancel motion without an idle restart', () => {
  const state = setup();
  state.pointer('pointerenter'); state.observe(false);
  assert.equal(state.playing(), false);
  state.observe(true);
  assert.equal(state.playing(), false);
  state.pointer('pointerenter'); state.change(state.reduced, true);
  assert.equal(state.playing(), false);
  state.pointer('pointerleave'); state.change(state.reduced, false); state.pointer('pointerenter');
  assert.equal(state.playing(), true);
  state.document.hidden = true; state.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.playing(), false);
  state.document.hidden = false; state.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.playing(), false);
  state.pointer('pointerenter'); state.window.dispatchEvent(new Event('blur'));
  assert.equal(state.playing(), false);
  state.change(state.fine, false); state.pointer('pointerenter');
  assert.equal(state.playing(), false);
});

test('every SVG animation selector requires the playing state, including each grouped selector', () => {
  for (const name of ['jrb', 'toolbox', 'github', 'photos', 'instagram', 'strava', 'wings']) {
    const svg = readFileSync(new URL(`../assets/motion/${name}.svg`, import.meta.url), 'utf8');
    const style = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    // Only leaf CSS blocks can declare animation; keyframe leaves contain transforms/opacity.
    for (const [, selectors, declarations] of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const startsMotion = [...declarations.matchAll(/(?:^|;)\s*animation(?:-name)?\s*:\s*([^;]+)/g)]
        .some(([, value]) => !value.trim().startsWith('none'));
      if (!startsMotion) continue;
      for (const selector of selectors.split(',')) {
        assert.ok(selector.includes('.is-playing'), `${name}: ${selector.trim()} starts motion without hover activation`);
      }
    }
  }
});


test('a pointer arriving before the first visibility callback starts when it becomes visible', () => {
  const state = setup(false);
  state.pointer('pointerenter');
  assert.equal(state.playing(), false);
  state.observe(true);
  assert.equal(state.playing(), true);
  state.pointer('pointerleave');
  assert.equal(state.playing(), false);
});
