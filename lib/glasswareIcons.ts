/** Built-in glassware icon keys in CustomIcons — shared with identify-glassware edge fn. */
export const GLASSWARE_ICON_KEYS = [
    "Coupette",
    "Coupe",
    "Martini",
    "Rocks",
    "Highball",
    "Fizz",
    "Ceramic",
    "Tall Spirit Mixer",
    "Spritz",
    "Flute",
    "Nick & Nora",
    "Small Rocks",
    "Rocks & Crushed ice",
    "Mug",
    "Snifter",
    "Tiki",
    "Beer",
    "Wine",
] as const;

export type GlasswareIconKey = (typeof GLASSWARE_ICON_KEYS)[number];

export function isKnownGlasswareIcon(key: string): key is GlasswareIconKey {
    return (GLASSWARE_ICON_KEYS as readonly string[]).includes(key);
}

// A glass row with no icon key draws from its name: the first shape the name says.
const BY_NAME: [RegExp, GlasswareIconKey][] = [
    [/nick/i, "Nick & Nora"],
    [/coupette/i, "Coupette"],
    [/coupe/i, "Coupe"],
    [/martini|cocktail glass/i, "Martini"],
    [/collins|highball|chimney|zombie/i, "Highball"],
    [/fizz|delmonico/i, "Fizz"],
    [/tiki/i, "Tiki"],
    [/mug/i, "Mug"],
    [/snifter/i, "Snifter"],
    [/flute|champagne/i, "Flute"],
    [/spritz/i, "Spritz"],
    [/wine/i, "Wine"],
    [/beer|pint|pilsner/i, "Beer"],
    [/small rocks|single rocks/i, "Small Rocks"],
    [/rocks|old fashioned|lowball|tumbler/i, "Rocks"],
];

/** The icon for a drink's glass (the spec heading): its own key, else its name's shape, else none. */
export function glassIcon(glass: { icon_key?: string | null; name: string }): GlasswareIconKey | null {
    if (glass.icon_key && isKnownGlasswareIcon(glass.icon_key)) return glass.icon_key;
    return BY_NAME.find(([re]) => re.test(glass.name))?.[1] ?? null;
}
