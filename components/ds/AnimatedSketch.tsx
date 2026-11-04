import { memo, useEffect, useId, useState, type ComponentProps } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs } from 'react-native-svg';

import { boundsOf, GLASS_BANDS, type Scene, type SceneEl } from '@/lib/sketch/scene';
import { inBarGlassCached } from '@/lib/sketch/barGlass';
import { GLOW_STAGES } from '@/lib/sketch/passes';
import type { SketchInputs } from '@/lib/sketch/types';

import { useDrawingGlasses } from './drawingGlasses';
import { Glow, glowUris, type GlowTimes, type GlowUris } from './SketchGlow';
import { pencilScene } from './PencilState';
import { defsFor, draw, nightOf, SceneSvg, sceneFor, type SketchDetail } from './SketchDrawing';
import { useDs } from './theme';

type Stage = Extract<SceneEl, { k: 'stage' }>;
type Move = 'fade' | 'draw' | 'spread' | 'rise' | 'drop' | 'land' | 'fizz';
interface Beat {
  at: number;
  dur: number;
  move: Move;
}

/** When each part comes in (ms from the start) and how it moves. */
const BEATS: Record<Stage['name'], Beat> = {
  search: { at: 0, dur: 900, move: 'draw' },
  glass: { at: 450, dur: 1200, move: 'draw' },
  liquid: { at: 1350, dur: 900, move: 'spread' },
  ice: { at: 2000, dur: 700, move: 'drop' },
  foam: { at: 2250, dur: 600, move: 'rise' },
  fizz: { at: 2450, dur: 400, move: 'fizz' },
  garnish: { at: 2700, dur: 650, move: 'land' },
  finish: { at: 2850, dur: 450, move: 'fade' },
};
const TOTAL = 3400;
// A part's glow comes up as the part does: the drink over its spread, the garnish in the first third of its landing (as the garnish itself).
const GLOW_TIMES = Object.fromEntries(GLOW_STAGES.map((s) => {
  const { at, dur, move } = BEATS[s];
  return [s, { from: at / TOTAL, to: (at + (move === 'land' ? dur / 3 : dur)) / TOTAL }];
})) as GlowTimes;
/** Each band of the glass's pencil fades in over this share of the glass's time; they start one after another, rim first. */
const BAND_SHARE = 0.25;
const BUBBLE_MS = 1500;
const BUBBLE_LOOPS = 3;

// Each part is its own native layer, painted once; the clock only moves and
// fades the layers. Animating the SVG's own groups made iOS repaint the whole
// drawing (hundreds of pencil paths) on the main thread every frame, which
// stalled scrolling for the length of the animation.

