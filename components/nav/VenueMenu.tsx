import { useRouter } from 'expo-router';
import { useEffect, type ComponentRef } from 'react';
import type { View } from 'react-native';

import { PopoverMenu, type PopoverSection } from '@/components/ds/PopoverMenu';
import { usePopover } from '@/components/ds/usePopover';
import { useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ds/Toast';
import { readClipboard } from '@/lib/clipboardPeek';
import { staffLinkHref } from '@/lib/staffDoor';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { roleLabel } from '@/lib/roles';
import { startedSetup } from '@/lib/venueSetup';
import { useVenueSetup } from '@/store/useVenueSetup';

import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';

/**
 * The places you can switch to, as board Prod-place (C8) draws them: each venue (with your role there), then Home
 * (your shelf and menus), the one you're in checked; then "Join a bar with a link", and for someone on no venue's
 * team "Run a bar? Set it up" (Q35b, 26 Oct 2026). The sidebar's chip and the rail hang them from the mark
 * (VenueMenu); the phone's place sheet from its Switch (PlaceSheet).
 */
export function usePlaceSections(): PopoverSection[] {
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
  const toast = useToast();
  // The join door's own entry is a staff link (/v/<slug>?join=<secret>): read the one you copied and open it.
  const join = async () => {
    const href = staffLinkHref((await readClipboard()) ?? '');
    if (href) router.push(href as never);
    else toast.show({ title: 'Copy the bar’s staff link, then tap again', tone: 'error' });
  };
  const setUp = !isLoading && !venues.length;
  const more: PopoverSection = {
    items: [
      { label: 'Join a bar with a link', trailing: <IconSymbol name="link" size={20} color={ds.c.ink} />, onPress: () => void join() },
      ...(setUp ? [{ label: 'Run a bar? Set it up', trailing: <IconSymbol name="building.2" size={20} color={ds.c.ink} />, onPress: () => router.push((started ?? '/venue-setup?step=find') as never) }] : []),
    ],
  };
  return [places, more];
}

/** The places menu hung from a mark: the sidebar's place chip and the tablet rail's logo (usePlaceSections). */
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
  return <PopoverMenu anchor={popover.anchor} label="Your places" sections={usePlaceSections()} onClose={close} />;
}
