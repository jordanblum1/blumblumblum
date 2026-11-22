// Short local samples only. The AudioContext is created/resumed by a deliberate
// lever action; loading/decoding failures leave the picker fully usable in silence.
export function createSlotSounds() {
  const names = ['pull', 'roll', 'stop', 'win'];
  const buffers = new Map();
  const playing = new Map();
  let context;
  let data;
  let decoded;
  let run = 0;
  let rolling = null;
  let enabled = false;

  const prime = () => {
    data ??= Promise.all(names.map(async name => {
      const response = await fetch(`./assets/audio/slot-${name}.mp3`);
      if (!response.ok) throw new Error('Optional slot sound unavailable');
      return [name, await response.arrayBuffer()];
    })).catch(() => null);
    return data;
  };
  const cue = (name, loop = false) => {
    if (!enabled || !context || context.state !== 'running' || document.hidden || !buffers.has(name)) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers.get(name);
    source.loop = loop;
    if (loop) {
      source.playbackRate.setValueAtTime(1, context.currentTime);
      source.playbackRate.setValueAtTime(1, context.currentTime + 1.6);
      source.playbackRate.linearRampToValueAtTime(.6, context.currentTime + 3.6);
    }
    gain.gain.value = loop ? .12 : .3;
    source.connect(gain).connect(context.destination);
    playing.set(source, gain);
    if (loop) rolling = source;
    source.onended = () => {
      playing.delete(source);
      if (rolling === source) rolling = null;
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  };
  const stop = () => {
    ++run;
    enabled = false;
    for (const [source, gain] of playing) {
      gain.gain.setTargetAtTime(0, context.currentTime, .008);
      source.stop(context.currentTime + .03);
    }
    playing.clear();
    rolling = null;
  };
  const end = () => {
    ++run;
    if (!rolling) return;
    const gain = playing.get(rolling);
    gain.gain.setTargetAtTime(0, context.currentTime, .008);
    rolling.stop(context.currentTime + .03);
    rolling = null;
  };
  const begin = () => {
    stop();
    const current = run;
    const started = performance.now();
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      // Resume synchronously within the trusted click/drag-release gesture.
      const resumed = context.resume();
      decoded ??= prime().then(async samples => {
        if (!samples) return;
        await Promise.all(samples.map(async ([name, bytes]) => {
          buffers.set(name, await context.decodeAudioData(bytes));
        }));
      });
      Promise.all([resumed, decoded]).then(() => {
        // A slow load must not start a stale soundtrack halfway through a spin.
        if (current !== run || performance.now() - started > 350) return;
        enabled = true;
        cue('pull');
        cue('roll', true);
      }).catch(() => { /* Sound is optional when autoplay or decoding is blocked. */ });
    } catch { /* Unsupported/blocked audio keeps the visual interaction intact. */ }
  };
  return { prime, begin, cue, end, stop };
}
