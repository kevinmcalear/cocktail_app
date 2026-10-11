// The sheet's drag, as numbers: when a let-go closes it, how it leaves at the
// finger's speed, and how it gives when pulled up past the top. Worklets, so
// the drag runs on the UI thread. Checked by sheetDrag.check.ts.

/** A drag down past this share of the sheet closes it, unless it's flicked back up. */
export const DISMISS_SHARE = 0.25;
/** A flick down this fast (points a second) closes it from any distance. */
export const FLICK = 900;
/** Flicking back up this fast keeps it open, however far it was pulled. */
const FLICK_BACK = 300;
/** Pulled up past the top, it gives at most this far (and the panel reaches this far below the screen, so no gap shows). */
export const STRETCH = 36;
/** Leaving after a drag: never quicker or slower than this (ms). */
const LEAVE_MIN = 140;
const LEAVE_MAX = 300;

/** Whether letting go `drag` points down, moving at `velocity`, closes a sheet `height` tall. */
export function dragCloses(drag: number, velocity: number, height: number): boolean {
  'worklet';
  if (drag <= 0) return false;
  if (velocity > FLICK) return true;
  return drag > height * DISMISS_SHARE && velocity > -FLICK_BACK;
}

/**
 * How long the rest of the way off screen takes so it leaves at the finger's
 * speed: an ease-out cubic starts at three times its average speed.
 */
export function leaveDuration(remaining: number, velocity: number): number {
  'worklet';
  if (velocity <= 0) return LEAVE_MAX;
  return Math.min(LEAVE_MAX, Math.max(LEAVE_MIN, ((3 * remaining) / velocity) * 1000));
}

/**
 * iOS's rubber band: the further it's pulled, the less it gives, never past
 * `limit`. No default for `limit`: a worklet doesn't capture a constant used
 * only in a default parameter, and it throws on the UI thread.
 */
export function rubberBand(distance: number, limit: number): number {
  'worklet';
  return limit * (1 - 1 / ((distance * 0.55) / limit + 1));
}

/** The backdrop's share of its full opacity while the sheet is pulled `drag` down: it lightens as the sheet goes. */
export function dragShade(drag: number, height: number): number {
  'worklet';
  if (height <= 0) return 1;
  return 1 - Math.min(1, Math.max(0, drag / height));
}
