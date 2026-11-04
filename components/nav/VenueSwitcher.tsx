import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassSurface, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';

import { PlaceSheet, VenueMenu } from './VenueMenuLazy';
import { HomeMark, VenueMark } from './VenueMarks';

/** What the switcher says to screen readers: the mark carries no name. */
export function switcherLabel(home: boolean, venue: Venue | null): string {
  return `${home ? 'Home bar' : `Venue: ${venue?.name ?? 'none yet'}`}. Switch`;
}

/** Opens the places menu (VenueMenu) from a button: the ref to put on its wrapper, what to call on press, whether it is open, and the menu to render. */
export function useVenueMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<ComponentRef<typeof View>>(null);
  return { button, open: () => setOpen(true), expanded: open, menu: open ? <VenueMenu target={button} onClose={() => setOpen(false)} /> : null };
}

/**
 * The logo in the corner of every phone screen (board Prod-place): the venue's mark (or the house at home) and a
 * small chevron in a glass pill, no name. On phones it opens the place sheet (PlaceSheet): every page of the place
 * you're in, with Switch inside it. `flat` drops the pill and hangs the places menu from the mark instead, for the
 * tablet rail, whose own rows are the place's pages. `chevron={false}`: Android's search bar draws the mark on its
 * own (Prod-and).
 */
export function VenueSwitcher({ size = 34, chevron = true, flat = false }: { size?: number; chevron?: boolean; flat?: boolean }) {
  const ds = useDs();
  const { active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const popover = useVenueMenu();
  const [sheet, setSheet] = useState(false);
  const { button } = popover;
  const open = flat ? popover.open : () => setSheet(true);
  const expanded = flat ? popover.expanded : sheet;
  const menu = flat ? popover.menu : sheet ? <PlaceSheet onClose={() => setSheet(false)} /> : null;
  const face = (
    <>
      {home ? <HomeMark size={size} /> : <VenueMark venue={active} size={size} />}
      {chevron ? <IconSymbol name="chevron.down" size={14} color={flat ? ds.c.muted : ds.c.ink} /> : null}
    </>
  );
  return (
    <>
      <View ref={button} collapsable={false}>
        <PressableScale role="button" aria-expanded={expanded} onPress={open} accessibilityLabel={switcherLabel(home, active)} style={flat || !chevron ? styles.flat : undefined}>
          {flat || !chevron ? face : <GlassSurface interactive style={styles.pill}>{face}</GlassSurface>}
        </PressableScale>
      </View>
      {menu}
    </>
  );
}

const styles = StyleSheet.create({
  flat: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, minWidth: layout.minTapTarget },
  // Board: 44 tall, the 34 mark 5 from the left, 6 to the chevron, 12 on the right.
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: layout.minTapTarget, paddingLeft: 5, paddingRight: space.md },
});