function cubicOut(t: number) {
  'worklet';
  return 1 - (1 - t) * (1 - t) * (1 - t);
}
/** Eases out past 1 and settles back (Easing.out(Easing.back(s))), written out: Reanimated's test mock has no Easing.back. */
function backOut(t: number, s: number) {
  'worklet';
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

/** Scene units to points in the frame: the drawing sits in a centred square (preserveAspectRatio meet). */
interface Place {
  k: number;
  x: number;
  y: number;
}

interface LayerProps {
  beat: Beat;
  ox: number;
  oy: number;
  size: number;
  t: SharedValue<number>;
  bubble: SharedValue<number>;
  place: Place;
  u: string;
  els: SceneEl[];
  /** Its stage's name (`stage-glass`): which part a frame check is looking at. */
  testID?: string;
}

/** Part of the drawing, in a view no bigger than what it covers (each view is a bitmap). */
function Piece({ els, u, place, size, style, testID }: { els: SceneEl[]; u: string; place: Place; size: number; style?: ComponentProps<typeof Animated.View>['style']; testID?: string }) {
  const [x0, y0, x1, y1] = boundsOf(els) ?? [0, 0, size, size];
  // Edges on whole device pixels, and the view box read back from them: the
  // strokes land on exactly the pixels the still drawing puts them on.
  const px = PixelRatio.get();
  const edge = (v: number, out: (n: number) => number) => out(v * px) / px;
  const [l, t, r, b] = [edge(place.x + x0 * place.k, Math.floor), edge(place.y + y0 * place.k, Math.floor), edge(place.x + x1 * place.k, Math.ceil), edge(place.y + y1 * place.k, Math.ceil)];
  const [vx, vy] = [(l - place.x) / place.k, (t - place.y) / place.k];
  return (
    <Animated.View testID={testID} style={[{ position: 'absolute', left: l, top: t, width: r - l, height: b - t }, style]}>
      <Svg width="100%" height="100%" viewBox={`${vx} ${vy} ${(r - l) / place.k} ${(b - t) / place.k}`}>
        <Defs>{defsFor(els, u, [])}</Defs>
        {els.map((c, j) => draw(c, j, u))}
      </Svg>
    </Animated.View>
  );
}

function Layer({ beat, ox, oy, size, t, bubble, place, u, els, testID }: LayerProps) {
  const { at, dur, move } = beat;
  const [x0, y0, x1, y1] = boundsOf(els) ?? [0, 0, size, size];
  // The stage's anchor from the view's centre (where views scale about), in points.
  const ax = (ox - (x0 + x1) / 2) * place.k;
  const ay = (oy - (y0 + y1) / 2) * place.k;
  const { k } = place;
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (t.get() * TOTAL - at) / dur));
    const shown = (n: number) => Math.min(1, p * n);
    // Scale (sx, sy) about the anchor, then move down by dy (scene units).
    const at2 = (sx: number, sy: number, dy: number) => ({
      transform: [{ translateX: ax }, { translateY: ay + dy * k }, { scaleX: sx }, { scaleY: sy }, { translateX: -ax }, { translateY: -ay }],
    });
    switch (move) {
      case 'fade':
      case 'draw':
        // Pencil lines carry their own broken dash, so a band is drawn by appearing, not by a dash sweep.
        return { opacity: p };
      case 'spread': {
        // Out from the middle of the drink to the glass's walls, like a wash taking.
        const e = Math.max(0.001, cubicOut(p));
        return { opacity: shown(4), ...at2(e, e, 0) };
      }
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
  return <Piece els={els} u={u} place={place} size={size} style={style} testID={testID} />;
}

type StageLayerProps = Omit<LayerProps, 'beat' | 'ox' | 'oy' | 'els' | 'testID'> & { el: Stage };

function StageLayer({ el, ...rest }: StageLayerProps) {
  const beat = BEATS[el.name];
  const testID = `stage-${el.name}`;
  const banded = el.children.some((c) => c.k === 'stroke' && c.band !== undefined);
  if (!el.children.length) return null;
  if (beat.move !== 'draw' || !banded) return <Layer beat={beat} ox={el.ox} oy={el.oy} els={el.children} testID={testID} {...rest} />;
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
      {under.length ? <Layer beat={{ at: beat.at, dur: beat.dur, move: 'fade' }} ox={el.ox} oy={el.oy} els={under} testID={testID} {...rest} /> : null}
      {bands.map((els, i) => (
        <Layer key={i} beat={{ at: beat.at + i * step, dur: beat.dur * BAND_SHARE, move: 'draw' }} ox={el.ox} oy={el.oy} els={els} testID={testID} {...rest} />
      ))}
    </>
  );
}

/** How long a scene moves for, from the pencil's start: bubbles keep climbing after the drawing is done. */
function lengthOf(scene: Scene) {
  const fizzy = scene.els.some((el) => el.k === 'stage' && el.name === 'fizz');
  return fizzy ? Math.max(TOTAL, BEATS.fizz.at + BEATS.fizz.dur + BUBBLE_MS * BUBBLE_LOOPS) : TOTAL;
}

// One object per drawing's content, so a caller that builds its inputs afresh each render (beer and wine's
// savedSketch, the draft) keeps one scene, and the drawing doesn't start over on every render. Holds the
// last few used: a hit moves to the back, so the drawing on screen is never the one that goes.
const canon = new Map<string, SketchInputs>();
function sameInputs(inputs: SketchInputs): SketchInputs {
  const key = JSON.stringify(inputs);
  const had = canon.get(key);
  if (had) {
    canon.delete(key);
    canon.set(key, had);
    return had;
  }
  canon.set(key, inputs);
  if (canon.size > 32) canon.delete(canon.keys().next().value!);
  return inputs;
}

/** How long the still drawing sits under the finished layers before they go: time for its picture to decode. */
const HANDOVER_MS = 400;

