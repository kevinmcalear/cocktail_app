import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DsText, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, DEFAULT_ACCENT, displayFaces } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { accentFill } from '@/lib/color';

/** The venue's mark: its logo, or its initial in its display face on its own colour (not the active venue's). */
export function VenueMark({ venue, size = 32 }: { venue: Venue | null; size?: number }) {
  const own = accentFill(venue?.accent ?? DEFAULT_ACCENT, backbar.dark.ground, backbar.light.surface);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (venue?.logoUrl) {
    return <Image source={{ uri: venue.logoUrl }} style={box} contentFit="cover" accessibilityIgnoresInvertColors />;
  }
  const face = displayFaces[venue?.displayFace ?? 'instrument'];
  return (
    <View style={[box, styles.initial, { backgroundColor: own.fill }]}>
      <DsText variant="headline" color={own.text} style={{ fontFamily: face.italic, fontSize: size * 0.6, lineHeight: size * 0.75 }}>
        {(venue?.name ?? '·').charAt(0).toUpperCase()}
      </DsText>
    </View>
  );
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
  initial: { alignItems: 'center', justifyContent: 'center' },
});
