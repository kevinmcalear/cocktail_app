import { memo, useEffect, useId, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, G, Rect } from 'react-native-svg';

import { GLASS_BANDS, type Scene, type SceneEl } from '@/lib/sketch/scene';
import type { SketchInputs } from '@/lib/sketch/types';

import { defsFor, draw, sceneFor, type SketchDetail } from './SketchDrawing';
import { useDs } from './theme';

const AnimatedG = Animated.createAnimatedComponent(G);

type Stage = Extract<SceneEl, { k: 'stage' }>;
type Move = 'fade' | 'draw' | 'pour' | 'rise' | 'drop' | 'land' | 'fizz';
interface Beat {
  at: number;
  dur: number;
  move: Move;
}

/** When each part comes in (ms from the start) and how it moves. */
const BEATS: Record<Stage['name'], Beat> = {
  search: { at: 0, dur: 900, move: 'draw' },
  glass: { at: 450, dur: 1200, move: 'draw' },
  liquid: { at: 1350, dur: 900, move: 'pour' },
  ice: { at: 2000, dur: 700, move: 'drop' },
  foam: { at: 2250, dur: 600, move: 'rise' },
  fizz: { at: 2450, dur: 400, move: 'fizz' },
  garnish: { at: 2700, dur: 650, move: 'land' },
  finish: { at: 2850, dur: 450, move: 'fade' },
};
const TOTAL = 3400;
/** Each band of the glass's pencil fades in over this share of the glass's time; they start one after another, rim first. */
const BAND_SHARE = 0.25;
const BUBBLE_MS = 1500;
const BUBBLE_LOOPS = 3;

type Matrix = [number, number, number, number, number, number];
interface StageProps {
  opacity: number;
  matrix?: Matrix;
  transform?: Matrix;
}
// Native SVG groups take a 6-number matrix; react-native-svg on web reads it from transform.
const ON_WEB = Platform.OS === 'web';

