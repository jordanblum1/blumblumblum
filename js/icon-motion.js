// One small gesture while hovered. Native anchors always navigate immediately.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const states = [...document.querySelectorAll('svg[data-icon-motion]')].map(icon => {
    icon.classList.add('is-controlled');
    return { icon, link: icon.closest('a'), visible: false, hovered: false, playing: false, timer: 0 };
  });
  const allowed = state => state.visible && state.hovered && finePointer.matches && !document.hidden && !reduced.matches;
  const stop = state => {
    clearTimeout(state.timer);
    state.playing = false;
    state.icon.classList.remove('is-playing');
  };
  const play = state => {
    if (!allowed(state) || state.playing) return;
    state.playing = true;
    state.icon.classList.add('is-playing');
    state.timer = setTimeout(() => stop(state), Number(state.icon.dataset.duration));
  };
  const sync = () => states.forEach(state => { if (!allowed(state)) stop(state); });
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(item => item.icon === entry.target);
      state.visible = entry.isIntersecting;
      if (!state.visible) { state.hovered = false; stop(state); }
      else play(state);
    }
  }, { threshold: .5 });
  for (const state of states) {
    observer.observe(state.icon);
    state.link.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !finePointer.matches) return;
      state.hovered = true;
      play(state);
    });
    state.link.addEventListener('pointerleave', () => { state.hovered = false; stop(state); });
  }
  const suspend = () => states.forEach(state => { state.hovered = false; stop(state); });
  reduced.addEventListener('change', sync);
  finePointer.addEventListener('change', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  window.addEventListener('blur', suspend);
  window.addEventListener('pagehide', suspend);
})();
