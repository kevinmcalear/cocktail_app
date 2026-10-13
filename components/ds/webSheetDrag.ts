import { dragCloses, leaveDuration } from './sheetDrag';
import { EASE_IN, EASE_OUT } from './webMotion';

/** Back into place after a drag that didn't close it. */
const SETTLE_MS = 200;
/** A finger has to move this far down before it counts as a drag, not a tap. */
const SLOP = 6;
/** The finger's speed at let-go is measured over this last stretch (ms). */
const SPEED_MS = 80;

/**
 * The web's sheet drag, without Reanimated or Gesture Handler: a finger pulls
 * the dialog down from anywhere on it, and letting go far or fast enough
 * closes it (dragCloses, the same rule as native). A list inside scrolls first;
 * once it's at the top, pulling further drags the sheet, as on native. Touch
 * only: a mouse selects text and works the controls as usual.
 *
 * Attach it as the panel's ref (it returns its own cleanup). It moves the
 * panel's parent, the full-window box that places it, because react-native-web
 * owns the panel's own transition (its fade). `close(ms)` takes over once the
 * sheet is on its way out.
 */
export function attachSheetDrag(panel: HTMLElement, close: (leaveMs: number) => void, reduceMotion: () => boolean): () => void {
  let y0 = 0;
  let x0 = 0;
  // Where the drag counted from (null: not dragging), and the recent samples for its speed.
  let anchor: number | null = null;
  let scroller: HTMLElement | null = null;
  let samples: { y: number; t: number }[] = [];
  const mover = panel.parentElement ?? panel;

  const move = (d: number, ms = 0, ease = EASE_OUT) => {
    mover.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
    mover.style.transform = d ? `translateY(${d}px)` : '';
  };
  // The nearest list between the finger and the panel that can scroll.
  const scrollerOf = (target: EventTarget | null) => {
    for (let el = target as HTMLElement | null; el && el !== panel; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
    }
    return null;
  };

  const start = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    y0 = t.clientY;
    x0 = t.clientX;
    anchor = null;
    scroller = scrollerOf(e.target);
    samples = [{ y: t.clientY, t: performance.now() }];
  };
  const drag = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const now = performance.now();
    samples = [...samples.filter((s) => now - s.t < SPEED_MS), { y: t.clientY, t: now }];
    if (anchor === null) {
      const down = t.clientY - y0;
      // Down, more than sideways, with nothing above left to scroll: it's ours.
      if (down <= 0 || down < Math.abs(t.clientX - x0) || (scroller && scroller.scrollTop > 0)) return;
      // Claimed from the first move: the browser decides then whether a touch scrolls.
      if (e.cancelable) e.preventDefault();
      if (down > SLOP) anchor = t.clientY;
      return;
    }
    if (e.cancelable) e.preventDefault();
    move(Math.max(0, t.clientY - anchor));
  };
  const end = () => {
    if (anchor === null) return;
    const [first, last] = [samples[0], samples[samples.length - 1]];
    const d = Math.max(0, last.y - anchor);
    // Points a second over the last moment, as native's velocityY.
    const velocity = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0;
    anchor = null;
    const height = panel.getBoundingClientRect().height;
    if (dragCloses(d, velocity, height)) {
      const ms = reduceMotion() ? 0 : leaveDuration(window.innerHeight - d, velocity);
      move(window.innerHeight, ms, EASE_IN);
      close(ms);
    } else move(0, reduceMotion() ? 0 : SETTLE_MS);
  };

  panel.addEventListener('touchstart', start, { passive: true });
  panel.addEventListener('touchmove', drag, { passive: false });
  panel.addEventListener('touchend', end);
  panel.addEventListener('touchcancel', end);
  return () => {
    panel.removeEventListener('touchstart', start);
    panel.removeEventListener('touchmove', drag);
    panel.removeEventListener('touchend', end);
    panel.removeEventListener('touchcancel', end);
  };
}
