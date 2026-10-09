/**
 * "Make it in house": a name typed into a spec that isn't on the shelf
 * ("Clarified grapefruit", "Brown butter bourbon") and the techniques that
 * would make it. Choosing one gives the new ingredient a prep card: its
 * action tag, how long it takes, and the steps with the amounts for a batch.
 */
import type { PREP_ACTIONS } from '../scale';
import { formatDose, scaleParts, techniqueById, TECHNIQUES } from './index';
import type { Technique, TechniqueGroup } from './types';

type PrepAction = (typeof PREP_ACTIONS)[number];

/** Words in a name → the techniques that make it, most likely first. */
const RULES: { test: RegExp; ids?: string[]; group?: TechniqueGroup }[] = [
  { test: /milk[- ]?wash|milk punch/, ids: ['milk-wash', 'vegan-wash'] },
  { test: /clarif/, ids: ['agar-quick', 'centrifuge', 'gelatin-freeze-thaw', 'agar-freeze-thaw', 'milk-wash'] },
  { test: /(fat|butter|bacon|oil|ghee|duck)[- ]?wash|brown butter/, ids: ['fat-wash'] },
  { test: /foam|espuma|\bair\b/, group: 'foam' },
  { test: /sour syrup/, ids: ['sour-syrup'] },
  { test: /tincture|bitters/, ids: ['tincture'] },
  { test: /infus/, ids: ['cold-infusion', 'nitrous-infusion', 'sous-vide-infusion', 'vacuum-infusion'] },
  { test: /oleo/, ids: ['oleo-saccharum'] },
  { test: /cordial/, ids: ['cordial'] },
  { test: /shrub/, ids: ['shrub'] },
  { test: /orgeat/, ids: ['orgeat'] },
  { test: /grenadine/, ids: ['grenadine'] },
  { test: /gomme|gum syrup/, ids: ['gomme'] },
  { test: /saline/, ids: ['saline'] },
  { test: /super juice|acid[- ]?adjust|acid solution/, ids: ['acid-adjust'] },
  { test: /(honey|agave) syrup/, ids: ['honey-syrup'] },
  { test: /syrup/, ids: ['syrup-by-weight', 'blender-syrup'] },
  { test: /tepache/, ids: ['tepache'] },
  { test: /kombucha/, ids: ['kombucha'] },
  { test: /ferment/, ids: ['lacto-ferment'] },
  { test: /pickle|brine/, ids: ['quick-pickle'] },
  { test: /dried|dehydrated/, ids: ['dehydrated-citrus'] },
  { test: /smoked/, ids: ['smoke'] },
  { test: /carbonated|sparkling/, ids: ['force-carbonate'] },
  { test: /powder/, ids: ['fat-powder'] },
  { test: /sphere|caviar|pearls/, ids: ['reverse-spheres'] },
  { test: /suspended|fluid gel/, ids: ['suspension'] },
];

/** The techniques that would make a typed name, without repeats; none for an ordinary name. */
export function waysToMake(name: string): Technique[] {
  const n = name.trim().toLowerCase();
  if (!n) return [];
  const found: Technique[] = [];
  for (const r of RULES) {
    if (!r.test.test(n)) continue;
    const list = r.group ? TECHNIQUES.filter((t) => t.group === r.group) : (r.ids ?? []).map((id) => techniqueById(id)!);
    for (const t of list) if (t && !found.includes(t)) found.push(t);
  }
  return found;
}

const BY_ID: Record<string, PrepAction> = {
  centrifuge: 'Centrifuge', 'milk-wash': 'Milk wash', 'vegan-wash': 'Milk wash', 'fat-wash': 'Fat wash',
  'sous-vide-infusion': 'Sous vide', 'dehydrated-citrus': 'Dehydrate', 'quick-pickle': 'Mix', 'blender-syrup': 'Blend',
};
const BY_GROUP: Record<TechniqueGroup, PrepAction> = {
  foam: 'Foam', clarify: 'Clarify', wash: 'Fat wash', infuse: 'Infuse', syrup: 'Syrup', texture: 'Mix',
  carbonate: 'Carbonate', cold: 'Freeze', preserve: 'Ferment', distil: 'Distil',
};

/** The prep card tag for a technique, so the card links back to it. */
export function actionFor(t: Technique): PrepAction {
  return BY_ID[t.id] ?? BY_GROUP[t.group];
}

export interface TechniquePrepCard {
  actions: string[];
  leadMinutes: number;
  leadNote: string;
  steps: { body: string; timer_seconds: number | null }[];
}

/** A new house prep's card from a technique: the amounts for its usual batch first, then the steps. */
export function prepCardFor(t: Technique): TechniquePrepCard {
  const steps: TechniquePrepCard['steps'] = [];
  if (t.base && t.parts) {
    const base = t.base.amounts[Math.min(1, t.base.amounts.length - 1)];
    const parts = scaleParts(t.parts, base).map((p) => `${formatDose(p.amount)} ${p.unit} ${p.name.toLowerCase()}`);
    steps.push({ body: `For ${base} ${t.base.unit} ${t.base.name.toLowerCase()}: ${parts.join(', ')}.`, timer_seconds: null });
  }
  for (const s of t.steps) steps.push({ body: s.text, timer_seconds: s.timer ?? null });
  steps.push({ body: `How it works, and how much for any batch: ${t.name} in Techniques.`, timer_seconds: null });
  return { actions: [actionFor(t)], leadMinutes: t.totalMinutes, leadNote: t.time, steps };
}
