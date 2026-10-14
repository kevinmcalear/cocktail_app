/**
 * The eight ball rolling around the screen (Eddie, 13 Oct 2026: "if you roll
 * it, it moves around. I want it to be a little bit stupid"). Pure physics,
 * one frame at a time, run as a worklet on the UI thread by
 * components/screens/eightball/useRollingBall.ts. Checked by
 * lib/eightBallRoll.check.ts.
 *
 * Pixels and seconds. The ball sits in a shallow bowl around its home spot,
 * so tilting the phone rolls it and levelling it brings it back. The answer
 * die floats in the ball's liquid: it lags behind the ball, wobbles when the
 * ball stops, sinks while the ball tumbles and floats back up as it settles.
 */

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Roll {
  /** The ball's offset from its home spot, and its speed. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radians the ball has rolled round, kept within half a turn. */
  spin: number;
  /** The die's drift inside the window, and its speed. */
  dieX: number;
  dieY: number;
  dieVX: number;
  dieVY: number;
  /** 0 with the die up against the window, 1 sunk deep in the liquid. */
  depth: number;
  /** Gravity when the phone counts as level (m/s^2, screen axes); drifts to the phone's current angle. */
  levelX: number;
  levelY: number;
  levelled: boolean;
  /** A finger has the ball: the drag sets x, y, vx and vy instead of the physics. */
  held: boolean;
}

export const AT_REST: Roll = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  spin: 0,
  dieX: 0,
  dieY: 0,
  dieVX: 0,
  dieVY: 0,
  depth: 0,
  levelX: 0,
  levelY: 0,
  levelled: false,
  held: false,
};

/** Pixels a second squared for a phone tipped all the way over (1 g). */
const TILT = 2600;
/** How hard the bowl pulls the ball home, per pixel away. */
const BOWL = 7;
/** Rolling friction: the share of speed lost each second is 1 - e^-FRICTION. */
const FRICTION = 2.6;
/** Speed kept off a wall. */
const BOUNCE = 0.55;
/** Slower hits than this don't count as a bump (no squash, no buzz). */
export const MIN_HIT = 90;
/** Seconds for "level" to catch up with the way the phone is held. */
const RELEVEL = 3;
const RADIUS = 130;
/** The die: how far it drifts in the window, how stiff its tether, how it drags in the liquid. */
const DIE_REACH = 16;
const DIE_SPRING = 90;
const DIE_DAMPING = 5;
/** The die sinks fast while the ball tumbles and floats up slowly once it settles. */
const SINK = 8;
const FLOAT = 1.6;
const TUMBLE_SPEED = 1200;
/** A long frame (a stall, the tab in the background) moves the world this far at most. */
const MAX_DT = 1 / 30;

export const MAX_FLING = 4000;

const clamp = (n: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, n));
};

/** Moves `from` towards `to` as if chasing it at `rate` per second. */
const ease = (from: number, to: number, rate: number, dt: number) => {
  'worklet';
  return from + (to - from) * (1 - Math.exp(-rate * dt));
};

/** The phone's gravity (Reanimated's GRAVITY sensor, m/s^2) in screen axes: x right, y down. */
export function screenGravity(g: { x: number; y: number; z: number }): { x: number; y: number } | null {
  'worklet';
  // Nothing has been read yet (or there's no sensor, as on the simulator).
  if (g.x * g.x + g.y * g.y + g.z * g.z < 1) return null;
  return { x: g.x, y: -g.y };
}

/**
 * One frame. `gravity` is screenGravity's reading, or null with no sensor.
 * Returns the new state and how hard the ball hit a wall on each axis this
 * frame (0 for no hit).
 */
