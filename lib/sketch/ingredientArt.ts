// Which drawing an ingredient gets: a bottle, a jar, or a small still life,
// picked from its own name and then the kinds above it ("Lime Juice", "Lime",
// "Citrus"). The first name a rule matches wins, so "Lime Cordial" is a
// corked bottle and "Lime Juice" a cut lime. Same ingredient, same drawing.

import { PANTRY } from '@/constants/pantry';

import type { BottleInputs, BottleShapeKey } from './bottle';
import type { Grain, ProduceInputs } from './produce';
import { hashString, rng } from './random';

export type IngredientArt = { kind: 'bottle'; inputs: BottleInputs } | { kind: 'produce'; inputs: ProduceInputs };

type Liquid = BottleInputs['liquid'];
const L = (hex: string, alpha: number): Liquid => ({ hex, alpha });
const CLEAR = L(PANTRY.clearSpirit, 0.05);
const GOLD = L(PANTRY.gold, 0.55);
const AMBER = L(PANTRY.amber, 0.8);
const DARK = L(PANTRY.dark, 1);

// Colours of things, for produce and for what a syrup or liqueur is made from.
const COLOURS: [RegExp, string][] = [
  [/blood orange/, PANTRY.bloodOrange], [/grapefruit|pomelo/, PANTRY.grapefruit], [/\blime|makrut|kaffir/, PANTRY.lime], [/lemon(?!grass)/, PANTRY.lemon],
  [/orange|mandarin|clementine|tangerine|satsuma/, PANTRY.orange], [/yuzu|sudachi|calamansi|kumquat|citron|bergamot/, PANTRY.yuzu],
  [/strawberr/, PANTRY.strawberry], [/raspberr/, PANTRY.raspberry], [/blackberr|blackcurrant|cassis|mulberr/, PANTRY.blackberry], [/blueberr/, PANTRY.blueberry],
  [/cranberr|pomegranate|redcurrant/, PANTRY.cranberry], [/cherr/, PANTRY.cherry], [/grape/, PANTRY.grape], [/olive/, PANTRY.olive],
  [/pineapple/, PANTRY.pineapple], [/green apple/, PANTRY.lime], [/apple/, PANTRY.redApple], [/pear/, PANTRY.pear], [/peach|apricot|nectarine/, PANTRY.peach],
  [/plum|umeboshi|\bume\b/, PANTRY.plum], [/banana/, PANTRY.yuzu], [/mango/, PANTRY.mango], [/passion ?fruit/, PANTRY.passionFruit], [/watermelon/, PANTRY.watermelon],
  [/melon/, PANTRY.melon], [/\bfig/, PANTRY.fig], [/coconut/, PANTRY.coconut], [/lychee|guava/, PANTRY.lychee], [/kiwi/, PANTRY.kiwi],
  [/tomato/, PANTRY.tomato], [/cucumber|celery/, PANTRY.cucumber], [/chil+i|jalape|habanero|chipotle|pepper(?!corn)/, PANTRY.chilli], [/carrot/, PANTRY.carrot],
  [/ginger/, PANTRY.ginger], [/rhubarb/, PANTRY.rhubarb], [/beet/, PANTRY.beet], [/hibiscus/, PANTRY.hibiscus], [/rose(?!mary)/, PANTRY.rosePetal],
  [/lavender|violet/, PANTRY.lavender], [/butterfly pea/, PANTRY.butterflyPea], [/elderflower|chamomile|jasmine|blossom/, PANTRY.paleFlower],
  [/\bmint|basil|shiso|herb/, PANTRY.mint], [/matcha/, PANTRY.matcha], [/coffee|espresso|cacao|chocolate|cocoa/, PANTRY.cocoa],
  [/vanilla/, PANTRY.vanilla], [/cinnamon/, PANTRY.cinnamon], [/honey/, PANTRY.honey], [/maple|caramel|molasses|brown sugar|demerara|muscovado/, PANTRY.caramel],
  [/almond|orgeat|horchata/, PANTRY.almond], [/pistachio/, PANTRY.pistachio], [/hazelnut|walnut|pecan|peanut|nut/, PANTRY.nut],
];
const colourOf = (name: string): string | null => COLOURS.find(([re]) => re.test(name))?.[1] ?? null;

