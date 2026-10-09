import { src } from './sources';
import type { BuyLink, Grade, Source } from './types';

export interface TechnicalIngredient {
  id: string;
  name: string;
  /** Lowercase names it goes by in the catalog, matched whole. */
  names: string[];
  what: string;
  vegan: boolean;
  allergens?: string[];
  /** How much alcohol it copes with. */
  alcohol?: string;
  /** Dose by job, as % by weight of the finished liquid unless it says otherwise. */
  jobs: { job: string; dose: string; grade: Grade }[];
  /** How to get it into a liquid without lumps or failure. */
  mix: string;
  watch?: string[];
  /** Grams in a level 5 ml teaspoon, for anyone without a fine scale (approximate). */
  perTsp?: number;
  techniques: string[];
  sources: Source[];
  /** Where to buy the product bars use: a maker or specialist shop page, best first. */
  buy?: BuyLink[];
}

export const TECHNICAL_INGREDIENTS: TechnicalIngredient[] = [
  {
    id: 'xanthan', name: 'Xanthan gum', names: ['xanthan', 'xanthan gum'], vegan: true, perTsp: 3.5,
    what: 'Thickens hot or cold with no heating. A trace adds body; a little more holds things in suspension.',
    alcohol: 'Fine up to about 60%',
    jobs: [
      { job: 'Body in a no-alcohol drink', dose: '0.05 to 0.1%', grade: 'C' },
      { job: 'Steady a foam', dose: '0.1 to 0.3%', grade: 'A' },
      { job: 'Suspension syrup', dose: '0.33% (1 g in 300 g 1:1 syrup)', grade: 'B' },
    ],
    mix: 'Blend it into water or 1:1 syrup, or pre-mix it with ten times its weight of sugar. It won’t hydrate in 2:1 syrup.',
    watch: ['Slimy when overdosed.'],
    techniques: ['body-syrup', 'suspension', 'siphon-foam', 'vegan-siphon-foam'],
    sources: [src('khymos', 'A'), src('specialSuspension', 'B')],
    buy: [{ name: 'Xanthan gum, Modernist Pantry', url: 'https://modernistpantry.com/products/xanthan-gum.html' }, { name: 'Perfected xanthan (disperses easier), Modernist Pantry', url: 'https://modernistpantry.com/products/perfected-xanthan-gum.html' }],
  },
  {
    id: 'agar', name: 'Agar', names: ['agar', 'agar agar', 'agar-agar'], vegan: true, perTsp: 2.4,
    what: 'A seaweed gel that sets fast and holds up to heat. The quick way to clarify juice.',
    alcohol: 'Tolerates alcohol, acid and sugar',
    jobs: [
      { job: 'Clarify juice', dose: '0.2% (2 g per kg)', grade: 'A' },
      { job: 'Soft gel', dose: '0.2%', grade: 'A' },
      { job: 'Firm gel', dose: '0.5%', grade: 'A' },
    ],
    mix: 'Whisk into cold water and boil it. Add acidic juice after it’s boiled; long heating in acid weakens it.',
    watch: ['Sets at 35 to 45 °C in minutes.', 'EU rules ban seaweed gels in jelly mini-cups (jelly shots).'],
    techniques: ['agar-quick', 'agar-freeze-thaw'],
    sources: [src('khymos', 'A'), src('arnoldAgar', 'A')],
    buy: [{ name: 'Super Agar, Modernist Pantry', url: 'https://modernistpantry.com/products/super-agar.html' }],
  },
  {
    id: 'gelatin', name: 'Gelatin', names: ['gelatin', 'gelatine', 'leaf gelatin', 'gelatin sheets'], vegan: false,
    what: 'An animal gel that melts in the mouth. Clarifies by freeze-thaw and holds siphon foams.',
    alcohol: 'Up to about 40%; needs more as alcohol rises',
    jobs: [
      { job: 'Freeze-thaw clarifying', dose: '0.5%', grade: 'A' },
      { job: 'Siphon foam', dose: '0.75%', grade: 'B' },
      { job: 'Jelly at 20% ABV (180 bloom)', dose: '2.4%', grade: 'A' },
    ],
    mix: 'Bloom in cold liquid, then dissolve at about 50 °C. Switching bloom strength: grams × old bloom ÷ new bloom.',
    watch: ['Fresh pineapple, kiwi, papaya, mango and ginger stop it setting.'],
    techniques: ['gelatin-freeze-thaw', 'siphon-foam'],
    sources: [src('khymos', 'A'), src('arnoldClarify', 'A')],
    buy: [{ name: 'PerfectaGel Silver sheets, 170 bloom, Modernist Pantry', url: 'https://modernistpantry.com/products/perfectagel-silver.html' }, { name: 'Beef gelatin powder, 250 bloom, Modernist Pantry', url: 'https://modernistpantry.com/products/beef-gelatin-powder-250-bloom.html' }],
  },
  {
    id: 'methylcellulose', name: 'Methylcellulose', names: ['methylcellulose', 'methyl cellulose', 'methocel', 'methocel f50', 'methylcellulose f50'], vegan: true, perTsp: 1.3,
    what: 'A plant-based foamer and thickener. The base of vegan foams and foaming sour syrups.',
    jobs: [
      { job: 'Sour syrup (foams on one shake)', dose: '0.5% of the syrup', grade: 'B' },
      { job: 'Siphon foam', dose: '0.6% with 0.1% xanthan', grade: 'A' },
      { job: 'Whipped foam (F50)', dose: '1 to 2%', grade: 'B' },
    ],
    mix: 'Disperse in a third of the water above 90 °C, then add the rest cold and stir 30 minutes. Rest cold for hours.',
    watch: ['It sets when hot and loosens when cold: the opposite of gelatin.', '"MC 40" isn’t a real grade; check the letter and number (F50, A4C).'],
    techniques: ['sour-syrup', 'vegan-siphon-foam'],
    sources: [src('punchSourSyrup', 'B'), src('tylopur', 'A')],
    buy: [{ name: 'Methocel F50, Modernist Pantry', url: 'https://modernistpantry.com/products/methocel-f50-food-grade.html' }],
  },
  {
    id: 'gellan', name: 'Gellan', names: ['gellan', 'gellan gum', 'low acyl gellan', 'high acyl gellan', 'gellan f'], vegan: true, perTsp: 1.9,
    what: 'Makes fluid gels that hold garnishes mid-glass, and firm, clear gels.',
    alcohol: 'Won’t dissolve in alcohol; hydrate in water first',
    jobs: [
      { job: 'Suspend a garnish', dose: '0.02 to 0.035%', grade: 'A' },
      { job: 'Spoonable fluid gel', dose: 'About 0.1%', grade: 'B' },
    ],
    mix: 'Heat to 90 to 95 °C with 0.1 to 0.3% sodium citrate; shear as it cools for a fluid gel.',
    techniques: ['suspension'],
    sources: [src('patentGellan', 'A'), src('khymos', 'A')],
    buy: [{ name: 'Gellan Gum F (low acyl), Modernist Pantry', url: 'https://modernistpantry.com/products/gellan-gum-f-low-acyl-gellan-gum.html' }, { name: 'Gellan LT100 (high acyl), Modernist Pantry', url: 'https://modernistpantry.com/products/gellan-gum-lt100-high-acyl-gellan-gum.html' }],
  },
  {
    id: 'alginate', name: 'Sodium alginate', names: ['sodium alginate', 'alginate'], vegan: true, perTsp: 3.5,
    what: 'Forms a skin with calcium: spheres and caviar.',
    jobs: [
      { job: 'Reverse spheres bath', dose: '0.5 to 0.7%', grade: 'A' },
      { job: 'Direct spheres, in the liquid', dose: '0.5 to 1%', grade: 'A' },
    ],
    mix: 'Blend into distilled water and rest an hour for the bubbles to clear.',
    watch: ['Fails below about pH 3.65: use reverse spheres for acidic or boozy liquids.'],
    techniques: ['reverse-spheres'],
    sources: [src('khymos', 'A'), src('mpSpheres', 'A')],
    buy: [{ name: 'Sodium alginate, Modernist Pantry', url: 'https://modernistpantry.com/products/sodium-alginate.html' }],
  },
  {
    id: 'calcium', name: 'Calcium lactate', names: ['calcium lactate', 'calcium chloride', 'calcium lactate gluconate'], vegan: true,
    what: 'The calcium that sets alginate.',
    jobs: [{ job: 'In the liquid, for reverse spheres', dose: '1 to 2% lactate', grade: 'A' }],
    mix: 'Dissolves easily. 0.5% chloride sets like about 1% lactate, which tastes cleaner.',
    techniques: ['reverse-spheres'],
    sources: [src('khymos', 'A')],
    buy: [{ name: 'Calcium lactate, Modernist Pantry', url: 'https://modernistpantry.com/products/calcium-lactate.html' }],
  },
  {
    id: 'lecithin', name: 'Soy lecithin', names: ['soy lecithin', 'lecithin', 'sunflower lecithin'], vegan: true, allergens: ['Soy (sunflower avoids it)'],
    what: 'Makes light, short-lived airs on thin liquids.',
    alcohol: 'Weak in strong alcohol',
    jobs: [{ job: 'Air', dose: '0.3 to 0.8%', grade: 'A' }],
    mix: 'Whisk in, then blend at the surface.',
    techniques: ['lecithin-air'],
    sources: [src('afmeLecithin', 'A')],
    buy: [{ name: 'Soy lecithin powder, Modernist Pantry', url: 'https://modernistpantry.com/products/soy-lecithin-powder.html' }, { name: 'Organic sunflower lecithin, Modernist Pantry', url: 'https://modernistpantry.com/products/organic-sunflower-lecithin-powder.html' }],
  },
  {
    id: 'versawhip', name: 'Versawhip', names: ['versawhip', 'versawhip 600k'], vegan: true, allergens: ['Soy'],
    what: 'A soy protein foamer, about twice as airy as egg white and very acid tolerant.',
    alcohol: 'Weakens as alcohol rises',
    jobs: [
      { job: 'Siphon or whipped foam', dose: '0.5 to 2% with 0.1 to 0.2% xanthan', grade: 'B' },
      { job: 'Bar foaming stock', dose: '4% with 0.2% xanthan', grade: 'B' },
    ],
    mix: 'Blend into cold liquid with the xanthan.',
    watch: ['Fat stops it foaming.'],
    techniques: ['siphon-foam'],
    sources: [src('mpFoams', 'B')],
    buy: [{ name: 'Versawhip 600K, Modernist Pantry', url: 'https://modernistpantry.com/products/versawhip-600k.html' }],
  },
  {
    id: 'aquafaba', name: 'Aquafaba', names: ['aquafaba', 'chickpea water'], vegan: true, allergens: ['Chickpea'],
    what: 'The liquid from a tin of chickpeas: a vegan egg white for sours.',
    jobs: [{ job: 'Sour foam', dose: '22 to 30 ml per drink', grade: 'B' }],
    mix: 'Shake it in, reverse dry shake. Freeze extra in 30 ml portions.',
    watch: ['Fat kills it. Shorter-lived than egg.'],
    techniques: ['reverse-dry-shake'],
    sources: [src('punchFoamers', 'B')],
  },
  {
    id: 'quillaja', name: 'Foamer drops (quillaja)', names: ['foamer', 'cocktail foamer', 'quillaja', 'instafoam', 'wonderfoam', 'ripples foamer'], vegan: true,
    what: 'A few drops of tree-bark saponin give a vegan sour its head.',
    alcohol: 'Fine with alcohol and acid',
    jobs: [{ job: 'Sour foam', dose: '2 to 6 drops (start with 3)', grade: 'B' }],
    mix: 'Add with the other ingredients and shake.',
    watch: ['Too much affects the aroma.', 'Fee Foam is polysorbate 80, not quillaja.'],
    techniques: ['reverse-dry-shake'],
    sources: [src('punchFoamers', 'B')],
    buy: [{ name: 'Wonderfoam (quillaja), Boston General Store', url: 'https://www.bostongeneralstore.com/products/wonderfoam-cocktail-foam' }, { name: 'Fee Foam (polysorbate, not quillaja), WebstaurantStore', url: 'https://www.webstaurantstore.com/fee-brothers-5-fl-oz-cocktail-fee-foam/115BITFBFOAM.html' }],
  },
  {
    id: 'gum-arabic', name: 'Gum arabic', names: ['gum arabic', 'acacia gum', 'gum acacia'], vegan: true,
    what: 'Gives gomme syrup its silky body; stable from very acid to neutral.',
    alcohol: 'Won’t dissolve in alcohol or fat',
    jobs: [{ job: 'Gomme syrup', dose: 'About 10% of the syrup', grade: 'B' }],
    mix: 'Soak in water up to 48 hours before adding to hot syrup.',
    techniques: ['gomme'],
    sources: [src('imbibeGomme', 'B')],
    buy: [{ name: 'Gum arabic, Modernist Pantry', url: 'https://modernistpantry.com/products/arabic-gum-acacia-gum.html' }],
  },
  {
    id: 'pectinase', name: 'Pectinex Ultra SP-L', names: ['pectinex', 'pectinex ultra sp-l', 'pectinase', 'pectic enzyme'], vegan: true,
    what: 'An enzyme that breaks down pectin so fruit can be spun or settled clear.',
    jobs: [{ job: 'Before centrifuging fruit', dose: '2 g per kg (2 ml per litre of juice)', grade: 'A' }],
    mix: 'Stir in and rest 20 to 30 minutes.',
    watch: ['Lime and lemon are too acidic for it alone; add kieselsol and chitosan.', 'Generic home-brew pectinase isn’t a substitute.'],
    techniques: ['centrifuge'],
    sources: [src('arnoldClarify', 'A'), src('mpKit', 'B')],
    buy: [{ name: 'Pectinex Ultra SP-L, Modernist Pantry', url: 'https://modernistpantry.com/products/pectinex-ultra-sp-l.html' }, { name: 'Pectinex Ultra SP-L, Special Ingredients (EU)', url: 'https://specialingredients.it/en/products/pectinex-ultra-sp-l-1-l' }],
  },
  {
    id: 'maltodextrin', name: 'Tapioca maltodextrin', names: ['tapioca maltodextrin', 'n-zorbit', 'maltodextrin'], vegan: true,
    what: 'Turns fats into powders.',
    jobs: [{ job: 'Fat powder', dose: '40% to 60% fat, by weight', grade: 'B' }],
    mix: 'Whisk into melted fat, then sieve.',
    techniques: ['fat-powder'],
    sources: [src('mpPowders', 'B')],
    buy: [{ name: 'N-Zorbit M, Modernist Pantry', url: 'https://modernistpantry.com/products/n-zorbit-m-tapioca-maltodextrin.html' }],
  },
  {
    id: 'citric', name: 'Citric acid', names: ['citric acid'], vegan: true,
    what: 'Lemon’s main acid. With malic, it turns other juices lime-sharp.',
    jobs: [
      { job: 'Orange to lime', dose: '3.2 g citric + 2 g malic per 100 ml', grade: 'B' },
      { job: 'Acid solution', dose: '10 g citric + 5 g malic in 85 g water', grade: 'B' },
    ],
    mix: 'Dissolves straight into juice or water.',
    techniques: ['acid-adjust'],
    sources: [src('mpAcid', 'B'), src('campariAcid', 'B')],
    buy: [{ name: 'Citric acid, Modernist Pantry', url: 'https://modernistpantry.com/products/citric-acid.html' }],
  },
  {
    id: 'malic', name: 'Malic acid', names: ['malic acid'], vegan: true,
    what: 'Apple’s acid, the green, lingering sharpness in lime.',
    jobs: [{ job: 'Orange to lime', dose: '2 g per 100 ml with 3.2 g citric', grade: 'B' }],
    mix: 'Dissolves straight into juice or water.',
    techniques: ['acid-adjust'],
    sources: [src('mpAcid', 'B')],
    buy: [{ name: 'Malic acid, Modernist Pantry', url: 'https://modernistpantry.com/products/malic-acid.html' }],
  },
  {
    id: 'sodium-citrate', name: 'Sodium citrate', names: ['sodium citrate', 'trisodium citrate'], vegan: true,
    what: 'Tames calcium and acidity so gels and spheres set.',
    jobs: [{ job: 'With gellan', dose: '0.1 to 0.3%', grade: 'A' }],
    mix: 'Dissolve with the gum.',
    techniques: ['suspension'],
    sources: [src('khymos', 'A')],
    buy: [{ name: 'Sodium citrate, Modernist Pantry', url: 'https://modernistpantry.com/products/sodium-citrate.html' }],
  },
  {
    id: 'glycerin', name: 'Glycerin', names: ['glycerin', 'glycerine', 'glycerol', 'vegetable glycerin'], vegan: true,
    what: 'Adds body with little sweetness.',
    jobs: [{ job: 'Body in liqueurs', dose: 'Up to about 1.5% by volume', grade: 'C' }],
    mix: 'Mixes freely.',
    watch: ['EFSA set a 2026 limit of 125 mg per kg of body weight per drinking occasion (about 7.5 g for 60 kg).'],
    techniques: ['body-syrup'],
    sources: [src('brewhausGlycerin', 'C'), src('efsaGlycerol', 'A')],
    buy: [{ name: 'Vegetable glycerin USP, Bulk Apothecary', url: 'https://www.bulkapothecary.com/glycerin/' }],
  },
  {
    id: 'sucro', name: 'Sucrose esters', names: ['sucrose esters', 'sucrose ester', 'sucro', 'sucro emul'], vegan: true,
    what: 'Sugar bonded to fatty acids: makes airs and foams that hold up in strong spirit, where lecithin gives out.',
    alcohol: 'Works in straight spirit',
    jobs: [
      { job: 'Air on juice or citrus', dose: '0.5 to 1%', grade: 'B' },
      { job: 'Foam on a straight spirit', dose: 'About 2% (1 g per 50 ml)', grade: 'B' },
    ],
    mix: 'Dissolve it in the water part first (warm is faster), then blend in the rest. It won’t dissolve in fat.',
    techniques: ['lecithin-air'],
    sources: [src('sosaSucro', 'B'), src('siAlcoholFoam', 'B')],
    buy: [{ name: 'Sucrose esters, Modernist Pantry', url: 'https://modernistpantry.com/products/sucrose-esters.html' }, { name: 'Sucro, Special Ingredients (EU)', url: 'https://specialingredients.it/en/products/sucro-100g' }],
  },
  {
    id: 'kieselsol-chitosan', name: 'Kieselsol and chitosan', names: ['kieselsol', 'chitosan', 'kieselsol and chitosan', 'super-kleer', 'super kleer'], vegan: true, allergens: ['Shellfish (in most chitosan; fungal chitosan avoids it)'],
    what: 'Two wine finings with opposite charges that clump what the enzyme can’t, so lime and lemon spin clear.',
    jobs: [{ job: 'Lime or lemon before centrifuging', dose: '2 ml kieselsol, 2 ml chitosan, 2 ml kieselsol per litre, 15 minutes apart', grade: 'B' }],
    mix: 'Stir each in gently. Powdered chitosan is made into a solution first: 5 g blended into 400 ml water with 100 ml white vinegar, kept cold.',
    watch: ['Kieselsol must not freeze.', 'Shellfish chitosan isn’t vegan; Modernist Pantry’s is from a fungus.'],
    techniques: ['centrifuge'],
    sources: [src('mpKit', 'B')],
    buy: [{ name: 'Kieselsol, Modernist Pantry', url: 'https://modernistpantry.com/products/kieselsol.html' }, { name: 'Chitosan (plant-based), Modernist Pantry', url: 'https://modernistpantry.com/products/chitosan-plant-based.html' }, { name: 'Super-Kleer KC (shellfish chitosan), Northern Brewer', url: 'https://www.northernbrewer.com/products/super-kleer-kc-finings' }],
  },
];

const BY_NAME = new Map(TECHNICAL_INGREDIENTS.flatMap((t) => t.names.map((n) => [n, t] as const)));

/** The technical ingredient an ingredient's name is, if any ("Xanthan Gum" → xanthan). */
export function technicalIngredientFor(name: string | null | undefined): TechnicalIngredient | undefined {
  return BY_NAME.get((name ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
}
