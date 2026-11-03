import { usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useWebNav, WEB_SIDEBAR_WIDTH } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import { isDesktopShell } from '@/lib/desktopShell';
import { isEightBallKey } from '@/lib/eightBallKey';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';
import { isEditable } from '@/lib/bringInAnywhere';
import { isApplePlatform } from '@/lib/platformKeys';
import { navCurrent } from '@/lib/shellNav';
import { tabOfGroup } from '@/lib/tabs';

import { RoundNav } from '@/components/screens/firstRound/RoundElsewhere';
import { SetupNav } from '@/components/screens/venueSetup/SetupBanner';

import { AddSheets } from './AddButton';
import { useSidePlaces, useSideNotes, type Place } from './sidePlaces';
import { useUserDisplayName } from '@/components/ui/UserAvatar';

import { NavRow, PlaceHeading, YouFooter } from './SideNavParts';
import { VenueBrandProvider } from './VenueBrandProvider';
import { WebRail } from './WebRail';

/** What the sidebar and the rail share: where to go, which row is lit, and opening New and Search. */
export interface SideNavProps {
  current: string | null;
  go: (p: Place) => void;
  searching: boolean;
  onSearch: () => void;
  onNew: () => void;
}

/**
 * The side nav on wide web and a native iPad, where the phone tab bar is
 * hidden: the full sidebar on a desktop window, the icon rail from 768 to
 * 1199. Owns the keyboard shortcuts (web only) and New, so both get them.
 */
export function WebSideNav() {
  return (
    <VenueBrandProvider>
      <SideNav />
    </VenueBrandProvider>
  );
}

function SideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useMode();
  const nav = useWebNav();
  const places = useSidePlaces();
  const [creating, setCreating] = useState(false);
  const searching = useSearchPalette((s) => s.open);
  const setSearching = useSearchPalette((s) => s.setOpen);

  // A page that isn't a row (a drink, the add wizard) keeps the row it came from lit.
  const rows = [...places.tabs, ...places.places];
  const [last, setLast] = useState<string | null>(null);
  // Opened cold (a link or a refresh), there's no row it came from: the tab its stack is in is lit.
  const tab = tabOfGroup((useSegments() as string[])[1]);
  // "Set up <bar>" lives under Venue settings' path but is its own row (SetupNav).
  const current = pathname.endsWith('/what-next') ? null : navCurrent(pathname, rows, last ?? tab);
  if (current !== last) setLast(current);

  // ponytail: ⌘K, the eight ball key and N live on the always-mounted side nav. ⌘K toggles the search over this page;
  // N toggles New. Browsers keep ⌘N for a new window, so New is a bare N, ignored while typing in a field.
  // The eight ball, the hidden Easter egg phones get with a shake, is ⌘8 in the desktop app and ⇧⌘8 in a browser,
  // which keeps ⌘8 for its eighth tab (lib/eightBallKey.ts).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(!useSearchPalette.getState().open);
      } else if (isEightBallKey(e, !isDesktopShell())) {
        e.preventDefault();
        setSearching(false);
        useEightBallStore.getState().setOpen(true);
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && !isEditable(e.target as HTMLElement | null)) {
        e.preventDefault();
        setCreating((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setSearching]);

  const props: SideNavProps = {
    current,
    go: (p) => {
      // Home's Menus is the menus page in home mode: someone on no bar's team may still be in venue mode.
      if (p.key === 'home-menus' && mode !== 'home') setMode('home');
      return p.tab ? router.navigate(p.path as Href) : router.push(p.path as Href);
    },
    searching,
    onSearch: () => setSearching(true),
    onNew: () => setCreating(true),
  };
  return (
    <>
      {nav === 'rail' ? <WebRail {...props} /> : <Sidebar {...props} />}
      {creating ? <AddSheets onClose={() => setCreating(false)} /> : null}
    </>
  );
}

/**
 * The desktop sidebar, as board Prod-desk (C7) draws it: Search (⌘K), the
 * four tabs, the group of the place you're in under its chip (at a bar its
 * Menus, House-made, Team, Bar settings; at home Shelf and Menus), and you at
 * the foot. The chip is where you switch place (C8). Everything else (Study, Glassware, Back bar, Rota, Brand, Roles
 * and access) opens from Bar settings or Tonight. Add is the + Add top right of
 * the page (DeskAddButton) and the N key. Pages need no header row of their own.
 */
function Sidebar({ current, go, searching, onSearch }: SideNavProps) {
  const ds = useDs();
  // An iPad's status bar and home indicator; 0 on the web.
  const insets = useSafeAreaInsets();
  const { venue, atHome, tabs, places } = useSidePlaces();
  const notes = useSideNotes(venue?.id ?? null);
  const name = useUserDisplayName();
  const row = (p: Place) => {
    const note = notes[p.key];
    return <NavRow key={p.key} label={note?.label ?? p.label} icon={p.icon} current={current === p.key} note={note?.text} warn={note?.warn} onPress={() => go(p)} />;
  };
  // The shortcuts listen on the page's document, so only the web shows their keys (not a native iPad).
  const keys = Platform.OS === 'web';
  return (
    <View role="navigation" accessibilityLabel="Main" style={[styles.nav, { backgroundColor: ds.c.ground, borderRightColor: ds.c.line, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      {/* "Set up <bar>" first, until it's done (owner-setup call 6). */}
      <SetupNav />
      <NavRow label="Search" icon="magnifyingglass" role="button" look="filled" hint={keys ? (isApplePlatform() ? '⌘K' : 'Ctrl K') : undefined} current={searching} onPress={onSearch} />
      {tabs.map(row)}
      {/* Only the place you're in: the chip switches to the others. */}
      {venue ? <PlaceHeading mark={venue.name}>{venue.name}</PlaceHeading> : atHome ? <PlaceHeading mark={name}>Home</PlaceHeading> : null}
      {places.map(row)}
      {venue ? <RoundNav /> : null}
      <YouFooter venue={venue} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: WEB_SIDEBAR_WIDTH, height: '100%', flexShrink: 0, paddingVertical: space.lg, paddingHorizontal: space.md, gap: 2, borderRightWidth: StyleSheet.hairlineWidth },
});
