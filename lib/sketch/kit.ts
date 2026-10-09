// Bar kit drawn in the house hand, like the produce still lifes: a small set
// of drawings (tins, a jigger, a strainer, a scale, a canister, an appliance
// box...), some with a few variants, and every piece of kit in
// lib/techniques/equipment.ts mapped to one. Same kit, same drawing.

import { drawBottle, handFor } from './bottle';
import { GLASS_SHAPES } from './geometry';
import { appliance, bag, canister, flask, jug, pan, stick } from './kitMachines';
import { atomizer, bottles, jigger, mallet, mixingGlass, peeler, press, probe, scale, strainer, tins, type KitCtx } from './kitTools';
import { makePainter } from './painter';
import { hashString, rng } from './random';
import { SceneBuilder, type Scene } from './scene';

export const KIT_KINDS = ['tins', 'jigger', 'mixing-glass', 'strainer', 'press', 'peeler', 'mallet', 'atomizer', 'scale', 'probe', 'bottles', 'stick', 'jug', 'canister', 'box', 'flask', 'bag', 'pan'] as const;
export type KitKind = (typeof KIT_KINDS)[number];

/** The drawings a kind has; the first is its default. */
export const KIT_VARIANTS: Partial<Record<KitKind, readonly string[]>> = {
  scale: ['kitchen', 'fine'],
  probe: ['dial', 'pen', 'scope', 'horn'],
  bottles: ['dropper', 'swing', 'ferment'],
  stick: ['blender', 'circulator'],
  jug: ['blender', 'juicer'],
  canister: ['whipper', 'tank', 'dewar', 'smoke', 'torch'],
  box: ['vac', 'trays', 'cooler', 'dryer', 'plate', 'spin'],
  flask: ['filter', 'rotovap'],
};

export interface KitArt {
  kind: KitKind;
  variant?: string;
}

const KIT: Record<string, KitArt> = {
  shaker: { kind: 'tins' },
  jigger: { kind: 'jigger' },
  'mixing-glass': { kind: 'mixing-glass' },
  strainers: { kind: 'strainer' },
  'citrus-press': { kind: 'press' },
  squasher: { kind: 'press' },
  peeler: { kind: 'peeler' },
  'ice-tools': { kind: 'mallet' },
  atomizer: { kind: 'atomizer' },
  scale: { kind: 'scale' },
  'scale-fine': { kind: 'scale', variant: 'fine' },
  thermometer: { kind: 'probe' },
  'freezer-thermo': { kind: 'probe' },
  ph: { kind: 'probe', variant: 'pen' },
  refractometer: { kind: 'probe', variant: 'scope' },
  ultrasonic: { kind: 'probe', variant: 'horn' },
  droppers: { kind: 'bottles' },
  'spheres-kit': { kind: 'bottles' },
  'swing-tops': { kind: 'bottles', variant: 'swing' },
  'ferment-kit': { kind: 'bottles', variant: 'ferment' },
  'stick-blender': { kind: 'stick' },
  'sous-vide': { kind: 'stick', variant: 'circulator' },
  blender: { kind: 'jug' },
  pacojet: { kind: 'jug' },
  juicer: { kind: 'jug', variant: 'juicer' },
  whipper: { kind: 'canister' },
  'co2-rig': { kind: 'canister', variant: 'tank' },
  ln2: { kind: 'canister', variant: 'dewar' },
  'smoke-gun': { kind: 'canister', variant: 'smoke' },
  torch: { kind: 'canister', variant: 'torch' },
  'chamber-vac': { kind: 'box' },
  dehydrator: { kind: 'box', variant: 'trays' },
  'ice-cooler': { kind: 'box', variant: 'cooler' },
  'freeze-dryer': { kind: 'box', variant: 'dryer' },
  'stir-plate': { kind: 'box', variant: 'plate' },
  centrifuge: { kind: 'box', variant: 'spin' },
  'vacuum-filter': { kind: 'flask' },
  rotovap: { kind: 'flask', variant: 'rotovap' },
  superbag: { kind: 'bag' },
  'hotel-pans': { kind: 'pan' },
};

/** The drawing for a piece of kit (lib/techniques/equipment.ts id). Kit we don't know is drawn as an appliance box. */
export function kitArt(equipmentId: string): KitArt {
  return KIT[equipmentId] ?? { kind: 'box' };
}

const DRAW: Record<KitKind, (k: KitCtx) => void> = {
  tins, jigger, 'mixing-glass': mixingGlass, strainer, press, peeler, mallet, atomizer, scale, probe, bottles, stick, jug, canister, box: appliance, flask, bag, pan,
};

export function paintKit(art: KitKind | KitArt, { seed, detail = 'full' }: { seed: string; detail?: 'full' | 'thumb' }): Scene {
  const { kind, variant } = typeof art === 'string' ? { kind: art, variant: undefined } : art;
  const S = handFor(detail);
  const key = `${seed}|kit`;
  const r = rng(hashString(key));
  const b = new SceneBuilder(`k${hashString(seed).toString(36)}`);
  const hand = rng(hashString(`${key}|hand`));
  const P = makePainter(S, r, hand, b, GLASS_SHAPES.rocks);
  DRAW[kind]({
    P,
    r,
    thumb: detail === 'thumb',
    v: variant ?? KIT_VARIANTS[kind]?.[0] ?? '',
    placed: (pl) => makePainter(S, r, hand, b, GLASS_SHAPES.rocks, pl),
    bottle: (inputs, pl, salt) => drawBottle(b, S, inputs, `${seed}|${salt}`, detail, pl),
  });
  return b.done();
}
