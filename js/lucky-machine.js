// A tiny casino for choosing an internet detour. No navigation is automatic.
(() => {
  const machine = document.querySelector('[data-lucky-machine]');
  const opener = document.querySelector('[data-lucky-open]');
  const links = document.querySelector('.links-nav');
  const lever = document.querySelector('[data-lucky-lever]');
  const winner = document.querySelector('[data-lucky-winner]');
  const status = document.querySelector('[data-lucky-status]');
  const back = document.querySelector('[data-lucky-close]');
  const reels = [...document.querySelectorAll('[data-lucky-reel]')];
  if (!machine || !opener || !links || !lever || !winner || !status || !back || reels.length !== 3) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#9c4037', '#316d65', '#675386', '#35729b', '#b3476f', '#cb572e', '#44885a', '#ba8030', '#6c5792'];
  const choices = [...links.querySelectorAll('.outpost-link')].map((link, index) => ({
    href: link.getAttribute('href'),
    label: link.querySelector('.link-label').textContent.trim(),
    art: link.querySelector('.icon-disc').firstElementChild,
    color: colors[index],
  }));
  let serial = 0;
  let open = false;
  let spinning = false;
  let round = 0;
  let selected = 0;
  let returnTo = opener;
  let animations = [];
  let last = [0, 2, 5];
  let drag = null;

  const symbol = index => {
    const choice = choices[index];
    const cell = document.createElement('div');
    cell.className = 'lucky-symbol';
    cell.dataset.luckySymbol = choice.label;
    cell.style.color = choice.color;
    const art = choice.art.cloneNode(true);
    art.classList.remove('is-playing');
    art.classList.add('is-controlled');
    art.setAttribute('aria-hidden', 'true');
    art.removeAttribute('tabindex');
    if (art instanceof SVGElement) {
      art.setAttribute('focusable', 'false');
      art.setAttribute('fill', 'none');
      art.setAttribute('stroke', 'currentColor');
      art.setAttribute('stroke-width', '1.55');
      art.setAttribute('stroke-linecap', 'round');
      art.setAttribute('stroke-linejoin', 'round');
    }
    // Every reel owns its masks, clips and CSS ID hooks, including the JRB alpha.
    const prefix = 'lucky-' + (++serial) + '-';
    const ids = [...art.querySelectorAll('[id]')].map(element => element.id).sort((a, b) => b.length - a.length);
    const rewrite = value => ids.reduce((text, id) => text.replaceAll('#' + id, '#' + prefix + id), value);
    for (const element of [art, ...art.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (attribute.name === 'id') element.id = prefix + attribute.value;
        else if (attribute.value.includes('#')) element.setAttribute(attribute.name, rewrite(attribute.value));
      }
      if (element.localName === 'style') element.textContent = rewrite(element.textContent);
    }
    cell.append(art);
    return cell;
  };

  const cancelAnimations = () => {
    animations.forEach(animation => animation.cancel());
    animations = [];
  };
  const resetDrag = () => {
    drag = null;
    lever.classList.remove('is-dragging');
    lever.style.removeProperty('--lever-pull');
  };
  const finish = () => {
    if (!open || !spinning) return;
    spinning = false;
    cancelAnimations();
    machine.classList.remove('is-spinning');
    machine.setAttribute('aria-busy', 'false');
    lever.disabled = false;
    last = [selected, selected, selected];
    reels.forEach(reel => reel.replaceChildren(symbol(selected)));
    winner.href = choices[selected].href;
    winner.textContent = 'Visit ' + choices[selected].label + ' ↗';
    winner.hidden = false;
    status.textContent = 'Jackpot! Your next stop is ' + choices[selected].label + '.';
    machine.classList.add('has-jackpot');
  };
  const spin = (startAngle = '0deg') => {
    if (!open || spinning) return;
    resetDrag();
    lever.style.setProperty('--lever-start', startAngle);
    spinning = true;
    const currentRound = ++round;
    selected = Math.floor(Math.random() * choices.length);
    winner.hidden = true;
    machine.classList.remove('has-jackpot');
    machine.classList.add('is-spinning');
    machine.setAttribute('aria-busy', 'true');
    lever.disabled = true;
    status.textContent = 'Finding your next detour…';
    if (reduced.matches) {
      finish();
      return;
    }
    reels.forEach((reel, index) => {
      const strip = document.createElement('div');
      strip.className = 'lucky-strip';
      const steps = 12 + index * 3;
      for (let step = 0; step < steps; step++) strip.append(symbol((last[index] + step) % choices.length));
      strip.append(symbol(selected));
      reel.replaceChildren(strip);
      animations.push(strip.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(' + (-steps * reel.clientHeight) + 'px)' },
      ], { duration: 1400 + index * 240, easing: 'cubic-bezier(.12,.72,.18,1)', fill: 'forwards' }));
    });
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (currentRound === round) finish();
    }).catch(() => { /* Closing, resizing or reduced motion settles the reels directly. */ });
  };
  const show = origin => {
    if (open) {
      if (origin === opener) lever.focus();
      return;
    }
    open = true;
    returnTo = origin instanceof HTMLElement ? origin : opener;
    links.hidden = true;
    machine.hidden = false;
    opener.setAttribute('aria-expanded', 'true');
    status.textContent = 'Pull the lever to find your next stop.';
    winner.hidden = true;
    last = [0, 2, 5];
    reels.forEach((reel, index) => reel.replaceChildren(symbol(last[index])));
    if (returnTo === opener) {
      lever.focus({ preventScroll: true });
      machine.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  };
  const close = (restoreFocus = true) => {
    if (!open) return;
    open = false;
    spinning = false;
    round++;
    cancelAnimations();
    resetDrag();
    machine.classList.remove('is-spinning', 'has-jackpot');
    machine.setAttribute('aria-busy', 'false');
    machine.hidden = true;
    lever.disabled = false;
    reels.forEach(reel => reel.replaceChildren());
    links.hidden = false;
    opener.setAttribute('aria-expanded', 'false');
    if (restoreFocus && returnTo.isConnected) returnTo.focus({ preventScroll: true });
  };

  opener.addEventListener('click', () => show(opener));
  back.addEventListener('click', () => close());
  lever.addEventListener('click', () => spin());
  lever.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || spinning) return;
    drag = { id: event.pointerId, y: event.clientY, distance: 0 };
    lever.setPointerCapture(event.pointerId);
    lever.classList.add('is-dragging');
  });
  lever.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag.distance = Math.max(0, event.clientY - drag.y);
    lever.style.setProperty('--lever-pull', Math.min(28, drag.distance * 0.7) + 'deg');
  });
  lever.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const pulled = drag.distance >= 18;
    const angle = lever.style.getPropertyValue('--lever-pull');
    if (pulled) spin(angle);
    else resetDrag();
  });
  lever.addEventListener('pointercancel', resetDrag);
  lever.addEventListener('lostpointercapture', resetDrag);
  document.addEventListener('blum:open-luck', event => show(event.detail?.from));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) close();
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { resetDrag(); finish(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { resetDrag(); finish(); }
  });
  window.addEventListener('blur', resetDrag);
  window.addEventListener('resize', finish);
  window.addEventListener('pagehide', () => close(false));
  opener.hidden = false;
})();
