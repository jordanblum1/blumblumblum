import { createArtwork } from './lucky-artwork.js';
import { reelKeyframes } from './lucky-reels.js';
import { createSlotSounds } from './lucky-sounds.js';

const machine = document.querySelector('[data-lucky-machine]');
const opener = document.querySelector('[data-lucky-open]');
const links = document.querySelector('.links-nav');
const stage = document.querySelector('[data-link-stage]');
const lever = document.querySelector('[data-lucky-lever]');
const arm = lever?.querySelector('.lucky-lever-arm');
const winner = document.querySelector('[data-lucky-winner]');
const status = document.querySelector('[data-lucky-status]');
const back = document.querySelector('[data-lucky-close]');
const reels = [...document.querySelectorAll('[data-lucky-reel]')];
if (machine && opener && links && stage && lever && arm && winner && status && back && reels.length === 3) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const choices = [...links.querySelectorAll('.outpost-link')].map(link => ({
    href: link.getAttribute('href'),
    label: link.querySelector('.link-label').textContent.trim(),
    art: link.querySelector('.icon-disc').firstElementChild,
  }));
  const symbol = createArtwork(choices);
  const sounds = createSlotSounds();
  const reelRuns = [{ steps: 9, duration: 2800 }, { steps: 11, duration: 3180 }, { steps: 13, duration: 3600 }];
  let state = 'closed';
  let epoch = 0;
  let selected = 0;
  let returnTo = opener;
  let animations = [];
  let ghosts = null;
  let last = [0, 1, 2];
  let drag = null;
  let suppressPointerClick = false;
  let returnLeverFocus = false;
  let armTimer = 0;

  const setState = value => {
    state = value;
    machine.dataset.luckyState = value;
    machine.setAttribute('aria-busy', String(value === 'spinning'));
    lever.disabled = value !== 'idle';
  };
  const animate = (element, frames, options) => {
    const animation = element.animate(frames, options);
    animations.push(animation);
    return animation;
  };
  const cancelAnimations = () => {
    ++epoch;
    animations.forEach(animation => animation.cancel());
    animations = [];
    ghosts?.remove();
    ghosts = null;
  };
  const afterAnimations = callback => {
    const current = epoch;
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (current === epoch) callback();
    }).catch(() => { /* Interrupted transitions settle through their owning state. */ });
  };
  const resetArm = (immediate = false) => {
    clearTimeout(armTimer);
    arm.style.transitionDuration = immediate || reduced.matches ? '0ms' : '200ms';
    arm.style.transform = 'translateY(0)';
  };
  const resetDrag = () => {
    drag = null;
    lever.classList.remove('is-dragging');
    resetArm();
  };
  const pullArm = distance => {
    clearTimeout(armTimer);
    // The user's pull tracks directly; the release uses an interruptible transition.
    arm.style.transitionDuration = '160ms';
    arm.style.transform = 'translateY(36px)';
    armTimer = window.setTimeout(() => resetArm(), distance >= 18 ? 80 : 160);
  };
  const renderRows = tops => reels.forEach((reel, column) => {
    reel.replaceChildren(...[0, 1, 2].map(row => symbol((tops[column] + row * 3) % choices.length)));
  });
  const cellArt = index => reels[index % 3].children[Math.floor(index / 3)].firstElementChild;
  const gather = (from, to) => {
    ghosts = document.createElement('div');
    ghosts.className = 'lucky-gather';
    ghosts.setAttribute('aria-hidden', 'true');
    document.body.append(ghosts);
    choices.forEach((choice, index) => {
      const start = from[index];
      const end = to[index];
      const ghost = symbol(index);
      ghost.classList.add('lucky-ghost');
      Object.assign(ghost.style, { width: start.width + 'px', height: start.height + 'px' });
      ghosts.append(ghost);
      animate(ghost, [
        { transform: `translate(${start.x}px, ${start.y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${end.x}px, ${end.y}px) scale(${end.width / start.width}, ${end.height / start.height})`, opacity: 1 },
      ], { duration: 580, delay: index * 22, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'both' });
    });
  };
  const settleOpening = () => {
    if (state !== 'opening') return;
    cancelAnimations();
    setState('idle');
    if (returnTo === opener) lever.focus({ preventScroll: true });
  };
  const finish = (celebrate = false) => {
    if (state !== 'spinning') return;
    cancelAnimations();
    resetArm(true);
    if (celebrate) sounds.end();
    else sounds.stop();
    setState('idle');
    if (returnLeverFocus && document.activeElement === document.body) lever.focus({ preventScroll: true });
    returnLeverFocus = false;
    last = [selected, selected, selected];
    reels.forEach(reel => reel.replaceChildren(
      symbol((selected + 8) % choices.length), symbol(selected), symbol((selected + 1) % choices.length),
    ));
    winner.href = choices[selected].href;
    const ticketArt = symbol(selected);
    ticketArt.classList.add('lucky-ticket-art');
    const label = document.createElement('span');
    label.className = 'lucky-ticket-label';
    label.textContent = choices[selected].label;
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    winner.replaceChildren(ticketArt, label, arrow);
    winner.setAttribute('aria-label', choices[selected].label);
    winner.hidden = false;
    status.textContent = choices[selected].label + ' selected. Follow the link, or spin again.';
    machine.classList.add('has-winner');
    if (celebrate && !reduced.matches && !document.hidden) {
      sounds.cue('win');
      animate(winner, [
        { opacity: 0, transform: 'translateY(-18px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
      animate(machine.querySelector('.lucky-payline'), [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    }
  };
  const spin = (startDistance = 0) => {
    if (state !== 'idle') return;
    drag = null;
    lever.classList.remove('is-dragging');
    cancelAnimations();
    machine.classList.remove('has-winner');
    returnLeverFocus = document.activeElement === lever;
    setState('spinning');
    selected = Math.floor(Math.random() * choices.length);
    winner.hidden = true;
    status.textContent = 'Reels spinning.';
    if (reduced.matches) { finish(); return; }
    pullArm(startDistance);
    sounds.begin();
    const currentRound = epoch;
    reels.forEach((reel, column) => {
      const rowHeight = reel.getBoundingClientRect().height / 3;
      const current = [...reel.children];
      const strip = document.createElement('div');
      strip.className = 'lucky-strip';
      // Preserve the visible three rows at release, then travel to the center winner.
      strip.append(...current);
      const { steps, duration } = reelRuns[column];
      for (let step = 3; step < steps; step++) strip.append(symbol((last[column] + step) % choices.length));
      strip.append(symbol((selected + 8) % choices.length), symbol(selected), symbol((selected + 1) % choices.length));
      reel.replaceChildren(strip);
      const rotation = animate(strip, reelKeyframes(steps * rowHeight), { duration, easing: 'linear', fill: 'forwards' });
      rotation.finished.then(() => {
        if (currentRound === epoch && state === 'spinning') sounds.cue('stop');
      }).catch(() => { /* The round was interrupted. */ });
    });
    afterAnimations(() => finish(true));
  };
  const settleClosed = (restoreFocus = true) => {
    cancelAnimations();
    resetDrag();
    resetArm(true);
    sounds.stop();
    machine.classList.remove('has-winner');
    suppressPointerClick = false;
    returnLeverFocus = false;
    setState('closed');
    machine.hidden = true;
    reels.forEach(reel => reel.replaceChildren());
    winner.replaceChildren();
    winner.hidden = true;
    links.hidden = false;
    links.inert = false;
    links.style.removeProperty('opacity');
    stage.style.removeProperty('min-height');
    opener.setAttribute('aria-expanded', 'false');
    if (restoreFocus && returnTo.isConnected) returnTo.focus({ preventScroll: true });
  };
  const show = origin => {
    if (state === 'closing') settleClosed(false);
    if (state !== 'closed') {
      if (origin === opener && state === 'idle') lever.focus();
      return;
    }
    returnTo = origin instanceof HTMLElement ? origin : opener;
    const from = choices.map(choice => choice.art.getBoundingClientRect());
    const height = links.getBoundingClientRect().height;
    links.hidden = true;
    machine.hidden = false;
    stage.style.minHeight = Math.max(height, machine.getBoundingClientRect().height) + 'px';
    last = [0, 1, 2];
    renderRows(last);
    sounds.prime();
    winner.hidden = true;
    opener.setAttribute('aria-expanded', 'true');
    status.textContent = 'Link slot machine. Activate or drag the round handle down to choose a destination. Escape returns to links.';
    setState('opening');
    if (reduced.matches || document.hidden) { settleOpening(); return; }
    const to = choices.map((choice, index) => cellArt(index).getBoundingClientRect());
    gather(from, to);
    animate(machine.querySelector('.lucky-cabinet'), [
      { opacity: 0, transform: 'translateY(20px) scale(.94)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 520, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'both' });
    afterAnimations(settleOpening);
  };
  const close = (restoreFocus = true) => {
    if (state === 'closed') return;
    if (state !== 'idle' || reduced.matches || document.hidden || !restoreFocus) {
      settleClosed(restoreFocus); return;
    }
    const from = choices.map((choice, index) => cellArt(index).getBoundingClientRect());
    cancelAnimations();
    resetDrag();
    sounds.stop();
    setState('closing');
    links.hidden = false;
    links.inert = true;
    links.style.opacity = '0';
    gather(from, choices.map(choice => choice.art.getBoundingClientRect()));
    animate(machine.querySelector('.lucky-cabinet'), [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(12px) scale(.96)' },
    ], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    afterAnimations(() => settleClosed(restoreFocus));
  };
  const settleMotion = () => {
    resetDrag();
    resetArm(true);
    sounds.stop();
    if (state === 'opening') settleOpening();
    else if (state === 'closing') settleClosed();
    else if (state === 'spinning') finish();
    else cancelAnimations();
  };

  opener.addEventListener('click', () => show(opener));
  back.addEventListener('click', () => close());
  lever.addEventListener('click', event => {
    // Touch release can dispatch a click after a completed drag has already chosen.
    if (event.detail > 0 && suppressPointerClick) { suppressPointerClick = false; return; }
    suppressPointerClick = false;
    spin();
  });
  lever.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || state !== 'idle') return;
    suppressPointerClick = false;
    clearTimeout(armTimer);
    arm.style.removeProperty('transition-duration');
    drag = { id: event.pointerId, y: event.clientY, distance: 0 };
    lever.setPointerCapture(event.pointerId);
    lever.classList.add('is-dragging');
  });
  lever.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag.distance = Math.min(36, Math.max(0, event.clientY - drag.y));
    // Write directly on the moving part; no parent variable recalculation per frame.
    arm.style.transform = `translateY(${drag.distance}px)`;
  });
  lever.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const distance = drag.distance;
    if (distance >= 18) { suppressPointerClick = true; spin(distance); }
    else resetDrag();
  });
  lever.addEventListener('pointercancel', resetDrag);
  lever.addEventListener('lostpointercapture', () => { if (drag) resetDrag(); });
  document.addEventListener('blum:open-luck', event => show(event.detail?.from));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  reduced.addEventListener('change', () => { if (reduced.matches) settleMotion(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settleMotion(); });
  window.addEventListener('blur', resetDrag);
  window.addEventListener('resize', settleMotion);
  window.addEventListener('pagehide', () => close(false));
  opener.hidden = false;
}