const easePour = Easing.inOut(Easing.cubic);
/** Eases out past 1 and settles back (Easing.out(Easing.back(s))), written out: Reanimated's test mock has no Easing.back. */
function backOut(t: number, s: number) {
  'worklet';
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

interface LayerProps {
  beat: Beat;
  ox: number;
  oy: number;
  size: number;
  t: SharedValue<number>;
  bubble: SharedValue<number>;
  children: ReactNode;
}

function Layer({ beat, ox, oy, size, t, bubble, children }: LayerProps) {
  const { at, dur, move } = beat;
  const props = useAnimatedProps((): StageProps => {
    const p = Math.min(1, Math.max(0, (t.get() * TOTAL - at) / dur));
    const shown = (k: number) => Math.min(1, p * k);
    // Scale (sx, sy) about the stage's anchor, then move down by dy.
    const at2 = (sx: number, sy: number, dy: number) => {
      const m: Matrix = [sx, 0, 0, sy, ox * (1 - sx), oy * (1 - sy) + dy];
      return ON_WEB ? { transform: m } : { matrix: m };
    };
    switch (move) {
      case 'fade':
        return { opacity: p };
      case 'draw':
        // Pencil lines carry their own broken dash, so a band is drawn by appearing, not by a dash sweep.
        return { opacity: p };
      case 'pour':
        return { opacity: shown(6), ...at2(1, Math.max(0.001, easePour(p)), 0) };
      case 'rise':
        return { opacity: shown(4), ...at2(1, Math.max(0.001, backOut(p, 2.2)), 0) };
      case 'drop':
        return { opacity: shown(6), ...at2(1, 1, -size * 0.45 * (1 - Easing.bounce(p))) };
      case 'land': {
        const e = backOut(p, 1.8);
        return { opacity: shown(3), ...at2(0.6 + 0.4 * e, 0.6 + 0.4 * e, -size * 0.12 * (1 - e)) };
      }
      case 'fizz': {
        // Bubbles rise and fade, then start again from the bottom; at rest (b = 0) they sit where drawn.
        const b = bubble.get();
        const fade = b <= 0 ? 1 : b < 0.15 ? b / 0.15 : b > 0.8 ? (1 - b) / 0.2 : 1;
        return { opacity: p * fade, ...at2(1, 1, -size * 0.05 * b) };
      }
    }
  });
  return (
    <AnimatedG animatedProps={props}>{children}</AnimatedG>
  );
}

function StageLayer({ el, u, ...rest }: Omit<LayerProps, 'beat' | 'ox' | 'oy' | 'children'> & { el: Stage; u: string }) {
  const beat = BEATS[el.name];
  const banded = el.children.some((c) => c.k === 'stroke' && c.band !== undefined);
  if (beat.move !== 'draw' || !banded) {
    return <Layer beat={beat} ox={el.ox} oy={el.oy} {...rest}>{el.children.map((c, j) => draw(c, j, u))}</Layer>;
  }
  // The pencil goes round the glass from the rim down: each band of strokes
  // starts a little after the one above. Shading and clipped hatching fade in
  // underneath; pencil over pencil looks the same in any order.
  const all: SceneEl[][] = Array.from({ length: GLASS_BANDS }, () => []);
  const under: SceneEl[] = [];
  for (const c of el.children) (c.k === 'stroke' && c.band !== undefined ? all[c.band] : under).push(c);
  // Only bands the glass reaches: a short glass doesn't wait on the empty top of the page.
  const bands = all.filter((b) => b.length);
  const step = bands.length > 1 ? (beat.dur * (1 - BAND_SHARE)) / (bands.length - 1) : 0;
  return (
    <>
      <Layer beat={{ at: beat.at, dur: beat.dur, move: 'fade' }} ox={el.ox} oy={el.oy} {...rest}>{under.map((c, j) => draw(c, j, u))}</Layer>
      {bands.map((els, i) => (
        <Layer key={i} beat={{ at: beat.at + i * step, dur: beat.dur * BAND_SHARE, move: 'draw' }} ox={el.ox} oy={el.oy} {...rest}>
          {els.map((c, j) => draw(c, j, u))}
        </Layer>
      ))}
    </>
  );
}

const AnimatedScene = memo(function AnimatedScene({ scene, play }: { scene: Scene; play: number }) {
  const ds = useDs();
  const u = useId().replace(/[^A-Za-z0-9]/g, '');
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  const bubble = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      t.set(1);
      bubble.set(0);
      return;
    }
    t.set(0);
    t.set(withTiming(1, { duration: TOTAL, easing: Easing.linear }));
    bubble.set(0);
    bubble.set(withSequence(
      withTiming(0, { duration: BEATS.fizz.at + BEATS.fizz.dur }),
      withRepeat(withTiming(1, { duration: BUBBLE_MS, easing: Easing.out(Easing.quad) }), BUBBLE_LOOPS, false),
      withTiming(0, { duration: 0 }),
    ));
  }, [scene, play, reduceMotion, t, bubble]);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${scene.size} ${scene.size}`} preserveAspectRatio="xMidYMid meet" style={{ backgroundColor: ds.c.paper }} aria-hidden>
      <Rect x={0} y={0} width={scene.size} height={scene.size} fill={ds.c.paper} />
      <Defs>{defsFor(scene.els, u, [])}</Defs>
      {scene.els.map((el, i) => (el.k === 'stage' ? <StageLayer key={i} el={el} size={scene.size} t={t} bubble={bubble} u={u} /> : draw(el, i, u)))}
    </Svg>
  );
});

export interface AnimatedSketchProps {
  inputs: SketchInputs;
  /** What makes it this drink's drawing: its id. */
  seed: string;
  detail?: SketchDetail;
  /** Change it to draw again from a blank page (a tap on the drawing, a new step). */
  play?: number;
}

/**
 * A drink's drawing, made in front of you: the pencil finds the glass, the
 * drink pours in, ice drops, foam rises, the garnish lands and bubbles climb.
 * Ends on exactly the still drawing (SketchDrawing). Reduced motion shows it
 * finished. One at a time: a list of these would cost too much.
 */
export const AnimatedSketch = memo(function AnimatedSketch({ inputs, seed, detail = 'full', play = 0 }: AnimatedSketchProps) {
  return <AnimatedScene scene={sceneFor(inputs, seed, detail, true)} play={play} />;
});
