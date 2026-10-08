import { memo, useId, type ReactNode } from 'react';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { paintSketch } from '@/lib/sketch/paint';
import type { Scene, SceneEl } from '@/lib/sketch/scene';
import type { SketchInputs } from '@/lib/sketch/types';

import { useDs } from './theme';

export type SketchDetail = 'full' | 'thumb';

// Painted once per drink and detail, then reused while the inputs object is
// the same (TanStack Query keeps it stable until the row changes).
const scenes = new WeakMap<SketchInputs, Map<string, Scene>>();
export function sceneFor(inputs: SketchInputs, seed: string, detail: SketchDetail, bands = false): Scene {
  let byKey = scenes.get(inputs);
  if (!byKey) scenes.set(inputs, (byKey = new Map()));
  const key = `${seed}|${detail}|${bands}`;
  let scene = byKey.get(key);
  if (!scene) byKey.set(key, (scene = paintSketch(inputs, { seed, detail, bands })));
  return scene;
}

function stops(color: string, fadeTo: number) {
  return [
    <Stop key="a" offset="0" stopColor={color} stopOpacity={1} />,
    <Stop key="b" offset="0.45" stopColor={color} stopOpacity={0.92} />,
    <Stop key="c" offset="1" stopColor={color} stopOpacity={fadeTo} />,
  ];
}

// Ids are prefixed per drawing (u): on web they share the page, and the same
// drink drawn twice (a tile under its page) would borrow the other's gradients
// and clips.
export function defsFor(els: SceneEl[], u: string, out: ReactNode[]) {
  for (const el of els) {
    if (el.k === 'wash') {
      const [x1, y1, x2, y2] = el.grad;
      out.push(
        <LinearGradient key={`${el.id}f`} id={`${u}${el.id}f`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>{stops(el.color, el.fadeTo)}</LinearGradient>,
        <LinearGradient key={`${el.id}e`} id={`${u}${el.id}e`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>{stops(el.edge, el.fadeTo)}</LinearGradient>,
      );
    } else if (el.k === 'soft') {
      out.push(
        <RadialGradient key={el.id} id={`${u}${el.id}`}>
          <Stop offset="0" stopColor={el.color} stopOpacity={1} />
          <Stop offset="0.6" stopColor={el.color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={el.color} stopOpacity={0} />
        </RadialGradient>,
      );
    } else if (el.k === 'group') {
      out.push(<ClipPath key={el.id} id={`${u}${el.id}`}><Path d={el.clip} /></ClipPath>);
      defsFor(el.children, u, out);
    } else if (el.k === 'stage') {
      defsFor(el.children, u, out);
    }
  }
  return out;
}

export function draw(el: SceneEl, i: number, u: string): ReactNode {
  switch (el.k) {
    case 'fill':
      return <Path key={i} d={el.d} fill={el.color} fillOpacity={el.o} />;
    case 'stroke':
      return (
        <Path key={i} d={el.d} fill="none" stroke={el.color} strokeOpacity={el.o} strokeWidth={el.w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={el.dash ?? undefined} />
      );
    case 'wash':
      return (
        <G key={i}>
          {el.ds.map((d, j) => (
            <Path key={j} d={d} fill={`url(#${u}${el.id}f)`} fillOpacity={el.o} stroke={`url(#${u}${el.id}e)`} strokeOpacity={el.edgeO} strokeWidth={el.edgeW} />
          ))}
        </G>
      );
    case 'soft':
      return (
        <Ellipse key={i} cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} fill={`url(#${u}${el.id})`} opacity={el.o} transform={`rotate(${(el.rot * 180) / Math.PI} ${el.cx} ${el.cy})`} />
      );
    case 'group':
      return <G key={i} clipPath={`url(#${u}${el.id})`}>{el.children.map((c, j) => draw(c, j, u))}</G>;
    case 'stage':
      // Still drawings ignore stages; AnimatedSketch moves each on its own.
      return <G key={i}>{el.children.map((c, j) => draw(c, j, u))}</G>;
  }
}

export interface SketchDrawingProps {
  inputs: SketchInputs;
  /** What makes it this drink's drawing: its id. */
  seed: string;
  /** 'thumb' for small tiles: lighter, without the searching lines and hatching. */
  detail?: SketchDetail;
}

/**
 * A drink drawn from its drawing inputs: a rough graphite-and-watercolour
 * sketch on the house paper, fitted inside its frame. Decorative: the frame around
 * it carries the label.
 */
export const SketchDrawing = memo(function SketchDrawing({ inputs, seed, detail = 'full' }: SketchDrawingProps) {
  return <SceneSvg scene={sceneFor(inputs, seed, detail)} />;
});

/** Any painted scene (a drink, a bottle, a still life) on the house paper, fitted inside its frame. */
export const SceneSvg = memo(function SceneSvg({ scene }: { scene: Scene }) {
  const ds = useDs();
  const u = useId().replace(/[^A-Za-z0-9]/g, '');
  return (
    // The paper runs past the square when the frame is wider (a phone hero).
    <Svg width="100%" height="100%" viewBox={`0 0 ${scene.size} ${scene.size}`} preserveAspectRatio="xMidYMid meet" style={{ backgroundColor: ds.c.paper }} aria-hidden>
      <Rect x={0} y={0} width={scene.size} height={scene.size} fill={ds.c.paper} />
      <Defs>{defsFor(scene.els, u, [])}</Defs>
      {scene.els.map((el, i) => draw(el, i, u))}
    </Svg>
  );
});
