// A mechanical velocity profile: smooth acceleration, a steady roll, then a
// longer smooth deceleration. Sampling it once gives WAAPI compositor keyframes;
// no JavaScript runs on each animation frame.
export function reelKeyframes(distance) {
  const ramp = .14;
  const cruiseEnd = .46;
  const coast = 1 - cruiseEnd;
  const speed = 1 / (ramp / 2 + cruiseEnd - ramp + coast / 2);
  return Array.from({ length: 61 }, (_, index) => {
    const t = index / 60;
    let position;
    if (t < ramp) {
      position = speed / 2 * (t - ramp / Math.PI * Math.sin(Math.PI * t / ramp));
    } else if (t < cruiseEnd) {
      position = speed * (t - ramp / 2);
    } else {
      const elapsed = t - cruiseEnd;
      position = speed * (cruiseEnd - ramp / 2)
        + speed / 2 * (elapsed + coast / Math.PI * Math.sin(Math.PI * elapsed / coast));
    }
    return { offset: t, transform: `translateY(${-distance * (index === 60 ? 1 : position)}px)` };
  });
}
