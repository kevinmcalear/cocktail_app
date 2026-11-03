/**
 * The names the lab ingredients go by (lib/techniques/ingredients.ts holds the
 * rest). Kept apart because My Bar sorts every ingredient by name on the first
 * screen, and the 27 KB of notes and doses beside them load only with the lab pages.
 */
export const LAB_NAMES = {
  xanthan: ['xanthan', 'xanthan gum'],
  agar: ['agar', 'agar agar', 'agar-agar'],
  gelatin: ['gelatin', 'gelatine', 'leaf gelatin', 'gelatin sheets'],
  methylcellulose: ['methylcellulose', 'methyl cellulose', 'methocel', 'methocel f50', 'methylcellulose f50'],
  gellan: ['gellan', 'gellan gum', 'low acyl gellan', 'high acyl gellan', 'gellan f'],
  alginate: ['sodium alginate', 'alginate'],
  calcium: ['calcium lactate', 'calcium chloride', 'calcium lactate gluconate'],
  lecithin: ['soy lecithin', 'lecithin', 'sunflower lecithin'],
  versawhip: ['versawhip', 'versawhip 600k'],
  aquafaba: ['aquafaba', 'chickpea water'],
  quillaja: ['foamer', 'cocktail foamer', 'quillaja', 'instafoam', 'wonderfoam', 'ripples foamer'],
  pectinase: ['pectinex', 'pectinex ultra sp-l', 'pectinase', 'pectic enzyme'],
  maltodextrin: ['tapioca maltodextrin', 'n-zorbit', 'maltodextrin'],
  citric: ['citric acid'],
  malic: ['malic acid'],
  glycerin: ['glycerin', 'glycerine', 'glycerol', 'vegetable glycerin'],
  sucro: ['sucrose esters', 'sucrose ester', 'sucro', 'sucro emul'],
  isomalt: ['isomalt', 'isomalt crystals'],
  pectin: ['pectin', 'hm pectin', 'high methoxyl pectin', 'yellow pectin', 'apple pectin', 'rapid set pectin'],
  cal: ['calcium hydroxide', 'cal', 'pickling lime', 'slaked lime', 'food grade lime'],
  koji: ['rice koji', 'koji', 'dried rice koji', 'koji rice'],
  'gum-arabic': ['gum arabic', 'acacia gum', 'gum acacia'],
  'sodium-citrate': ['sodium citrate', 'trisodium citrate'],
  'kieselsol-chitosan': ['kieselsol', 'chitosan', 'kieselsol and chitosan', 'super-kleer', 'super kleer'],
  'kefir-grains': ['water kefir grains', 'kefir grains', 'tibicos'],
};

/** What each is called on its page, and in My Bar's lab ideas. */
export const LAB_TITLES = {
  'xanthan': 'Xanthan gum',
  'agar': 'Agar',
  'gelatin': 'Gelatin',
  'methylcellulose': 'Methylcellulose',
  'gellan': 'Gellan',
  'alginate': 'Sodium alginate',
  'calcium': 'Calcium lactate',
  'lecithin': 'Soy lecithin',
  'versawhip': 'Versawhip',
  'aquafaba': 'Aquafaba',
  'quillaja': 'Foamer drops (quillaja)',
  'gum-arabic': 'Gum arabic',
  'pectinase': 'Pectinex Ultra SP-L',
  'maltodextrin': 'Tapioca maltodextrin',
  'citric': 'Citric acid',
  'malic': 'Malic acid',
  'sodium-citrate': 'Sodium citrate',
  'glycerin': 'Glycerin',
  'sucro': 'Sucrose esters',
  'kieselsol-chitosan': 'Kieselsol and chitosan',
  'isomalt': 'Isomalt',
  'pectin': 'HM pectin',
  'cal': 'Calcium hydroxide (cal)',
  'koji': 'Rice koji',
  'kefir-grains': 'Water kefir grains',
} as const;

const BY_NAME = new Map(Object.entries(LAB_NAMES).flatMap(([id, names]) => names.map((n) => [n, id] as const)));

/** The lab ingredient's id for a name ("Xanthan Gum" is "xanthan"), if it is one. */
export function labIdFor(name: string | null | undefined): string | undefined {
  return BY_NAME.get((name ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
}

/** True when a name is one of the lab ingredients'. */
export const isLabName = (name: string | null | undefined) => labIdFor(name) !== undefined;
