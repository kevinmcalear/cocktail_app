import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { fontFamilies, palateHues, springs } from '@/constants/tokens';
import { LABEL, type Taste } from '@/lib/flavor';
import { FAMILY, labelSpot, outlinePath, palateLabel, petalPath, RINGS, springStep, VIEW, WHEEL } from '@/lib/palate';

import { useDs } from './theme';

interface PalateFlowerProps {
  /** The taste the petals draw. */
  values: Taste;
  /** What you said, as a dashed outline. */
  said?: Taste | null;
  /** A drink, as a solid outline over the petals. */
  compare?: Taste | null;
  /** Width in points. Labelled flowers are shorter than wide. */
  size: number;
  /** Each taste's name around the flower: the big flower only. */
  labels?: boolean;
  /** The level rings behind it. Off for small flowers. */
  rings?: boolean;
  /** Faint petals, so a compared drink's outline leads. */
  ghost?: boolean;
  /** What the flower sits on, for the gaps between petals. Defaults to the ground. */
  on?: string;
}

// Label size in the flower's own units: 13 points when the labelled flower is 354 wide.
const LABEL_SIZE = 11.6;

/**
 * The palate: twelve petals, one per taste, in four families. Filled is a
 * palate, dashed is what someone said, an outline is a drink. The design and
 * its rules: lib/palate.ts. It's a picture; the screen around it says the
 * same in words, and the accessibility label reads it out.
 */
export function PalateFlower({ values, said, compare, size, labels = false, rings = true, ghost = false, on }: PalateFlowerProps) {
  const ds = useDs();
  const shown = useSettled(values);
  const hues = palateHues[ds.scheme];
  const gap = on ?? ds.c.ground;
  const view = labels ? VIEW.labelled : VIEW.plain;
  const height = Math.round(size * view.ratio);
  const thin = size < 64;
  return (
    <Svg width={size} height={height} viewBox={view.box} role="img" aria-label={palateLabel(values)}>
      {rings ? RINGS.map((r, i) => <Circle key={r} cx={100} cy={100} r={r} fill="none" stroke={ds.c.line} strokeWidth={0.8} strokeDasharray={i === RINGS.length - 1 ? '2 3' : undefined} />) : null}
      {WHEEL.map((d, i) =>
        typeof shown[d] === 'number' ? (
          <Path key={d} d={petalPath(i, shown[d]!)} fill={hues[FAMILY[d]]} opacity={ghost ? 0.3 : 0.94} stroke={gap} strokeWidth={thin ? 2.4 : 1.4} />
        ) : null
      )}
      {said ? <Path d={outlinePath(said)} fill="none" stroke={ds.c.ink} strokeWidth={1.3} strokeDasharray="3 3" opacity={0.75} /> : null}
      {compare ? <Path d={outlinePath(compare)} fill="none" stroke={ds.c.ink} strokeWidth={1.8} strokeLinejoin="round" /> : null}
      <Circle cx={100} cy={100} r={thin ? 2.2 : 3.2} fill={gap} />
      {labels
        ? WHEEL.map((d, i) => {
            const spot = labelSpot(i);
            return (
              <SvgText key={d} x={spot.x} y={spot.y} fill={ds.c.muted} fontSize={LABEL_SIZE} fontFamily={fontFamilies.body} textAnchor={spot.anchor}>
                {LABEL[d]}
              </SvgText>
            );
          })
        : null}
    </Svg>
  );
}

/**
 * The petals' drawn values: the same as `values` on first draw (so lists
 * don't animate), then each petal springs to its new length on the glide
 * spring when a value changes. A new taste grows from the centre; a removed
 * one shrinks away. Reduced motion: changes at once.
 */
function useSettled(values: Taste): Taste {
  const reduce = useReducedMotion();
  const target = JSON.stringify(values);
  const [shown, setShown] = useState<Taste>(values);
  const motion = useRef<{ x: Taste; v: Taste }>({ x: values, v: {} });
  useEffect(() => {
    const goal = JSON.parse(target) as Taste;
    // Already there (a first draw, or reduced motion, which draws `values` as is).
    if (reduce || WHEEL.every((d) => motion.current.x[d] === goal[d])) {
      motion.current = { x: goal, v: {} };
      return;
    }
    let frame = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      const { x, v } = motion.current;
      const nx: Taste = {};
      const nv: Taste = {};
      let moving = false;
      for (const d of WHEEL) {
        if (typeof goal[d] !== 'number' && typeof x[d] !== 'number') continue;
        const next = springStep(x[d] ?? 0, v[d] ?? 0, goal[d] ?? 0, springs.glide, dt);
        // A taste that's gone disappears once it has shrunk to nothing.
        if (next.resting && typeof goal[d] !== 'number') continue;
        nx[d] = next.x;
        nv[d] = next.v;
        moving ||= !next.resting;
      }
      motion.current = { x: nx, v: nv };
      setShown(nx);
      if (moving) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce]);
  return reduce ? values : shown;
}
