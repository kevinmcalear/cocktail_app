/**
 * A step timer that pauses. Running, it holds when it ends on the wall clock,
 * so it stays right while the app is in the background; paused, it holds the
 * seconds left. Pure, for components/prep/StepTimer.tsx and its check.
 */
export type Clock = { state: 'idle' } | { state: 'running'; endsAt: number } | { state: 'paused'; left: number };

export const IDLE: Clock = { state: 'idle' };

/** Seconds left at `now`: the whole time before it starts, never below zero. */
export function secondsLeft(c: Clock, total: number, now: number): number {
  if (c.state === 'idle') return total;
  if (c.state === 'paused') return c.left;
  return Math.max(0, Math.ceil((c.endsAt - now) / 1000));
}

/** Start, Pause and Resume are one button; a finished timer starts again from the top. */
export function toggleClock(c: Clock, total: number, now: number): Clock {
  if (c.state === 'running') {
    const left = secondsLeft(c, total, now);
    return left > 0 ? { state: 'paused', left } : { state: 'running', endsAt: now + total * 1000 };
  }
  const left = c.state === 'paused' ? c.left : total;
  return { state: 'running', endsAt: now + left * 1000 };
}