const bottle = (shape: BottleShapeKey, liquid: Liquid, more: Partial<BottleInputs> = {}): IngredientArt => ({ kind: 'bottle', inputs: { shape, liquid, ...more } });
const produce = (inputs: ProduceInputs): IngredientArt => ({ kind: 'produce', inputs });
const heap = (color: string, grain: Grain) => produce({ kind: 'heap', color, grain });
const tinted = (name: string, fallback: Liquid, alpha = 0.85): Liquid => { const c = colourOf(name); return c ? L(c, alpha) : fallback; };
const aged = (n: string) => /reposado|gold|dorado/.test(n) ? GOLD : /añejo|anejo|aged|dark|black|spiced|navy|overproof|extra|\d+ ?(year|yr|anos|años)/.test(n) ? AMBER : null;

// Each rule sees one lower-case name; earlier rules win.
const RULES: [RegExp, (n: string) => IngredientArt][] = [
  // containers first: what it's in matters more than what it's made of
  [/bitters/, (n) => bottle('dasher', /orange|peach|celery|lavender/.test(n) ? tinted(n, DARK, 0.7) : DARK)],
  [/liqueur|cr[eè]me de|schnapps|triple sec|cura[cç]ao|amaretto|limoncello/, (n) => bottle(/cr[eè]me de/.test(n) ? 'longneck' : 'decanter', tinted(n, GOLD))],
  [/syrup|cordial|shrub|tincture|oleo|sherbet|gomme|orgeat|falernum|grenadine|saline|acid|solution|infusion|reduction/, (n) => bottle('apothecary', /saline|acid|solution/.test(n) ? CLEAR : tinted(n, GOLD, 0.7), { cap: PANTRY.cork, label: PANTRY.kraft })],
  [/honey|jam|marmalade|preserve|jelly|compote|pickle|curd|brine|miso|paste|chutney|kimchi|nectar/, (n) => bottle('jar', tinted(n, L(PANTRY.honey, 0.9), 0.9), { cap: PANTRY.brassCap })],
  [/cream soda|root beer|tonic|soda|ginger beer|ginger ale|\bcola\b|lemonade|kombucha|sparkling|seltzer|mineral water|chinotto|sarsaparilla/, (n) => bottle('mixer', /\bcola\b|root beer|sarsaparilla|chinotto/.test(n) ? DARK : tinted(n, CLEAR, 0.4))],
  [/\bbeer|lager|\bale\b|stout|porter|\bipa\b|pilsner|cider|kvass/, (n) => bottle('beer', /stout|porter/.test(n) ? DARK : /cider/.test(n) ? GOLD : AMBER, { glass: /stout|porter|lager|ale|beer/.test(n) ? PANTRY.beerGlass : null })],
  [/\bmilk|cream|half and half|buttermilk|kefir|yog/, () => bottle('milk', L(PANTRY.milk, 1), { cap: PANTRY.milkCap })],
  // spirits and wine
  [/vermouth|aromatised|aromatized|quinquina|americano|chinato/, (n) => bottle('longneck', /dry|blanc|bianco|white/.test(n) ? L(PANTRY.paleWine, 0.45) : L(PANTRY.sweetVermouth, 1), { label: PANTRY.vermouthLabel })],
  [/bitter aperitivo|aperitivo|campari|aperol/, (n) => bottle('longneck', /aperol/.test(n) ? L(PANTRY.carrot, 0.85) : L(PANTRY.campari, 0.9))],
  [/amar[oi]|fernet|china|averna|montenegro/, () => bottle('longneck', DARK)],
  [/sherry|\bport\b|madeira|marsala/, (n) => bottle('longneck', /fino|manzanilla/.test(n) ? L(PANTRY.paleWine, 0.5) : AMBER, { glass: PANTRY.brownGlass })],
  [/ros[eé] wine|\bros[eé]\b/, () => bottle('longneck', L(PANTRY.roseWine, 0.6), { glass: null })],
  [/champagne|prosecco|cava|sparkling wine|cr[eé]mant/, () => bottle('longneck', L(PANTRY.paleWine, 0.45), { glass: PANTRY.greenGlass, cap: PANTRY.foil })],
  [/red wine|\bwine\b/, (n) => bottle('longneck', /white|blanc|riesling|sauvignon|chardonnay/.test(n) ? L(PANTRY.paleWine, 0.45) : L(PANTRY.redWine, 1), { glass: PANTRY.greenGlass })],
  [/sake|shochu|soju|baijiu|makgeolli/, () => bottle('squat', CLEAR)],
  [/absinthe|chartreuse|g[eé]n[eé]pi/, (n) => bottle('decanter', /yellow|jaune/.test(n) ? L(PANTRY.lemon, 0.8) : L(PANTRY.greenChartreuse, 0.85))],
  [/vodka/, () => bottle('tall', CLEAR)],
  [/\bgin\b|genever|jenever/, (n) => bottle('gin', /sloe|old tom|barrel/.test(n) ? tinted(n, GOLD) : CLEAR)],
  [/tequila|mezcal|agave|sotol|raicilla|bacanora/, (n) => bottle('squat', aged(n) ?? CLEAR)],
  [/cacha[cç]a|agricole|clairin|\brum|rhum|ron\b/, (n) => bottle(/agricole|clairin|pot still|jamaica/.test(n) ? 'squat' : 'tall', aged(n) ?? (/white|blanc|silver|light|cacha|clairin/.test(n) ? CLEAR : AMBER))],
  [/pisco|grappa|eau de vie|kirsch|singani|arak|ouzo|aquavit|akvavit|pastis/, () => bottle('decanter', CLEAR)],
  [/whisk|bourbon|\brye\b|scotch|single malt|blended malt/, (n) => bottle(hashString(n) % 3 ? 'tall' : 'decanter', AMBER)],
  [/brandy|cognac|armagnac|calvados|applejack/, () => bottle('decanter', AMBER)],
  // things you'd find in the kitchen
  [/\begg|aquafaba/, () => produce({ kind: 'egg', color: PANTRY.egg })],
  [/blood orange|grapefruit|pomelo|\blime|lemon(?!grass)|orange|mandarin|clementine|tangerine|satsuma|yuzu|sudachi|calamansi|kumquat|citron|bergamot|citrus/, (n) => produce({ kind: 'citrus', color: colourOf(n) ?? PANTRY.lemon, accent: /blood/.test(n) ? PANTRY.bloodOrangeFlesh : null })],
  [/berr|cassis|currant|cherr|grape|olive(?! oil)/, (n) => produce({ kind: 'berries', color: colourOf(n) ?? PANTRY.berry, berry: /strawberr/.test(n) ? 'strawberry' : /raspberr|blackberr|mulberr|boysenberr|loganberr|dewberr/.test(n) ? 'drupe' : 'round' })],
  [/cucumber|zucchini|courgette|celery|chil+i|jalape|habanero|banana|carrot|ginger|rhubarb|lemongrass|bell pepper|okra/, (n) => produce({ kind: 'long', color: colourOf(n) ?? PANTRY.cucumber, cut: /cucumber|zucchini|courgette/.test(n) })],
  [/rosemary|thyme|dill|tarragon|fennel|pine(?!apple)|cedar|hinoki/, (n) => produce({ kind: 'sprig', color: /pine|cedar|hinoki/.test(n) ? PANTRY.pine : PANTRY.rosemary, leaf: 'narrow' })],
  [/\bmint|basil|sage|shiso|cilantro|coriander leaf|\bbay\b|herb|leaf|nettle|sorrel/, (n) => produce({ kind: 'sprig', color: /sage/.test(n) ? PANTRY.sage : PANTRY.mint, leaf: 'broad' })],
  [/rose(?!mary)|hibiscus|elderflower|lavender|violet|chamomile|jasmine|butterfly pea|marigold|blossom|flower|geranium|chrysanthemum|meadowsweet|yarrow/, (n) => produce({ kind: 'flower', color: colourOf(n) ?? PANTRY.pinkFlower })],
  [/cinnamon|vanilla|cassia/, (n) => heap(colourOf(n) ?? PANTRY.cinnamon, 'stick')],
  [/coffee|espresso|cacao nib/, () => heap(PANTRY.coffee, 'bean')],
  [/\btea\b|matcha|hojicha|genmaicha|rooibos/, (n) => (/matcha/.test(n) ? heap(PANTRY.matcha, 'powder') : heap(PANTRY.tea, 'leaf'))],
  [/chocolate|cacao|cocoa|carob/, (n) => produce({ kind: 'bar', color: /white/.test(n) ? PANTRY.whiteChocolate : PANTRY.chocolate })],
  [/butter/, () => produce({ kind: 'bar', color: PANTRY.butter })],
  [/salt|msg/, () => heap(PANTRY.salt, 'crystal')],
  [/sugar|demerara|muscovado|turbinado|panela|jaggery/, (n) => heap(/brown|demerara|muscovado|turbinado|panela|jaggery/.test(n) ? PANTRY.brownSugar : PANTRY.whiteSugar, 'crystal')],
  [/nutmeg|star anise|cardamom|clove|allspice|peppercorn|black pepper|juniper/, (n) => heap(/cardamom/.test(n) ? PANTRY.pistachio : /pepper|clove|juniper/.test(n) ? PANTRY.pepper : PANTRY.wholeSpice, 'nut')],
  [/almond|walnut|pistachio|hazelnut|pecan|peanut|macadamia|cashew|chestnut|\bnut\b/, (n) => heap(colourOf(n) ?? PANTRY.nut, 'nut')],
  [/\brice|\boat|barley|corn|buckwheat|grain|popcorn|sesame/, (n) => heap(/corn|popcorn/.test(n) ? PANTRY.yuzu : PANTRY.grain, 'nut')],
  [/spice|paprika|turmeric|cumin|saffron|powder|pepper/, (n) => heap(/paprika|chil|saffron/.test(n) ? PANTRY.paprika : /turmeric/.test(n) ? PANTRY.turmeric : PANTRY.spice, 'powder')],
  [/vinegar|verjus|\boil\b/, (n) => bottle('apothecary', /oil/.test(n) ? L(PANTRY.oliveOil, 0.7) : L(PANTRY.paleWine, 0.4), { cap: PANTRY.cork, label: PANTRY.kraft })],
  [/juice|fruit|apple|pear|peach|apricot|plum|mango|passion|melon|fig|coconut|lychee|guava|kiwi|tomato|pineapple|pomegranate|beet|quince|persimmon|papaya/, (n) => produce({ kind: 'fruit', color: colourOf(n) ?? PANTRY.fruit })],
  // last, so they only catch names nothing above knows
  [/hot sauce|salsa picante|tabasco|sriracha|cholula|valentina|buldak|soy sauce|\bsoy\b|tamari|teriyaki|tsuyu|worcestershire|fish sauce|garum|ponzu|oyster sauce|hoisin|marinade|\bsauce/, (n) => bottle('sauce', /hot|picante|tabasco|sriracha|cholula|valentina|buldak|chil/.test(n) ? L(PANTRY.hotSauce, 0.95) : /white soy/.test(n) ? GOLD : L(PANTRY.soySauce, 1), { label: PANTRY.vermouthLabel })],
  [/seed|pollen/, (n) => /pollen/.test(n) ? heap(PANTRY.pollen, 'crystal') : heap(/black/.test(n) ? PANTRY.pepper : /mustard/.test(n) ? PANTRY.yuzu : PANTRY.grain, 'nut')],
  [/caramel|toffee|dulce de leche|molasses|treacle|\bmole\b|mustard|chamoy|custard|kaya|marmite|vegemite|doenjang|gochujang|tahin/, (n) => bottle('jar', /molasses|treacle|\bmole\b|marmite|vegemite|doenjang/.test(n) ? DARK : /mustard|custard|kaya/.test(n) ? L(PANTRY.yuzu, 0.9) : /chamoy|gochujang/.test(n) ? L(PANTRY.chilli, 0.9) : L(PANTRY.caramel, 0.95), { cap: PANTRY.brassCap })],
  [/chees|parmesan|parmigiano|grana padano|ricotta|fett?a|mascarpone|burrata|cheddar|queso|quesillo|pecorino|gruy[eè]re|comt[eé]/, (n) => produce({ kind: 'wedge', color: /ricotta|feta|fetta|mascarpone|burrata|fresco|blanco/.test(n) ? PANTRY.garlic : PANTRY.cheese, accent: PANTRY.cheeseRind })],
  [/dairy|whey|cr[eè]me fra[iî]che|soymilk|oat milk/, () => bottle('milk', L(PANTRY.milk, 1), { cap: PANTRY.milkCap })],
  [/mushroom|fung|shiitake|porcini|chanterelle|matsutake|candy cap|enoki|morel|maitake|lion'?s mane|chicken of the woods/, (n) => produce({ kind: 'mushroom', color: /chanterelle|candy cap|chicken of the woods/.test(n) ? PANTRY.chanterelle : /snow|enoki|white|lion/.test(n) ? PANTRY.paleMushroom : /shiitake|matsutake|black/.test(n) ? PANTRY.shiitake : PANTRY.porcini, cap: /chanterelle|candy cap/.test(n) ? 'funnel' : 'dome' })],
  [/truffle/, (n) => produce({ kind: 'root', rough: true, color: /white/.test(n) ? PANTRY.whiteTruffle : PANTRY.truffle })],
  [/potato|\bube\b|taro|\byam\b|mashua|\boca\b|parsnip|turnip|radish|horseradish|ginseng|cassava|yuca|jicama|\broot\b/, (n) => produce({ kind: 'root', color: /ube|purple/.test(n) ? PANTRY.ube : /sweet potato|radish/.test(n) ? PANTRY.sweetPotato : /taro/.test(n) ? PANTRY.taro : /parsnip|turnip|horseradish|ginseng|jicama/.test(n) ? PANTRY.paleMushroom : PANTRY.potato })],
  [/green onion|spring onion|scallion|\bleek|chive|\bramp/, () => produce({ kind: 'bulb', bulb: 'scallion', color: PANTRY.mint })],
  [/onion|shallot|garlic/, (n) => produce({ kind: 'bulb', bulb: /garlic/.test(n) ? 'garlic' : 'onion', color: /black garlic/.test(n) ? PANTRY.blackGarlic : /garlic/.test(n) ? PANTRY.garlic : /red|shallot/.test(n) ? PANTRY.redOnion : /cocktail|pearl|white/.test(n) ? PANTRY.garlic : PANTRY.onion })],
  [/seaweed|kombu|kelp|wakame|\bnori\b|dulse|sea lettuce|hijiki|furikake|dashi|samphire/, () => produce({ kind: 'seaweed', color: PANTRY.kelp })],
  [/pumpkin|squash|tomatillo|zucca|chayote/, (n) => produce({ kind: 'fruit', color: /tomatillo|chayote/.test(n) ? PANTRY.lime : PANTRY.carrot })],
  [/tobacco|oak\b|barrel|mizunara|amburana|wood|bark/, (n) => /tobacco/.test(n) ? heap(PANTRY.tobacco, 'leaf') : heap(PANTRY.wood, 'stick')],
  [/\bmalt\b|milo/, () => heap(PANTRY.ginger, 'nut')],
  [/spirulina|chlorophyll|charcoal/, (n) => heap(/blue/.test(n) ? PANTRY.butterflyPea : /charcoal/.test(n) ? PANTRY.pepper : PANTRY.matcha, 'powder')],
  [/\bwater\b|energy drink|red bull|club-mate/, (n) => bottle('mixer', /energy|red bull|mate/.test(n) ? GOLD : CLEAR)],
  [/spirit|liqueur/, (n) => bottle('tall', tinted(n, GOLD))],
];

const BANDS = [PANTRY.redApple, PANTRY.navy, PANTRY.inkBand, PANTRY.brownBand, PANTRY.greenBand, PANTRY.wineBand];
const CAPS = [PANTRY.blackCap, PANTRY.redCap, PANTRY.brassCap, PANTRY.graphiteCap, PANTRY.navy];

/**
 * The drawing for an ingredient. `names` is its own name, then each kind above
 * it, nearest first; `role` is items.ingredient_role; `seed` is its id.
 */
export function ingredientArt(names: string[], role: string | null, seed: string): IngredientArt {
  let art: IngredientArt | null = null;
  for (const raw of names) {
    const n = raw.toLowerCase();
    const hit = RULES.find(([re]) => re.test(n));
    // a product is something you buy in a bottle or pack, never a lemon
    if (hit && !(role === 'product' && hit[1](n).kind === 'produce')) { art = hit[1](n); break; }
  }
  // a fat wash: whatever it was washed with, and a little bottle of oil behind
  if (art?.kind === 'produce' && names.some((x) => /fat[- ]?wash/i.test(x))) art = { kind: 'produce', inputs: { ...art.inputs, oil: true } };
  art ??= role === 'product' ? bottle('tall', GOLD) : bottle('apothecary', GOLD, { cap: PANTRY.cork, label: PANTRY.kraft });
  if (art.kind === 'bottle' && art.inputs.shape !== 'apothecary' && art.inputs.shape !== 'milk') {
    // a maker's bottle: its own cap and a band of colour on the label
    const r = rng(hashString(seed));
    art = { kind: 'bottle', inputs: { cap: CAPS[Math.floor(r() * CAPS.length)], band: r() < 0.7 ? BANDS[Math.floor(r() * BANDS.length)] : null, ...art.inputs } };
  }
  return art;
}
