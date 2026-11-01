import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LogoImage, useDisplayFaces, useDs } from '@/components/ds';
import { SceneSvg } from '@/components/ds/SketchDrawing';
import { useScene } from '@/components/ds/useScene';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEFAULT_ACCENT, type DisplayFace } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { iconFill } from '@/lib/brandColours';
import { initials } from '@/lib/collectionMenus';
import { paintRingMark } from '@/lib/sketch/ringMark';
import type { Scene } from '@/lib/sketch/scene';
import { themeColours } from '@/lib/theme';

// One painting per bar and colour pair; a person sees a handful of bars.
const rings = new Map<string, Scene>();
/** Below this a mark has room for one letter, not two. */
const TWO_LETTERS = 40;

/** The venue's mark: its logo, or the generated one (RingMark) in its own colour (not the active venue's). */
export function VenueMark({ venue, size = 32 }: { venue: Venue | null; size?: number }) {
  const radius = size * 0.28;
  if (venue?.logoUrl) {
    return <LogoImage uri={venue.logoUrl} size={size} radius={radius} fill={logoFill(venue)} />;
  }
  return <RingMark id={venue?.id ?? 'app'} name={venue?.name ?? '·'} accent={venue?.accent ?? null} face={venue?.displayFace ?? 'redaction'} size={size} />;
}

/**
 * A bar with no logo (themes-flow "bar presets", app-mark "ring", Kevin 31
 * Oct): its initials in its face, on its colour, inside the ring a glass
 * leaves, painted in the colour its label takes (lib/theme), so it reads.
 */
export function RingMark({ id, name, accent, face, size }: { id: string; name: string; accent: string | null; face: DisplayFace; size: number }) {
  const ds = useDs();
  const t = themeColours(accent ?? DEFAULT_ACCENT, ds.c.ground, ds.scheme === 'dark');
  const family = useDisplayFaces([face]);
  const scene = useScene(rings, `${id}|${t.onFill}`, false, () => paintRingMark(t.onFill, t.onFill, id));
  const letters = size >= TWO_LETTERS ? initials(name) : initials(name).slice(0, 1);
  const fontSize = size * (letters.length > 1 ? 0.3 : 0.4);
  return (
    <View aria-hidden style={[styles.initial, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: t.fill }]}>
      <View style={StyleSheet.absoluteFill}>
        <SceneSvg scene={scene} bare />
      </View>
      <Text allowFontScaling={false} style={{ fontFamily: family(face), color: t.onFill, fontSize, lineHeight: fontSize * 1.25 }}>
        {letters}
      </Text>
    </View>
  );
}

/** What an opaque logo's mark sits on: the venue's home-screen icon background, else (null) the logo's own edge colour. */
export function logoFill(venue: Pick<Venue, 'iconBackground' | 'accent' | 'groundTint'>): string | null {
  return venue.iconBackground ? iconFill(venue.iconBackground, venue) : null;
}

/** Home mode's mark: a house on a plain tile. */
export function HomeMark({ size = 32 }: { size?: number }) {
  const ds = useDs();
  return (
    <View style={[styles.initial, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: ds.c.raised }]}>
      <IconSymbol name="house.fill" size={size * 0.55} color={ds.c.ink} />
    </View>
  );
}

/**
 * Switch to home or a venue, like switching accounts, and land on that mode's
 * first tab (Discover at home, Tonight at a venue), since the tabs change.
 */
export function useSwitchTo() {
  const router = useRouter();
  const { enterVenue } = useActiveVenue();
  const { setMode } = useMode();
  return (next: 'home' | Venue) => {
    if (next === 'home') setMode('home');
    else enterVenue(next.id);
    router.navigate(next === 'home' ? '/discover' : '/');
  };
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
