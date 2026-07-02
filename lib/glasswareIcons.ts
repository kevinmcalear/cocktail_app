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
