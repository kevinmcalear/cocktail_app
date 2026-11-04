// Passes over a painted scene, for the 2027 drawings (canvas GWBCX, Decided
// page, note d4): split it into parts (so the colour can pour in under the
// pencil), keep only the pencil (empty and loading states), and paint it for
// night: only what light would catch.

import { SKETCH } from '@/constants/sketch';

import type { Scene, SceneEl, StageName } from './scene';

type Visit = (el: SceneEl, stage: StageName | null) => SceneEl | null;

/** Every leaf through `visit`, inside groups and stages; a group or stage left empty goes too. */
export function mapScene(scene: Scene, visit: Visit): Scene {
  const walk = (els: SceneEl[], stage: StageName | null): SceneEl[] =>
    els.flatMap((el): SceneEl[] => {
      if (el.k === 'group' || el.k === 'stage') {
        const children = walk(el.children, el.k === 'stage' ? el.name : stage);
        return children.length ? [{ ...el, children }] : [];
      }
      const out = visit(el, stage);
      return out ? [out] : [];
    });
  return { size: scene.size, els: walk(scene.els, null) };
}

/** Only these parts of the drawing (the liquid, to pour it in). */
export const onlyStages = (scene: Scene, names: readonly StageName[]) => mapScene(scene, (el, stage) => (stage && names.includes(stage) ? el : null));
/** Everything but these parts. */
export const withoutStages = (scene: Scene, names: readonly StageName[]) => mapScene(scene, (el, stage) => (stage && names.includes(stage) ? null : el));

/** The pencil alone: the glass as it's first found, before any colour. Empty and loading states. */
export const pencilOnly = (scene: Scene) => mapScene(scene, (el) => (el.k === 'stroke' ? el : null));

// --- colour, in OKLCH so lifting a colour keeps its hue (no grey mud) ---

type Lch = { L: number; C: number; H: number };
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToLch(hex: string): Lch {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), H: (Math.atan2(B, A) * 180) / Math.PI };
}

export function lchToHex({ L, C, H }: Lch): string {
  const h = (H * Math.PI) / 180;
  const [A, B] = [C * Math.cos(h), C * Math.sin(h)];
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, gam(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Pencil at night: chalk. */
export const CHALK = SKETCH.chalk;
const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** A pigment as light would catch it: lifted to at least mid-tone and a touch richer; a clear drink reads silver. */
function lift(hex: string): string {
  if (!isHex(hex)) return hex;
  const c = hexToLch(hex);
  if (c.C < 0.04) return lchToHex({ L: Math.max(c.L, 0.78), C: 0.012, H: c.H });
  return lchToHex({ L: Math.min(0.92, Math.max(c.L, 0.5) + 0.05), C: c.C * 1.2, H: c.H });
}

/** Two hex colours mixed, `t` of the second. */
function mix(a: string, b: string, t: number): string {
  if (!isHex(a) || !isHex(b)) return a;
  const n = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => Math.round(n(a, i) * (1 - t) + n(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
}

const paperLike = (hex: string) => isHex(hex) && hexToLch(hex).L > 0.86 && hexToLch(hex).C < 0.04;
const dark = (hex: string) => isHex(hex) && hexToLch(hex).L < 0.42;
/** How strong the chalk is, by part: a faint glass, ice a little stronger, so the drink leads. */
const CHALK_WEIGHT: Partial<Record<StageName, number>> = { glass: 0.72, ice: 1.15, search: 0.6 };

/**
 * The same scene painted for night, part by part (Decided d4, "Light"): the
 * pencil turns to chalk, the drink is lifted with a lit rim at its fill line,
 * ice and highlights become a lighter patch of the drink, and the searching
 * smudges and shadows go (on black they read as fog and mould). `liquid` is
 * the drink's colour (lib/sketch/types liquidOf). `bare`: a glass with no
 * drink in it (types isBareGlass): its pencil is all there is, so the chalk is
 * full strength and a little heavier, to read on the night tile.
 */
export function nightScene(scene: Scene, liquid: string, bare = false): Scene {
  const frost = mix(lift(liquid), SKETCH.white, 0.55);
  return mapScene(scene, (el, stage) => {
    switch (el.k) {
      case 'stroke':
        if (!dark(el.color)) return { ...el, color: lift(el.color) };
        // A bare glass's chalk is stronger and heavier than a drawn drink's: its pencil is all there is.
        return { ...el, color: CHALK, o: Math.min(1, el.o * (CHALK_WEIGHT[stage ?? 'glass'] ?? 0.85) * (bare ? 2.6 : 1)), w: el.w * (bare ? 1.7 : 1) };
      case 'soft':
        // Searching smudges and cast shadows: gone.
        return stage === 'search' || dark(el.color) || paperLike(el.color) ? null : { ...el, color: lift(el.color) };
      case 'fill':
        if (paperLike(el.color)) return stage === 'ice' || stage === 'foam' ? { ...el, color: frost } : null;
        return dark(el.color) && stage !== 'garnish' ? null : { ...el, color: lift(el.color) };
      case 'wash': {
        if (paperLike(el.color)) return stage === 'ice' || stage === 'foam' ? { ...el, color: frost, edge: frost } : null;
        const color = lift(el.color);
        // The wash's dark edge becomes the lit rim: the fill line catching the light.
        return { ...el, color, edge: mix(color, SKETCH.white, 0.45), edgeO: Math.min(1, el.edgeO * 1.4) };
      }
      default:
        return el;
    }
  });
}

/** The parts that glow at night, in the order they come in: the drink, then its garnish. */
export const GLOW_STAGES = ['liquid', 'garnish'] as const satisfies readonly StageName[];

/** Just the drink and its garnish, for night's soft glow behind the drawing. */
export const glowScene = (night: Scene) => onlyStages(night, GLOW_STAGES);

/**
 * The glow of a drawing that moves, one scene per part, so each comes in with
 * its own stage (AnimatedSketch): the garnish never glows before it lands. A
 * part that isn't drawn has no glow.
 */
export const glowParts = (night: Scene) =>
  GLOW_STAGES.flatMap((stage) => {
    const scene = onlyStages(night, [stage]);
    return scene.els.length ? [{ stage, scene }] : [];
  });
