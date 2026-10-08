/**
 * The flavor map's layout: what you've picked sits in the middle, and what
 * pairs with all of it sits on three rings, closest first. A force graph of
 * 1,600 nodes reads on a laptop and not on a phone; rings read on both, and
 * tapping a partner "bounces" to what goes with everything picked.
 */

export interface MapPair {
  id: string;
  name: string;
  score: number;
  together: number[];
}

export interface Ring {
  label: string;
  /** Distance from the middle, as a share of the map's half-width. */
  r: number;
  size: number;
}

export const RINGS: readonly Ring[] = [
  { label: 'Closest', r: 0.32, size: 4 },
  { label: 'Strong', r: 0.54, size: 6 },
  { label: 'Worth a try', r: 0.76, size: 8 },
];

export const MAP_SIZE = RINGS.reduce((n, r) => n + r.size, 0);

export interface PlacedPair extends MapPair {
  ring: number;
  /** Position in a unit square, centre (0.5, 0.5). */
  x: number;
  y: number;
  /** Dot radius as a share of the map's width, larger for stronger pairs. */
  dot: number;
  /** Angle from the middle, radians. */
  angle: number;
}

/** Pairs, best first, onto the rings. Each ring starts at a different angle so labels don't line up. */
export function placePairs(pairs: readonly MapPair[]): PlacedPair[] {
  const out: PlacedPair[] = [];
  const best = pairs[0]?.score || 1;
  let i = 0;
  RINGS.forEach((ring, ri) => {
    const items = pairs.slice(i, i + ring.size);
    i += ring.size;
    const start = -Math.PI / 2 + ri * 0.37;
    items.forEach((p, j) => {
      const a = start + (j / items.length) * Math.PI * 2;
      const y = 0.5 + (ring.r / 2) * Math.sin(a);
      out.push({
        ...p,
        ring: ri,
        x: 0.5 + (ring.r / 2) * Math.cos(a),
        y,
        dot: 0.012 + 0.018 * Math.sqrt(Math.max(p.score, 0) / best),
        angle: a,
      });
    });
  });
  return out;
}

export interface LabelPos {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * Where a dot's label goes, in points on a map `width` wide: outward from the
 * middle (to the right of dots on the right, left of dots on the left, above
 * or below at the top and bottom), kept on the map. Labels spread out instead
 * of stacking.
 */
export function labelPos(p: Pick<PlacedPair, 'x' | 'y' | 'dot' | 'angle'>, name: string, width: number, fontSize: number, charWidth = 7.4): LabelPos {
  return labelSpots(p, name, width, fontSize, charWidth)[0];
}

/** Every spot a label could take, best first: beside the dot (away from the middle), above, below. */
function labelSpots(p: Pick<PlacedPair, 'x' | 'y' | 'dot' | 'angle'>, name: string, width: number, fontSize: number, charWidth = 7.4): LabelPos[] {
  const r = p.dot * width;
  const est = name.length * charWidth;
  const cx = p.x * width;
  const cy = p.y * width;
  const cos = Math.cos(p.angle);
  const half = est / 2 + 4;
  const mid = Math.min(Math.max(cx, half), width - half);
  const above: LabelPos = { x: mid, y: cy - r - 6, anchor: 'middle' };
  const below: LabelPos = { x: mid, y: cy + r + fontSize + 2, anchor: 'middle' };
  const side: LabelPos[] =
    cos > 0.4
      ? [{ x: cx + r + 5, y: cy + fontSize / 3, anchor: 'start' }]
      : cos < -0.4
        ? [{ x: cx - r - 5, y: cy + fontSize / 3, anchor: 'end' }]
        : [];
  return Math.sin(p.angle) > 0 ? [...side, below, above] : [...side, above, below];
}

export interface PlacedLabel extends LabelPos {
  id: string;
  /** The name, shortened with an ellipsis when only that fits. */
  text: string;
  /** No room without covering another: the dot stays, the name is in the list under the map. */
  hidden: boolean;
}

/**
 * Every label's spot, best pair first: a label that would cover one already
 * placed moves a line up or down, and if neither is free it's hidden.
 */
export function layoutLabels(placed: readonly PlacedPair[], width: number, fontSize: number, charWidth = 7.4, centreR = 0): PlacedLabel[] {
  // The middle and the dots are in the way too. A ring's labels only dodge
  // the dots of its own ring and those inside it: inner names matter most,
  // and they're drawn with a halo, so an outer dot under one stays readable.
  const c = width / 2;
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [{ x0: c - centreR, x1: c + centreR, y0: c - centreR, y1: c + centreR }];
  const dotBox = (p: PlacedPair) => {
    const r = p.dot * width + 2;
    return { x0: p.x * width - r, x1: p.x * width + r, y0: p.y * width - r, y1: p.y * width + r };
  };
  let dotsUpTo = -1;
  const boxOf = (l: LabelPos, len: number) => {
    const w = len * charWidth;
    const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
    return { x0: x0 - 2, x1: x0 + w + 2, y0: l.y - fontSize, y1: l.y + 3 };
  };
  const clash = (b: (typeof boxes)[number]) => boxes.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
  const fits = (b: (typeof boxes)[number]) => b.x0 >= 0 && b.x1 <= width && b.y0 >= 0 && b.y1 <= width;
  const step = fontSize + 3;
  return placed.map((p) => {
    for (; dotsUpTo < p.ring; dotsUpTo++) for (const d of placed) if (d.ring === dotsUpTo + 1) boxes.push(dotBox(d));
    const spots = labelSpots(p, p.name, width, fontSize, charWidth).flatMap((at) => [0, -step, step].map((dy) => ({ ...at, y: at.y + dy })));
    for (const at of spots) {
      const box = boxOf(at, p.name.length);
      if (fits(box) && !clash(box)) {
        boxes.push(box);
        return { ...at, id: p.id, text: p.name, hidden: false };
      }
    }
    // Last try: beside the dot, shortened to the room there (the list under the map has the full name).
    const side = spots.find((at) => at.anchor !== 'middle');
    if (side) {
      const room = side.anchor === 'start' ? width - side.x - 4 : side.x - 4;
      const chars = Math.floor(room / charWidth) - 1;
      if (chars >= 6 && chars < p.name.length) {
        const text = `${p.name.slice(0, chars).trimEnd()}…`;
        const box = boxOf(side, text.length);
        if (fits(box) && !clash(box)) {
          boxes.push(box);
          return { ...side, id: p.id, text, hidden: false };
        }
      }
    }
    return { ...spots[0], id: p.id, text: p.name, hidden: true };
  });
}

/** How many partners fit: fewer on a phone, where the outer ring gets crowded. */
export const mapSizeFor = (width: number) => (width < 480 ? 14 : MAP_SIZE);

/** The pairs as the rings hold them, for the list under the map. */
export function groupByRing<T>(pairs: readonly T[]): { ring: Ring; items: T[] }[] {
  return RINGS.map((ring, i) => {
    const from = RINGS.slice(0, i).reduce((n, r) => n + r.size, 0);
    return { ring, items: pairs.slice(from, from + ring.size) };
  }).filter((g) => g.items.length > 0);
}

/** Picking a fourth keeps the last three: the map stays readable. */
export function addPick(picked: readonly string[], id: string, max = 3): string[] {
  if (picked.includes(id)) return [...picked];
  return [...picked, id].slice(-max);
}
