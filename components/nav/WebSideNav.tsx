import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useWebNav, WEB_SIDEBAR_WIDTH } from '@/hooks/useIsWideWeb';
import { isDesktopShell } from '@/lib/desktopShell';
import { isEightBallKey } from '@/lib/eightBallKey';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';
import { isEditable } from '@/lib/bringInAnywhere';
import { isApplePlatform } from '@/lib/platformKeys';
import { navCurrent } from '@/lib/shellNav';

import { CreateSheet } from './CreateSheet';
import { useNavPlaces, type Place } from './navPlaces';
import { MarksRow, NavHeading, NavRow, YouFooter } from './SideNavParts';
import { VenueBrandProvider } from './VenueBrandProvider';
import { VenueWordmark } from './VenueSwitcher';
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
 * The side nav on wide web, where the phone tab bar is hidden: the full
 * sidebar on a desktop window, the icon rail from 768 to 1199. Owns the
 * keyboard shortcuts and New, so both get them.
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
  const nav = useWebNav();
  const places = useNavPlaces();
  const [creating, setCreating] = useState(false);
  const searching = useSearchPalette((s) => s.open);
  const setSearching = useSearchPalette((s) => s.setOpen);

  // A page that isn't a row (a drink, the add wizard) keeps the row it came from lit.
  const rows = [...places.tabs, places.history, ...places.work, ...places.venuePlaces];
  const [last, setLast] = useState<string | null>(null);
  const current = navCurrent(pathname, rows, last);
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
    go: (p) => (p.tab ? router.navigate(p.path as Href) : router.push(p.path as Href)),
    searching: searching || pathname === '/search',
    onSearch: () => setSearching(true),
    onNew: () => setCreating(true),
  };
  return (
    <>
      {nav === 'rail' ? <WebRail {...props} /> : <Sidebar {...props} />}
      {creating ? <CreateSheet visible onClose={() => setCreating(false)} /> : null}
    </>
  );
}

/**
 * The desktop sidebar, as the canvas draws it: the marks, Search (⌘K), the
 * mode's tabs and History, the venue's Menus and Back bar, New (N), This
 * week, the Venue section, and you at the foot. Pages need no header row of
 * their own.
 */
function Sidebar({ current, go, searching, onSearch, onNew }: SideNavProps) {
  const ds = useDs();
  const { venue, tabs, work, venuePlaces, history } = useNavPlaces();
  const row = (p: Place) => <NavRow key={p.key} label={p.label} icon={p.icon} current={current === p.key} onPress={() => go(p)} />;
  // History sits right under Discover.
  const nav = tabs.flatMap((t) => (t.key === 'discover' ? [t, history] : [t]));
  return (
    <View role="navigation" accessibilityLabel="Main" style={[styles.nav, { backgroundColor: ds.c.ground, borderRightColor: ds.c.line }]}>
      <MarksRow />
      {venue ? (
        <View style={styles.wordmark}>
          <VenueWordmark venue={venue} />
        </View>
      ) : null}
      <NavRow label="Search" icon="magnifyingglass" role="button" look="filled" hint={isApplePlatform() ? '⌘K' : 'Ctrl K'} current={searching} onPress={onSearch} />
      {nav.map(row)}
      {work.map(row)}
      <NavRow label="New" icon="plus" role="button" look="outlined" hint="N" current={false} onPress={onNew} />
      {/* This week goes here: PR #491 (feat/this-week-app) adds <WeekNav /> between New and the Venue section. */}
      {venuePlaces.length ? (
        <>
          <NavHeading>Venue</NavHeading>
          {venuePlaces.map(row)}
        </>
      ) : null}
      <YouFooter venue={venue} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: WEB_SIDEBAR_WIDTH, height: '100%', flexShrink: 0, paddingVertical: space.lg, paddingHorizontal: space.md, gap: 2, borderRightWidth: StyleSheet.hairlineWidth },
  wordmark: { paddingHorizontal: space.xs, paddingBottom: space.md },
});