const AnimatedScene = memo(function AnimatedScene({ scene, play, delay, glow }: { scene: Scene; play: number; delay: number; glow: GlowUris | null }) {
  const u = useId().replace(/[^A-Za-z0-9]/g, '');
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  const bubble = useSharedValue(0);
  // The layers are placed in points, so they wait for the frame's size: blank paper is the first frame anyway.
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  // Once it has played: the still drawing (one picture on iOS and Android) comes in under the layers, then the
  // layers go, so a page at rest holds one image, not dozens of moving SVG views. Also the way out if a layout never comes.
  const [settled, setSettled] = useState<{ scene: Scene; play: number; gone: boolean } | null>(null);
  useEffect(() => {
    if (reduceMotion) return;
    t.set(0);
    t.set(withDelay(delay, withTiming(1, { duration: TOTAL, easing: Easing.linear })));
    bubble.set(0);
    bubble.set(withSequence(
      withTiming(0, { duration: delay + BEATS.fizz.at + BEATS.fizz.dur }),
      withRepeat(withTiming(1, { duration: BUBBLE_MS, easing: Easing.out(Easing.quad) }), BUBBLE_LOOPS, false),
      withTiming(0, { duration: 0 }),
    ));
    const end = delay + lengthOf(scene) + 100;
    const still = setTimeout(() => setSettled({ scene, play, gone: false }), end);
    const gone = setTimeout(() => setSettled({ scene, play, gone: true }), end + HANDOVER_MS);
    return () => {
      clearTimeout(still);
      clearTimeout(gone);
    };
  }, [scene, play, delay, reduceMotion, t, bubble]);
  const side = frame ? Math.min(frame.w, frame.h) : 0;
  const place: Place | null = frame && side ? { k: side / scene.size, x: (frame.w - side) / 2, y: (frame.h - side) / 2 } : null;
  const done = settled?.scene === scene && settled.play === play ? settled : null;
  const still = reduceMotion || !!done;
  const layers = reduceMotion || done?.gone ? null : place;
  const flat = scene.els.filter((el) => el.k !== 'stage');
  return (
    <View style={styles.fill} onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} aria-hidden>
      {glow && (still || place) ? <Glow glow={glow} side={side} t={still ? undefined : t} times={GLOW_TIMES} /> : null}
      {still ? <SceneSvg scene={scene} bare /> : null}
      {layers && flat.length ? <Piece els={flat} u={u} place={layers} size={scene.size} /> : null}
      {layers ? scene.els.map((el, i) => (el.k === 'stage' ? <StageLayer key={i} el={el} size={scene.size} t={t} bubble={bubble} place={layers} u={u} /> : null)) : null}
    </View>
  );
});

export interface AnimatedSketchProps {
  inputs: SketchInputs;
  /** What makes it this drink's drawing: its id. */
  seed: string;
  detail?: SketchDetail;
  /** Change it to draw again from a blank page (a tap on the drawing, a new step). */
  play?: number;
  /** Blank paper this long (ms) before the pencil starts: time for what was there to fade away. */
  delay?: number;
  /** At night, the drink's soft glow behind it (the drink page's hero, as DrinkDrawing draws it). */
  glow?: boolean;
  /** Pencil only, no colour yet (the draft page, as PencilDrawing draws it). */
  pencil?: boolean;
}

/**
 * A drink's drawing, made in front of you: the pencil finds the glass, the
 * drink spreads in, ice drops, foam rises, the garnish lands and bubbles climb.
 * Ends on exactly the still drawing (SketchDrawing). Reduced motion shows it
 * finished. One at a time: a list of these would cost too much.
 */
export const AnimatedSketch = memo(function AnimatedSketch({ inputs: stored, seed, detail = 'full', play = 0, delay = 0, glow = false, pencil = false }: AnimatedSketchProps) {
  // No card behind it (decision chrome): at night it's painted for night, as the still drawing is.
  const night = useDs().scheme === 'dark';
  const inputs = inBarGlassCached(sameInputs(stored), useDrawingGlasses());
  const scene = sceneFor(inputs, seed, detail, true);
  const shown = pencil ? pencilScene(scene, night) : night ? nightOf(scene, inputs) : scene;
  return <AnimatedScene scene={shown} play={play} delay={delay} glow={night && glow && !pencil ? glowUris(shown) : null} />;
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});
