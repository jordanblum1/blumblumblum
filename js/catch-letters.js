/*
 * Catch the letters: the four logo pieces tumble down the screen like Tetris
 * blocks, and dragging (or tapping) each one snaps it back into its slot.
 * Plain SVG, no three.js. Loaded on demand when "bbb" or a phone shake fires.
 * Positions live in the CSS `translate`/`rotate` properties so the rotation
 * can ease upright while the translation tracks the finger 1:1.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const SNAP_PX = 48;
const GIVE_UP_MS = 30000;

export function catchLetters(mark, { onWin, onEnd }) {
  const pieces = [...mark.querySelectorAll('.logo-piece')];
  const isHome = (piece) => piece.classList.contains('is-home');
  // SVG user units per CSS pixel: CSS translate on SVG content is in user units
  const unitsPerPx = () => mark.viewBox.baseVal.width / mark.getBoundingClientRect().width;

  // faint dashed outlines mark the empty slots
  const ghosts = pieces.map((piece) => {
    const ghost = document.createElementNS(SVG_NS, 'g');
    ghost.setAttribute('class', 'logo-ghost');
    ghost.append(piece.querySelector('path').cloneNode());
    mark.insertBefore(ghost, pieces[0]);
    return ghost;
  });

  // Each piece drops into its own lane at the bottom of the viewport, stepping
  // down and turning in quarter turns.
  const k = unitsPerPx();
  const lanes = pieces.map((_, i) => i).sort(() => Math.random() - 0.5);
  pieces.forEach((piece, i) => {
    const box = piece.getBoundingClientRect();
    const turns = [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
    const [w, h] = turns % 2 ? [box.height, box.width] : [box.width, box.height];
    const lane = window.innerWidth / pieces.length;
    const x = Math.min(Math.max(lane * (lanes[i] + 0.5), w / 2 + 8), window.innerWidth - w / 2 - 8);
    const y = window.innerHeight - 20 - h / 2 - Math.random() * 36;
    const ms = 900 + i * 140;
    piece.style.transition = `translate ${ms}ms steps(12, end) ${i * 110}ms, rotate ${ms}ms steps(${Math.abs(turns)}, end) ${i * 110}ms`;
    piece.style.translate = `${(x - box.left - box.width / 2) * k}px ${(y - box.top - box.height / 2) * k}px`;
    piece.style.rotate = `${turns * 90}deg`;
  });

  const goHome = (piece) => {
    piece.classList.add('is-home');
    piece.style.transition = 'translate 260ms var(--ease), rotate 260ms var(--ease)';
    piece.style.translate = '0px 0px';
    piece.style.rotate = '0deg';
  };

  let drag = null;
  const onDown = (event) => {
    const piece = event.target.closest?.('.logo-piece');
    if (!piece || isHome(piece) || drag) return;
    event.preventDefault();
    // pick it up wherever it is, even mid-fall
    const [x = 0, y = 0] = getComputedStyle(piece).translate.split(' ').map(parseFloat).filter((n) => !Number.isNaN(n));
    drag = { piece, x, y, id: event.pointerId, startX: event.clientX, startY: event.clientY, k: unitsPerPx(), moved: false };
    piece.classList.add('is-held');
    piece.style.transition = 'rotate 180ms var(--ease)';
    piece.style.translate = `${x}px ${y}px`;
    piece.style.rotate = '0deg';
  };
  const offset = (event) => [event.clientX - drag.startX, event.clientY - drag.startY];
  const onMove = (event) => {
    if (event.pointerId !== drag?.id) return;
    const [dx, dy] = offset(event);
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    drag.piece.style.translate = `${drag.x + dx * drag.k}px ${drag.y + dy * drag.k}px`;
  };
  const onUp = (event) => {
    if (event.pointerId !== drag?.id) return;
    const [dx, dy] = offset(event);
    const { piece, x, y, k: scale, moved } = drag;
    drag = null;
    piece.classList.remove('is-held');
    // a tap sends it home; a drag has to land near the slot
    if (moved && Math.hypot(x + dx * scale, y + dy * scale) > SNAP_PX * scale) return;
    goHome(piece);
    if (pieces.every(isHome)) stop(true);
  };

  const listen = (method) => {
    mark[method]('pointerdown', onDown);
    window[method]('pointermove', onMove);
    window[method]('pointerup', onUp);
    window[method]('pointercancel', onUp);
  };
  listen('addEventListener');
  const giveUp = window.setTimeout(() => stop(), GIVE_UP_MS);

  let stopped = false;
  function stop(won = false) {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(giveUp);
    listen('removeEventListener');
    pieces.forEach(goHome);
    window.setTimeout(() => {
      pieces.forEach((piece) => {
        piece.classList.remove('is-home', 'is-held');
        piece.style.removeProperty('transition');
        piece.style.removeProperty('translate');
        piece.style.removeProperty('rotate');
      });
      ghosts.forEach((ghost) => ghost.remove());
      onEnd();
      if (won) onWin();
    }, 300);
  }

  return {
    stop: () => stop(),
    /** Keyboard path: each logo-button press sends the next piece home. */
    homeNext() {
      const piece = pieces.find((p) => !isHome(p));
      if (piece) goHome(piece);
      if (pieces.every(isHome)) stop(true);
    },
  };
}
