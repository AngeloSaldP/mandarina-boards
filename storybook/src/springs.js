// Springs with the site's rule: semi-implicit Euler at fixed 1/240 s steps, at rest within 0.001 of the target and
// under 0.01 per second. A long frame is capped at 0.5 s of simulated time, as the product's book does.
export const STEP_S = 1 / 240;
export const MAX_ELAPSED_S = 0.5;

export function createSpring({ stiffness, damping, value = 0 }) {
  const s = {
    value,
    velocity: 0,
    target: value,
    stiffness,
    damping,
    setTarget(target, velocity) {
      s.target = target;
      if (velocity !== undefined) s.velocity = velocity;
    },
    /** One step; false once at rest. */
    step(dt) {
      s.velocity += (s.stiffness * (s.target - s.value) - s.damping * s.velocity) * dt;
      s.value += s.velocity * dt;
      if (Math.abs(s.target - s.value) < 0.001 && Math.abs(s.velocity) < 0.01) {
        s.value = s.target;
        s.velocity = 0;
        return false;
      }
      return true;
    },
    resting() {
      return s.value === s.target && s.velocity === 0;
    },
  };
  return s;
}

/**
 * Two chained springs: the first drives the second's target. The second is the motion; the first leads it, so the
 * chain starts slowly, peaks later and lands softly (order 022).
 */
export function createChain(opts) {
  const a = createSpring(opts);
  const b = createSpring(opts);
  return {
    a,
    b,
    get value() {
      return b.value;
    },
    get velocity() {
      return b.velocity;
    },
    setTarget(t) {
      a.setTarget(t);
    },
    step(dt) {
      const ma = a.step(dt);
      b.setTarget(a.value);
      const mb = b.step(dt);
      return ma || mb || !b.resting() || b.value !== a.target;
    },
    resting() {
      return a.resting() && b.resting() && b.value === a.target;
    },
  };
}

/** Advances `fn(dt)` in fixed steps over `elapsedS` (capped). */
export function fixedSteps(elapsedS, fn) {
  let left = Math.min(elapsedS, MAX_ELAPSED_S);
  while (left > 1e-9) {
    const dt = Math.min(STEP_S, left);
    fn(dt);
    left -= dt;
  }
}

/** --ease-out: cubic-bezier(.23, 1, .32, 1). */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);
