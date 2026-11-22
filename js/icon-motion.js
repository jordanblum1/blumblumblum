// One small action per icon. Native anchors remain usable throughout.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const icons = [...document.querySelectorAll('svg[data-icon-motion]')];
  const states = icons.map((icon, index) => {
    icon.classList.add('is-controlled');
    return { icon, index, link: icon.closest('a'), visible: false, playing: false, timer: 0, idle: 0 };
  });
  const allowed = state => state.visible && !document.hidden && !reduced.matches;
  const stop = state => {
    clearTimeout(state.timer);
    clearTimeout(state.idle);
    state.playing = false;
    state.icon.classList.remove('is-playing');
  };
  const schedule = (state, delay = 8000) => {
    clearTimeout(state.idle);
    if (allowed(state)) state.idle = setTimeout(() => play(state), delay);
  };
  const play = state => {
    if (!allowed(state) || state.playing) return;
    clearTimeout(state.idle);
    state.playing = true;
    state.icon.classList.add('is-playing');
    state.timer = setTimeout(() => {
      state.playing = false;
      state.icon.classList.remove('is-playing');
      schedule(state);
    }, Number(state.icon.dataset.duration));
  };
  const sync = () => {
    for (const state of states) {
      if (!allowed(state)) stop(state);
      else if (!state.playing) schedule(state, 2500 + state.index * 700);
    }
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(item => item.icon === entry.target);
      state.visible = entry.isIntersecting;
      if (!allowed(state)) stop(state);
      else if (!state.playing) schedule(state, 2500 + state.index * 700);
    }
  }, { threshold: 0.5 });
  for (const state of states) {
    observer.observe(state.icon);
    state.link.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && finePointer.matches) play(state);
    });
    state.link.addEventListener('focus', () => play(state));
  }
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => states.forEach(stop));
  window.addEventListener('pageshow', sync);
})();
