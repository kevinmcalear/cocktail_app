// Beer and wine drawn like the drinks: the same rules, fed a one-line pour.
// Beer and wine have no drawing inputs stored (item_sketches holds cocktails),
// so their tiles work them out here from the name and the glass.
import { draftSketchInputs } from './draft';
import type { SketchInputs } from './types';

const RED = /\b(red|shiraz|syrah|cabernet|merlot|pinot noir|malbec|grenache|tempranillo|sangiovese|nebbiolo|gamay|zinfandel|rioja|chianti|barolo|beaujolais|claret|rosso|tinto|rouge|nero d'avola|primitivo|montepulciano|cotes du rhone|c[oô]tes du rh[oô]ne)\b/i;
const SPARKLING = /\b(sparkling|champagne|prosecco|cava|cr[eé]mant|sekt|lambrusco|p[eé]t[- ]?nat)\b/i;

/** What the rules should read a wine as, from its name: sparkling, rosé, orange, red, else white. */
export function wineStyle(name: string): string {
  if (SPARKLING.test(name)) return /ros[eé]/i.test(name) ? 'sparkling rosé' : 'sparkling wine';
  if (/ros[eé]/i.test(name)) return 'rosé';
  if (/\borange\b|skin contact/i.test(name)) return 'orange wine';
  return RED.test(name) ? 'red wine' : 'white wine';
}

/** A beer or a wine's drawing: its glass (a pint or a wine glass unless it has one), poured, no ice. */
export function pourSketch(kind: 'Beer' | 'Wine', name: string, glass?: string | null): SketchInputs {
  const beer = kind === 'Beer';
  const line = beer ? (/\b(beer|ale|ipa|lager|stout|porter|pilsner|cider)\b/i.test(name) ? name : `${name} beer`) : wineStyle(name);
  const sparkling = !beer && SPARKLING.test(name);
  const inputs = draftSketchInputs({
    name,
    glass: glass ?? (beer ? 'Pint' : sparkling ? 'Flute' : 'Wine glass'),
    ice: null,
    methods: ['Build'],
    lines: [{ name: line, amount: beer ? 425 : 150, unit: 'ml' }],
  });
  // Every beer pours with a head, as on its page (lib/beerWineWizard.ts beerWineSketch): a stout's is tan.
  return beer ? { ...inputs, foam: /\b(stout|porter)\b/i.test(name) ? 'crema' : 'cap' } : inputs;
}
