import { specLines, type SpecLine } from '@/lib/spec';

import { SAMPLE_LEVELS } from './drinkSample';

// Sample drinks for the batch preview on /dev/drink, one per batching rule.
// Classic, widely published specs, like the brief's spec glass.

type Row = [name: string, amount: number, unit: string];

export const BATCH_SAMPLES = {
  penicillin: {
    name: 'Penicillin',
    methods: ['Shake'],
    rows: [['Monkey Shoulder', 60, 'ml'], ['Lemon juice', 22.5, 'ml'], ['Honey-ginger syrup', 22.5, 'ml'], ['Laphroaig 10', 7.5, 'ml']] as Row[],
  },
  martini: {
    name: 'House Martini',
    methods: ['Stir'],
    rows: [['Plymouth Gin', 60, 'ml'], ['Dolin Dry vermouth', 15, 'ml'], ['Orange bitters', 1, 'dash'], ['Lemon', 1, 'twist']] as Row[],
  },
  daiquiri: {
    name: 'Daiquiri',
    methods: ['Shake'],
    rows: [['White rum', 60, 'ml'], ['Lime juice', 22.5, 'ml'], ['Simple syrup', 15, 'ml']] as Row[],
  },
  paloma: {
    name: 'Paloma',
    methods: ['Build'],
    rows: [['Tequila', 50, 'ml'], ['Lime juice', 15, 'ml'], ['Grapefruit soda', 120, 'ml']] as Row[],
  },
} as const;

export type BatchSampleKey = keyof typeof BATCH_SAMPLES;

/** The sample's spec as a role sees it: no amounts below the measurement level. */
export function batchSampleLines(key: BatchSampleKey, role: number): SpecLine[] {
  const amounts = role >= SAMPLE_LEVELS.measurement;
  return specLines(
    BATCH_SAMPLES[key].rows.map(([name, amount, unit], i) => ({
      id: `${key}-${i}`,
      sort_order: i,
      amount: amounts ? amount : null,
      unit: amounts ? unit : null,
      display_ingredient_id: `${key}-${i}`,
      display_ingredient: { id: `${key}-${i}`, name },
    }))
  );
}