export function stepRoll(s: Roll, gravity: { x: number; y: number } | null, bounds: Bounds, seconds: number): { roll: Roll; hitX: number; hitY: number } {
  'worklet';
  const dt = clamp(seconds, 0, MAX_DT);
  let { x, y, vx, vy, levelX, levelY, levelled } = s;
  let hitX = 0;
  let hitY = 0;

  // Tilt is measured from the angle the phone is held at, not from flat.
  let ax = 0;
  let ay = 0;
  if (gravity) {
    if (!levelled) {
      levelX = gravity.x;
      levelY = gravity.y;
      levelled = true;
    }
    ax = ((gravity.x - levelX) / 9.81) * TILT;
    ay = ((gravity.y - levelY) / 9.81) * TILT;
    levelX = ease(levelX, gravity.x, 1 / RELEVEL, dt);
    levelY = ease(levelY, gravity.y, 1 / RELEVEL, dt);
  }

  if (!s.held) {
    vx = (vx + (ax - BOWL * x) * dt) * Math.exp(-FRICTION * dt);
    vy = (vy + (ay - BOWL * y) * dt) * Math.exp(-FRICTION * dt);
    x += vx * dt;
    y += vy * dt;
    if (x < bounds.minX || x > bounds.maxX) {
      if ((x < bounds.minX && vx < 0) || (x > bounds.maxX && vx > 0)) {
        hitX = Math.abs(vx);
        vx = -vx * BOUNCE;
      }
      x = clamp(x, bounds.minX, bounds.maxX);
    }
    if (y < bounds.minY || y > bounds.maxY) {
      if ((y < bounds.minY && vy < 0) || (y > bounds.maxY && vy > 0)) {
        hitY = Math.abs(vy);
        vy = -vy * BOUNCE;
      }
      y = clamp(y, bounds.minY, bounds.maxY);
    }
  }

  // It rolls round as it goes sideways, and rights itself (a weighted ball) as it slows.
  let spin = s.spin + (vx * dt) / RADIUS;
  if (spin > Math.PI) spin -= 2 * Math.PI;
  if (spin < -Math.PI) spin += 2 * Math.PI;
  spin = ease(spin, 0, 1.5, dt);

  // The die trails the ball through the liquid on a soft tether.
  const speed = Math.hypot(vx, vy);
  const towardsX = clamp(-vx * 0.012, -DIE_REACH, DIE_REACH);
  const towardsY = clamp(-vy * 0.012, -DIE_REACH, DIE_REACH);
  const dieVX = s.dieVX + (DIE_SPRING * (towardsX - s.dieX) - DIE_DAMPING * s.dieVX) * dt;
  const dieVY = s.dieVY + (DIE_SPRING * (towardsY - s.dieY) - DIE_DAMPING * s.dieVY) * dt;
  const dieX = clamp(s.dieX + dieVX * dt, -DIE_REACH, DIE_REACH);
  const dieY = clamp(s.dieY + dieVY * dt, -DIE_REACH, DIE_REACH);
  const sunk = Math.min(1, speed / TUMBLE_SPEED);
  const depth = ease(s.depth, sunk, sunk > s.depth ? SINK : FLOAT, dt);

  return {
    roll: { x, y, vx, vy, spin, dieX, dieY, dieVX, dieVY, depth, levelX, levelY, levelled, held: s.held },
    hitX,
    hitY,
  };
}

/** True when nothing would visibly move next frame, so the frame loop can skip its writes. */
export function isStill(s: Roll, gravity: { x: number; y: number } | null): boolean {
  'worklet';
  const tilted = gravity && s.levelled ? Math.hypot(gravity.x - s.levelX, gravity.y - s.levelY) > 0.05 : false;
  return (
    !s.held &&
    !tilted &&
    Math.abs(s.x) + Math.abs(s.y) < 0.5 &&
    Math.abs(s.vx) + Math.abs(s.vy) < 1 &&
    Math.abs(s.spin) < 0.002 &&
    Math.abs(s.dieX) + Math.abs(s.dieY) + Math.abs(s.dieVX) + Math.abs(s.dieVY) < 0.1 &&
    s.depth < 0.005
  );
}
