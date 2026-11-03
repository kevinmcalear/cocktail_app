import { useRouter } from 'expo-router';
import { useEffect, type ComponentRef } from 'react';
import type { View } from 'react-native';

import { PopoverMenu, type PopoverSection } from '@/components/ds/PopoverMenu';
import { usePopover } from '@/components/ds/usePopover';
import { useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { roleLabel } from '@/lib/roles';
import { startedSetup } from '@/lib/venueSetup';
import { useVenueSetup } from '@/store/useVenueSetup';

import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';

/**
 * Switching place, as board Prod-place (C8) draws it: a menu hung from the mark with your places in it, the one
 * you're in checked: each venue (with your role there), then Home (your shelf and menus). Nothing else lives here;
 * a venue's pages are in the sidebar, Bar settings and Tonight. Someone on no venue's team gets "Run a bar? Set it up"
 * at the end (Q35b, 26 Oct 2026).
 */
export function VenueMenu({ target, onClose }: { target: { current: ComponentRef<typeof View> | null }; onClose: () => void }) {
  // Opened from the button it hangs from: measure it once, on mount.
  const popover = usePopover();
  const { open } = popover;
  useEffect(() => {
    open(target.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    popover.close();
    onClose();
  };
  const ds = useDs();
  const router = useRouter();
  const { active, venues, isLoading } = useActiveVenue();
  const home = useMode().mode === 'home';
  const switchTo = useSwitchTo();
  const started = startedSetup(useVenueSetup((s) => s.runs));
  const places: PopoverSection = {
    items: [
      ...venues.map((v) => ({
        label: v.name,
        detail: roleLabel(v.roleLevel),
        checked: !home && v.id === active?.id,
        trailing: <VenueMark venue={v} size={30} />,
        onPress: () => switchTo(v),
      })),
      { label: 'Home', detail: 'Your shelf and menus', checked: home, trailing: <HomeMark size={30} />, onPress: () => switchTo('home') },
    ],
  };
  const setUp = !isLoading && !venues.length;
  const sections = setUp
    ? [places, { items: [{ label: 'Run a bar? Set it up', trailing: <IconSymbol name="building.2" size={20} color={ds.c.ink} />, onPress: () => router.push((started ?? '/venue-setup?step=find') as never) }] }]
    : [places];
  return <PopoverMenu anchor={popover.anchor} label="Your places" sections={sections} onClose={close} />;
}
