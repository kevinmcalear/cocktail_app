import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useDs } from '@/components/ds';
import { displayFaces, type DisplayFace } from '@/constants/tokens';
import { initials } from '@/lib/collectionMenus';

/** A bar's own look: its accent, a dark ground and its display face. */
export interface BarBrand {
  accent: string;
  ground: string;
  face: DisplayFace;
}

/**
 * A bar's round mark on Collection (home-collection-bars): its logo, or its
 * initials in its display face and accent on its ground. `filled` is the
 * accent disc with dark initials (Bar menus for you). `neutral` is a bar or
 * maker with no brand to show: muted serif initials in a hairline ring
 * (ppl-person's Corner Hotel, ppl-maker).
 * ponytail: guests can't read a bar's brand yet (bars is members only under
 * RLS), so `brand` falls back to the app's accent and face. Pass it once a
 * public read of a bar profile's brand exists.
 */
export function BarMark({ name, logoUrl, size, brand, filled, neutral }: { name: string; logoUrl?: string | null; size: number; brand?: BarBrand | null; filled?: boolean; neutral?: boolean }) {
  const ds = useDs();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (logoUrl) return <Image source={{ uri: logoUrl }} style={round} cachePolicy="memory-disk" recyclingKey={logoUrl} accessibilityIgnoresInvertColors />;
  const accent = brand?.accent ?? ds.accentText;
  const face = displayFaces[brand?.face ?? ds.displayFace].regular;
  const look = filled
    ? { backgroundColor: brand?.accent ?? ds.accentFill.fill, color: brand ? ds.c.ground : ds.accentFill.text, borderColor: 'transparent' }
    : neutral && !brand
      ? { backgroundColor: ds.c.raised, color: ds.c.muted, borderColor: ds.c.lineStrong }
      : { backgroundColor: brand?.ground ?? ds.c.raised, color: accent, borderColor: accent };
  return (
    <View aria-hidden style={[styles.mark, round, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}>
      <Text style={{ fontFamily: face, color: look.color, fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.56) }} allowFontScaling={false}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
});
