/**
 * The die inside the eight ball, drawn like the real toy's (Kevin, 13 Oct
 * 2026: "make it look more like the real 8 ball face and behavior"): one
 * face of a twenty-sided die against the window, its neighbours tipping away
 * into the dark, the answer in small white capitals. Pure geometry and text
 * fitting for components/screens/eightball/DieFace.tsx. Checked by
 * lib/eightBallFace.check.ts.
 */

/** The die's drawing box (the window's size); the face's centre sits in its middle. */
export const DIE_BOX = 150;
/** The face's side. Its corners stay inside the round window. */
export const FACE_SIDE = 98;

type Point = [number, number];

const C = DIE_BOX / 2;
const INRADIUS = FACE_SIDE / (2 * Math.sqrt(3));
const HEIGHT = (FACE_SIDE * Math.sqrt(3)) / 2;

/** The face pointing down (wide edge on top), centred on its incentre. Pointing up is the same turned half round. */
export const FACE: Point[] = [
  [C - FACE_SIDE / 2, C - INRADIUS],
  [C + FACE_SIDE / 2, C - INRADIUS],
  [C, C - INRADIUS + HEIGHT],
];

/** How far a neighbouring face reaches, seen edge-on as it tips away from the window. */
const TIP = 0.5;

/** The three faces sharing an edge with the front one, foreshortened. */
export function neighbours(face: Point[] = FACE): Point[][] {
  return face.map((_, i) => {
    const a = face[i];
    const b = face[(i + 1) % 3];
    const opposite = face[(i + 2) % 3];
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // The opposite corner mirrored across the shared edge, pulled in.
    const far: Point = [mid[0] + (mid[0] - opposite[0]) * TIP, mid[1] + (mid[1] - opposite[1]) * TIP];
    return [a, b, far];
  });
}

/** The face grown or shrunk about its centre, for the glow behind it. */
export function scaled(points: Point[], by: number): Point[] {
  return points.map(([x, y]) => [C + (x - C) * by, C + (y - C) * by]);
}

export const toPath = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;

/**
 * The answer as the toy prints it: capitals, a few short lines. Long drink
 * names step down to the small size; past four lines the last one ends in an
 * ellipsis (the full name is in the title under the ball).
 */
export function faceLines(text: string): { lines: string[]; small: boolean } {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const pack = (width: number) => {
    const lines: string[] = [];
    for (const word of words) {
      const last = lines[lines.length - 1];
      if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    return lines;
  };
  const big = pack(9);
  if (big.length <= 3 && big.every((l) => l.length <= 9)) return { lines: big, small: false };
  const small = pack(12);
  if (small.length <= 4) return { lines: small, small: true };
  const kept = small.slice(0, 4);
  kept[3] = `${kept[3].slice(0, 11)}…`;
  return { lines: kept, small: true };
}

/** How the die comes to rest against the window this time: the real one is rarely square on. */
export interface Pose {
  /** Point up rather than down. */
  up: boolean;
  /** Degrees it settles at, and the turn it rises from. */
  tilt: number;
  turnIn: number;
  /** Points off centre. */
  dx: number;
  dy: number;
}

export const SQUARE: Pose = { up: false, tilt: 0, turnIn: 0, dx: 0, dy: 0 };

export function randomPose(rand: () => number = Math.random): Pose {
  const spread = (n: number) => (rand() * 2 - 1) * n;
  return { up: rand() < 0.5, tilt: spread(12), turnIn: spread(50), dx: spread(5), dy: spread(5) };
}
