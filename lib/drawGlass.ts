// Words and numbers for Draw my glass (components/screens/kit/draw): why the
// tracer stopped, and the one number that sizes the glass.

import type { TraceFail } from './glassTrace';

export type SizeBy = 'height' | 'capacity';

/** Why the tracer stopped, said plainly, with what to do about it. */
export const TRACE_FAIL: Record<TraceFail, { title: string; body: string }> = {
  edge: { title: 'We couldn’t find its edge', body: 'Something behind the glass is about as dark as the glass. Try it against a plain wall or a sheet of paper.' },
  several: { title: 'There’s more than one thing in the photo', body: 'Two glasses, or a glass and a bottle, stand side by side. Photograph the one glass on its own.' },
  cut: { title: 'Part of the glass is cut off', body: 'Its rim or its foot touches the edge of the photo. Step back so the whole glass fits, with a little space around it.' },
  small: { title: 'The glass is too small in the photo', body: 'Move closer, so the glass fills most of the frame from rim to foot.' },
  above: { title: 'It looks taken from above', body: 'Hold the phone level with the middle of the glass, so its rim looks like a thin oval.' },
};

export const NEVER_GUESSES = 'Other reasons it stops: two glasses in the photo, the glass cut off by the frame, or a photo taken from above. It never fills in a shape it can’t see.';

// What a glass can be: a shot glass to a big tiki bowl.
const LIMITS: Record<SizeBy, [number, number]> = { height: [20, 400], capacity: [10, 2500] };

/** The number typed, if it's one a glass could be. */
export function readSize(by: SizeBy, text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  const [lo, hi] = LIMITS[by];
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

/** "5.9 in." */
export const inches = (mm: number) => `${(mm / 25.4).toFixed(1)} in.`;

const QUARTERS = ['', '¼', '½', '¾'];

/** "6¾ oz", to the nearest quarter. */
export function ounces(ml: number): string {
  const q = Math.round((ml / 29.5735) * 4);
  const whole = Math.floor(q / 4);
  return `${whole || (q % 4 ? '' : '0')}${QUARTERS[q % 4]} oz`;
}

/** What it holds, worked out from a traced shape: "about 205 ml". */
export const aboutMl = (ml: number) => `about ${Math.round(ml / 5) * 5} ml`;

export const mmText = (mm: number) => `${Math.round(mm)} mm`;
