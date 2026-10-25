// How a venue's ice is made: the twelve ways Kevin picked (Kit and ice,
// decision 4, docs/kit_and_ice.md). Picking one writes a starting recipe in
// our own words, labelled bar practice, that the venue changes to how it does
// it. Tools are lib/techniques/equipment.ts ids. Checked on the web, 25 Oct
// 2026 (sources at the end of the file).

export const ICE_WAY_KEYS = ['cut', 'mould', 'clear', 'lewis', 'crack', 'press', 'carve', 'shave', 'stamp', 'inside', 'flavoured', 'own'] as const;
export type IceWayKey = (typeof ICE_WAY_KEYS)[number];

/** What a way starts from: another ice of the venue's (to pick), water, or a flavour. */
export type IceFrom = 'block' | 'cubes' | 'water' | 'flavour';

export interface IceStep {
  body: string;
  tools: string[];
}

export interface IceWay {
  key: IceWayKey;
  title: string;
  /** "From a block or slab · bandsaw, or an ice saw and pick": what it starts from and needs. */
  line: string;
  /** The six common ways show first; the rest sit behind "More ways". */
  common: boolean;
  from: IceFrom;
  steps: IceStep[];
}

const step = (body: string, ...tools: string[]): IceStep => ({ body, tools });

const TEMPER = step('Temper the block: rest it out of the freezer, covered, until the outside looks wet and glassy (an hour or more for a big one), so it cuts without shattering.');
const STORE = step('Freeze the pieces apart on a lined tray, then bag them so they don’t stick together.');

export const ICE_WAYS: IceWay[] = [
  {
    key: 'cut',
    title: 'Cut from a block or slab',
    line: 'From a block or slab · bandsaw, or an ice saw and pick',
    common: true,
    from: 'block',
    steps: [TEMPER, step('Trim off any cloudy part, then cut slabs as thick as the piece you want. By hand: score a line, set the pick in it and tap to split, halving each time.', 'bandsaw'), step('Cut each slab into {size} pieces.', 'bandsaw'), STORE],
  },
  {
    key: 'mould',
    title: 'Freeze in a mould',
    line: 'From water · cube, Collins or sphere moulds',
    common: true,
    from: 'water',
    steps: [step('Fill the moulds with filtered water, leaving a little room at the top. A mould freezes from every side, so the middle comes out cloudy.', 'silicone-moulds'), step('Freeze until solid, about a day.'), step('Unmould and keep in a closed tub in the freezer.')],
  },
  {
    key: 'clear',
    title: 'Freeze a block clear',
    line: 'From water · an insulated cooler, or a block machine',
    common: true,
    from: 'water',
    steps: [
      step('Fill a small hard-sided cooler with water and set it in the freezer with the lid off, so it freezes from the top down.', 'ice-cooler'),
      step('Take it out before it freezes all the way, after about two days (a torch shows how far it’s gone): the cloud collects in the water left at the bottom.'),
      step('Tip it out over the sink and let the block temper.'),
      step('Cut or chip away any cloudy part.', 'ice-saw'),
    ],
  },
  {
    key: 'lewis',
    title: 'Smash in a Lewis bag',
    line: 'From your cubes · Lewis bag and mallet',
    common: true,
    from: 'cubes',
    steps: [step('Fill the Lewis bag about halfway with cubes.', 'ice-tools'), step('Fold it shut and hit it with the mallet until it’s as fine as you want. The canvas soaks up the water, so the ice stays dry.', 'ice-tools'), step('Use it straight away. It melts fast.')],
  },
  {
    key: 'crack',
    title: 'Crack to order',
    line: 'From a cube · hit it with the back of a bar spoon',
    common: true,
    from: 'cubes',
    steps: [step('Take a very cold, dry cube and hold it in your palm.'), step('Hit the middle of a flat face with the back of a bar spoon, turn it and hit again, until it breaks into a few chunks.', 'mixing-glass'), step('Use it straight away.')],
  },
  {
    key: 'press',
    title: 'Press a sphere',
    line: 'From a cube or block · an ice ball press',
    common: true,
    from: 'block',
    steps: [step('Cut a cube a little bigger than the sphere from the block.', 'bandsaw'), step('Warm the press in hot water, then set the cube in it. It’s round in about a minute.', 'ice-ball-press'), step('Warm the press again before the next one.', 'ice-ball-press'), step('Back in the freezer to firm up.')],
  },
  {
    key: 'carve',
    title: 'Carve by hand',
    line: 'From a block · an ice pick and a knife',
    common: false,
    from: 'block',
    steps: [TEMPER, step('Score a line and split off a piece a little bigger than you want, then square it.', 'ice-tools'), step('Chip and shave it to shape with the knife, turning it as you go.'), STORE],
  },
  {
    key: 'shave',
    title: 'Shave from a block',
    line: 'From a block · a block shaver',
    common: false,
    from: 'block',
    steps: [TEMPER, step('Set the block in the shaver and set how fine it shaves.', 'block-shaver'), step('Shave it to order, straight into the glass.', 'block-shaver')],
  },
  {
    key: 'stamp',
    title: 'Stamp',
    line: 'From a clear cube · an ice stamp',
    common: false,
    from: 'cubes',
    steps: [step('Use a large cube with a flat top, tempered so it doesn’t crack.'), step('Press the stamp flat into the top face for a few seconds, then lift straight up. Doing a lot? Rest it in warm water between cubes.', 'ice-stamp'), step('Freeze them apart on a tray, never stacked, so the mark keeps.')],
  },
  {
    key: 'inside',
    title: 'Something frozen inside',
    line: 'From water · moulds, and what goes in',
    common: false,
    from: 'water',
    steps: [
      step('Fill each mould a third full with cold water and freeze until set.', 'silicone-moulds'),
      step('Lay {inside} on the ice (flowers only if they’re sold to eat).'),
      step('Top up with cold water and freeze, so it sits in the middle.'),
      step('Unmould and trim to {size}.'),
    ],
  },
  {
    key: 'flavoured',
    title: 'Flavoured ice',
    line: 'From a flavour · coffee, tea or juice, in moulds',
    common: false,
    from: 'flavour',
    steps: [step('Make the coffee, tea or juice fresh and strong, and let it cool.'), step('Fill the moulds and freeze until solid.', 'silicone-moulds'), step('Unmould and keep sealed, apart from plain ice.')],
  },
  { key: 'own', title: 'Write our own', line: 'Start from a blank recipe', common: false, from: 'water', steps: [] },
];

