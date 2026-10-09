import type { Equipment, EquipmentKind } from './types';

export const EQUIPMENT_KINDS: { id: EquipmentKind; name: string }[] = [
  { id: 'measure', name: 'Measure' },
  { id: 'mix', name: 'Blend and whip' },
  { id: 'pressure', name: 'Gas and vacuum' },
  { id: 'temperature', name: 'Heat and cold' },
  { id: 'separate', name: 'Strain and spin' },
  { id: 'specialist', name: 'Specialist' },
];

/**
 * The kit techniques call for. Pots, jars, fine strainers, coffee filters, a
 * fridge and a freezer are assumed, so they aren't listed. Prices are only
 * given where a source gave one; tiers elsewhere are our estimate.
 */
export const EQUIPMENT: Equipment[] = [
  { id: 'scale-fine', name: 'Fine scale (0.01 g)', kind: 'measure', tier: '$', what: 'Weighs the gums, acids and foamers, which are mostly under a gram.', swap: 'Rough grams per 5 ml teaspoon: xanthan 3.5, agar 2.4, gellan 1.9, methylcellulose 1.3. Approximate only.', note: 'Get one that reads to 0.01 g with a 100 to 200 g top.' },
  { id: 'scale', name: 'Kitchen scale', kind: 'measure', tier: '$', what: 'Weighs batches, sugar and juice. Syrups and ratios are by weight.' },
  { id: 'refractometer', name: 'Refractometer (Brix)', kind: 'measure', tier: '$', what: 'Reads sugar in syrups, cordials and freeze-concentrated juice.', swap: 'Make syrups by weight and trust the ratio.', note: 'It reads all dissolved solids, so fruit syrups read a little high.' },
  { id: 'ph', name: 'pH meter or strips', kind: 'measure', tier: '$', what: 'Checks ferments, kombucha, acid-adjusted juice and spherification baths.', swap: 'Strips, for ferments.', note: 'Kombucha must finish at pH 4.2 or lower.' },
  { id: 'thermometer', name: 'Probe thermometer', kind: 'measure', tier: '$', what: 'Hydrating gums, gentle syrups, sous vide without a circulator, freezer checks.' },
  { id: 'droppers', name: 'Dasher and dropper bottles', kind: 'measure', tier: '$', what: 'Saline, acid solutions, tinctures and foamer drops.', note: 'Write the strength on the label: "Saline 20%". A dash or drop isn’t a standard size.' },

  { id: 'stick-blender', name: 'Stick blender or milk frother', kind: 'mix', tier: '$', what: 'Lecithin airs, and getting gums into liquid without lumps.', swap: 'A whisk, slowly.', note: 'For an air, keep the head half out of the liquid in a wide container.' },
  { id: 'blender', name: 'High-power blender', kind: 'mix', tier: '$$', what: 'Blender syrups, nut milks, fruit before enzymes, gums.', swap: 'A saucepan for syrups.', note: 'Friction heats the contents to about 77 °C in 5 minutes, so long blends cook the fruit.' },
  { id: 'whipper', name: 'iSi whipper', kind: 'pressure', tier: '$', what: 'Siphon foams, fast nitrous infusions, and small batches of fizz with CO2.', swap: 'A shaker, for shaken foams only.', note: 'N2O cream chargers only, never past the fill line: 1 charger for 0.25 or 0.5 L, 2 for 1 L. Hold no hotter than 75 °C. Strain everything that goes in. Never open it under pressure.' },
  { id: 'co2-rig', name: 'CO2 carbonation rig', kind: 'pressure', tier: '$$', price: 'Under $200 for tank, regulator, line and caps', what: 'Force-carbonates cocktails, sodas and batches in PET bottles.', swap: 'An iSi with CO2 bulbs, for a few drinks.', note: 'Pressure-rated bottles only. 45 psi for cocktails, 60 for water.' },
  { id: 'chamber-vac', name: 'Chamber vacuum sealer', kind: 'pressure', tier: '$$', what: 'Vacuum infusion, compressed fruit, quick pickles, sealing liquids.', swap: 'A zip bag with the air pushed out under water.', note: 'An edge sealer can’t seal liquids. Use jars, not pouches, for spirits.' },

  { id: 'sous-vide', name: 'Sous vide circulator', kind: 'temperature', tier: '$$', what: 'Infusions and syrups at an exact temperature.', swap: 'A pot and a thermometer, watched.', note: 'Zip bags up to about 70 °C. Ethanol boils near 78 °C, so stay well below. Weigh spirit bags down: they float.' },
  { id: 'dehydrator', name: 'Dehydrator', kind: 'temperature', tier: '$$', what: 'Dried citrus wheels, fruit and powders.', swap: 'The oven on its lowest setting, door ajar.' },
  { id: 'ice-cooler', name: 'Small hard-sided cooler', kind: 'temperature', tier: '$', what: 'Clear ice by freezing from the top down; freeze-concentrating juice.', note: '18 hours for a tray build, about 50 for a full block.' },
  { id: 'freezer-thermo', name: 'Freezer thermometer', kind: 'temperature', tier: '$', what: 'Knowing your freezer runs -12 °C, not -18 °C, before you batch for it.', note: 'Leave it 12 hours to read true.' },
  { id: 'smoke-gun', name: 'Smoke gun and cloche', kind: 'temperature', tier: '$', what: 'Smoke over a drink, a glass or a garnish.', swap: 'A smoker, for syrups and ice.', note: 'Ventilate.' },
  { id: 'torch', name: 'Kitchen torch', kind: 'temperature', tier: '$', what: 'Brûléed garnishes, toasted rims.', swap: 'The grill.', note: 'Let glass cool before it touches liquid.' },

  { id: 'superbag', name: 'Superbags or nut-milk bags', kind: 'separate', tier: '$', what: 'Every strain step: nut milks, purees, milk punch, fat washes.', note: 'Ratings run 100 to 800 micron. A bag alone won’t clarify; use it before a finer method.' },
  { id: 'hotel-pans', name: 'Perforated hotel pans', kind: 'separate', tier: '$', what: 'Freeze-thaw clarifying, and spreading a milk punch wide so it filters faster.', swap: 'A sieve over a bowl.' },
  { id: 'centrifuge', name: 'Centrifuge (Spinzall)', kind: 'separate', tier: '$$$', price: 'About $700 to $800 at launch', what: 'Clears juice and purees in minutes, with enzymes.', swap: 'Quick agar and a cloth: slower, nearly as clear.', note: 'Treat fruit with Pectinex first. Balance the rotor.' },

  { id: 'pacojet', name: 'Pacojet', kind: 'specialist', tier: '$$$', what: 'Frozen cocktails and sorbets, spun from a frozen block.', swap: 'A blender and a long rest.', note: 'Freeze at -20 °C for 24 hours before it spins.' },
  { id: 'rotovap', name: 'Rotary evaporator', kind: 'specialist', tier: '$$$', what: 'Distils at low temperature: hydrosols and clear distillates.', swap: 'Nitrous or freezer infusions, for flavour.', note: 'Distilling alcohol at a US bar or at home needs a federal (TTB) permit.' },
  { id: 'ultrasonic', name: 'Ultrasonic probe', kind: 'specialist', tier: '$$$', what: 'Fast infusions by cavitation.', swap: 'A nitrous infusion.', note: 'Bath cleaners haven’t been tested for drinks.' },
  { id: 'ln2', name: 'Liquid nitrogen Dewar and cryo gloves', kind: 'specialist', tier: '$$$', what: 'Instant chilling and freezing.', swap: 'The freezer.', note: 'Training and protective gear. Never serve a drink with nitrogen still in it.' },
  { id: 'swing-tops', name: 'Pressure-rated swing-top bottles', kind: 'specialist', tier: '$', what: 'Second ferments and bottled fizz.', note: 'They build pressure fast in a second ferment. Chill before opening.' },
];

/** A tier in words: only `price` is sourced, so tiers stay rough. */
export const TIER_LABEL: Record<Equipment['tier'], string> = { $: 'Under about $50', $$: 'About $50 to $500', $$$: 'Over about $500' };

const BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));

export function equipmentById(id: string): Equipment | undefined {
  return BY_ID.get(id);
}
