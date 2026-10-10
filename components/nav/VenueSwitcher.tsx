import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';

import { VenueMenuSheet } from './VenueMenuSheet';
import { HomeMark, VenueMark } from './VenueMarks';

/** What the switcher says to screen readers: the mark carries no name. */
export function switcherLabel(home: boolean, venue: Venue | null): string {
  return home ? 'Home bar. Switch' : `Venue: ${venue?.name ?? 'none yet'}. Switch`;
}

/**
 * The logo in the corner of every phone screen: the venue's mark (or the
 * house at home) and a small chevron, no name. Tapping it opens the venue
 * menu: switch to home or another venue, or go to one of this venue's places.
 * The tablet rail uses the same button.
 */
export function VenueSwitcher({ size = 32 }: { size?: number }) {
  const ds = useDs();
  const { active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale role="button" onPress={() => setOpen(true)} accessibilityLabel={switcherLabel(home, active)} style={styles.chip}>
        {home ? <HomeMark size={size} /> : <VenueMark venue={active} size={size} />}
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </PressableScale>
      {open ? <VenueMenuSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The venue's name in its own display face, beside the logo: Tonight and the sidebar only (the brief). */
export function VenueWordmark({ venue }: { venue: Venue | null }) {
  const ds = useDs();
  if (!venue) return null;
  return (
    <DsText variant="headline" numberOfLines={1} style={[styles.wordmark, { fontFamily: displayFaces[ds.displayFace].regular }]}>
      {venue.name}
    </DsText>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, minWidth: layout.minTapTarget },
  wordmark: { flexShrink: 1 },
});