const BY_KEY = new Map(ICE_WAYS.map((w) => [w.key, w]));
export const iceWay = (key: IceWayKey): IceWay => BY_KEY.get(key)!;

/** Steps the editor's "Add a step" offers, beside our own step. */
export const ICE_EXTRA_STEPS: { key: 'stamp' | 'inside' | 'sphere'; label: string; step: IceStep }[] = [
  { key: 'stamp', label: 'Stamp', step: step('Press the stamp flat into the top face, then lift straight up.', 'ice-stamp') },
  { key: 'inside', label: 'Freeze something inside', step: step('Half freeze, lay {inside} on the ice, top up with cold water and freeze.', 'silicone-moulds') },
  { key: 'sphere', label: 'Shape it (sphere)', step: step('Set it in the warmed press until it’s round, about a minute.', 'ice-ball-press') },
];

/** Fill in the ice's own size and what's frozen inside. */
export function fillIceStep(s: IceStep, ice: { size_mm?: number | null; frozen_inside?: string | null }): IceStep {
  const size = ice.size_mm ? `${ice.size_mm} mm` : 'the size you want';
  const inside = ice.frozen_inside?.trim() ? `the ${ice.frozen_inside.trim().replace(/^(a|an|the) /i, '')}` : 'what goes inside';
  return { ...s, body: s.body.replace('{size}', size).replace('{inside}', inside) };
}

// Ways that stamp already, or make ice too small or loose to stamp.
const UNSTAMPED = new Set<IceWayKey>(['stamp', 'lewis', 'crack', 'shave']);

/** A way's starting steps for this ice, with a stamp step when the ice is stamped and the way doesn't stamp already. */
export function iceWaySteps(key: IceWayKey, ice: { size_mm?: number | null; stamped?: boolean; frozen_inside?: string | null }): IceStep[] {
  const steps = iceWay(key).steps.map((s) => fillIceStep(s, ice));
  if (ice.stamped && !UNSTAMPED.has(key) && steps.length) steps.splice(steps.length - 1, 0, ICE_EXTRA_STEPS[0].step);
  return steps;
}

// Sources, checked 25 Oct 2026:
// Tempering, scoring and splitting a block: abarabove.com/podcast/mtp180-clear-ice-from-clinebell-to-glass,
//   alcademics.com/cutting-up-a-slab-of-ice-using-an-ice-pick-or-bread-knife
// Moulds cloud in the middle; filtered water for taste: kegworks.com/blog/how-to-make-clear-ice,
//   diffordsguide.com/encyclopedia/323/bundle/ice-in-cocktails
// A clear block in a cooler, lid off, about two days: insidehook.com/drinks/clear-ice-cocktail-book,
//   alcademics.com/boiled-versus-rested-water-clarity-with-directional-freezing-a-comparison
// Lewis bag: bostongeneralstore.com/products/the-schmallet-ice-mallet-and-bag
// Cracking with a bar spoon: foodrepublic.com/1570535/ice-cube-tip-cold-cocktails
// Sphere press, about a minute, rewarm between balls: Cocktail Kingdom's 55 mm ice ball maker page
// Hand-carved spheres: barschool.net/blog/hand-carved-japanese-style-ice-balls
// Block shavers: vinepair.com/articles/shaved-ice-cocktail-trend
// Stamps need no heat, don't stack: alcademics.com/how-to-monogram-your-ice-cubes-with-ice-brands
// Frozen inside, in layers; edible flowers: chatelaine.com/food/drinks/how-to-flower-ice-cubes
// Coffee ice: chowhound.com/1796267/coffee-cocktail-ice-cube-hack
