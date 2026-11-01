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

/** A rectangle in the window. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Prod-motion-sheet step 2, on its 390 by 844 phone: a card 224 by 180 with corners of 34, tucked under the +. */
const GROW_MID = 0.55;
const GROW_MID_RADIUS = 34;

/**
 * The card that grows from a button into a sheet, at `g` from 0 (the button)
 * to 1 (the sheet): wide first, its top right corner staying at the button,
 * and then down to where the sheet sits, as the board draws it.
 */
export function growFrame(from: Box, to: Box, radius: number, windowWidth: number, windowHeight: number, g: number) {
  'worklet';
  const at = (start: number, mid: number, end: number) => {
    'worklet';
    return g < GROW_MID ? start + (mid - start) * (g / GROW_MID) : mid + (end - mid) * ((g - GROW_MID) / (1 - GROW_MID));
  };
  const midWidth = (windowWidth * 224) / 390;
  const midHeight = (windowHeight * 180) / 844;
  return {
    left: at(from.x, from.x + from.width - midWidth, to.x),
    top: at(from.y, from.y, to.y),
    width: at(from.width, midWidth, to.width),
    height: at(from.height, midHeight, to.height),
    borderRadius: at(from.width / 2, GROW_MID_RADIUS, radius),
  };
}
