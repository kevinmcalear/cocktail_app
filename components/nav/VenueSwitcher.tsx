import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';

import { VenueMenuSheet } from './VenueMenuSheet';
import { HomeMark, VenueMark } from './VenueMarks';

/** What the switcher says to screen readers: the mark carries no name. With no venues there's nowhere to switch to, so it opens the menu. */
export function switcherLabel(home: boolean, venue: Venue | null, canSwitch = true): string {
  return `${home ? 'Home bar' : `Venue: ${venue?.name ?? 'none yet'}`}. ${canSwitch ? 'Switch' : 'Menu'}`;
}

/**
 * The logo in the corner of every phone screen: the venue's mark (or the
 * house at home) and a small chevron, no name. Tapping it opens the venue
 * menu: switch to home or another venue, or go to one of this venue's places.
 * The tablet rail uses the same button.
 */
export function VenueSwitcher({ size = 32 }: { size?: number }) {
  const ds = useDs();
  const { active, venues } = useActiveVenue();
  const home = useMode().mode === 'home';
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale role="button" onPress={() => setOpen(true)} accessibilityLabel={switcherLabel(home, active, venues.length > 0)} style={styles.chip}>
        {home ? <HomeMark size={size} /> : <VenueMark venue={active} size={size} />}
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </PressableScale>
      {open ? <VenueMenuSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, minWidth: layout.minTapTarget },
});
