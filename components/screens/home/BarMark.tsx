import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useDs } from '@/components/ds';
import { backbar, displayFaces, type DisplayFace } from '@/constants/tokens';
import { useBarBrand } from '@/hooks/useBarBrands';
import { markBrand } from '@/lib/brand';
import { accentFill, readableAccent } from '@/lib/color';
import { initials } from '@/lib/collectionMenus';

/** A bar's own look: its accent and display face, and a ground behind its initials (else the app's). */
export interface BarBrand {
  accent: string;
  ground?: string;
  face: DisplayFace;
}

/**
 * A bar's round mark on Collection (home-collection-bars): its logo, or its
 * initials in its display face and accent on its ground. `filled` is the
 * accent disc with dark initials (Bar menus for you). `neutral` is a bar or
 * maker with no brand to show: muted serif initials in a hairline ring
 * (ppl-person's Corner Hotel, ppl-maker). `letter`: one letter, for the small
 * mark before a What to make caption.
 * A bar's brand is public (bar_brands): give `profileId` (the bar page's id)
 * and a mark with no logo or `brand` reads its venue's logo, accent and face
 * for anyone; without one it draws in the app's accent and face.
 */
export function BarMark({ name, logoUrl, size, brand, filled, neutral, letter, profileId }: { name: string; logoUrl?: string | null; size: number; brand?: BarBrand | null; filled?: boolean; neutral?: boolean; /** One letter, for a mark a caption leads with. */ letter?: boolean; profileId?: string | null }) {
  const ds = useDs();
  // Only asked when the caller has neither a logo nor the brand (null means it has none).
  const looked = useBarBrand(!logoUrl && brand === undefined ? profileId : null);
  const logo = logoUrl || looked?.logo;
  const own: BarBrand | null = brand ?? markBrand(looked);
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (logo) return <Image source={{ uri: logo }} style={round} cachePolicy="memory-disk" recyclingKey={logo} accessibilityIgnoresInvertColors />;
  // The bar's accent made readable on this ground, and its fill with the ink that reads on it.
  const accent = own ? readableAccent(own.accent, ds.c.ground) : ds.accentText;
  const fill = own ? accentFill(own.accent, backbar.dark.ground, backbar.light.surface) : ds.accentFill;
  const face = displayFaces[own?.face ?? ds.displayFace].regular;
  const look = filled
    ? { backgroundColor: fill.fill, color: fill.text, borderColor: 'transparent' }
    : neutral && !own
      ? { backgroundColor: ds.c.raised, color: ds.c.muted, borderColor: ds.c.lineStrong }
      : { backgroundColor: own?.ground ?? ds.c.raised, color: accent, borderColor: accent };
  return (
    <View aria-hidden style={[styles.mark, round, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}>
      <Text style={{ fontFamily: face, color: look.color, fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.56) }} allowFontScaling={false}>
        {letter ? monogram(name) : initials(name)}
      </Text>
    </View>
  );
}

/** One letter for a bar: its first word's, past a number ("C" for 69 Colebrooke Row). */
function monogram(name: string): string {
  const all = initials(name);
  return all.match(/\p{L}/u)?.[0] ?? all.slice(0, 1);
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
});
