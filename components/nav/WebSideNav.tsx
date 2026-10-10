import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { isDesktopShell } from '@/lib/desktopShell';
import { isEightBallKey } from '@/lib/eightBallKey';
import { useEightBallStore } from '@/store/useEightBallStore';
import { useSearchPalette } from '@/store/useSearchPalette';
import { currentProps } from '@/lib/a11yState';
import { isEditable } from '@/lib/bringInAnywhere';
import { withAlpha } from '@/lib/color';
import { isApplePlatform } from '@/lib/platformKeys';
import { canSeeTeam } from '@/lib/team';

import { CreateSheet } from './CreateSheet';
import { VenueBrandProvider } from './VenueBrandProvider';
import { VenueSwitcher } from './VenueSwitcher';
import { HOME_TABS, TabIcon, VENUE_TABS } from './WebTabBar';

/** How wide the side nav is on wide web. */
export const WEB_SIDEBAR_WIDTH = 240;

const hrefFor = (name: string) => (name === 'index' ? '/' : `/${name}`) as Href;

function NavRow({ label, icon, current, hint, role = 'link', onPress }: { label: string; icon: IconName; current: boolean; hint?: string; role?: 'link' | 'button'; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role={role}
      {...currentProps(current)}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, current && { backgroundColor: withAlpha(ds.accentText, 0.16) }]}
    >
      <TabIcon name={icon} size={18} color={current ? ds.accentText : ds.c.muted} />
      <DsText
        color={current ? ds.c.ink : ds.c.muted}
        numberOfLines={1}
        style={[styles.label, current && { fontFamily: fontFamilies.bodySemiBold }]}
      >
        {label}
      </DsText>
      {hint ? (
        <DsText variant="caption" tone="muted">
          {hint}
        </DsText>
      ) : null}
    </PressableScale>
  );
}

/**
 * The redesign's sidebar for wide web, where the tab bar is hidden: the venue
 * chip, New, search, the current mode's tabs (the same ones as the phone bar),
 * and You, so pages need no header row of their own.
 */
export function WebSideNav() {
  return (
    <VenueBrandProvider>
      <SideNavBody />
    </VenueBrandProvider>
  );
}

function SideNavBody() {
  const ds = useDs();
  const router = useRouter();
  const pathname = usePathname();
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const showTeam = mode === 'venue' && canSeeTeam(role);
  const go = (name: string) => router.navigate(hrefFor(name));
  const [creating, setCreating] = useState(false);

  const searching = useSearchPalette((s) => s.open);
  const setSearching = useSearchPalette((s) => s.setOpen);

  // ponytail: ⌘K, the eight ball key and N live on the always-mounted sidebar. ⌘K toggles the search over this page;
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

  return (
    <View role="navigation" style={[styles.nav, { backgroundColor: ds.c.ground, borderRightColor: ds.c.line }]}>
      <View style={styles.venue}>
        <VenueSwitcher />
      </View>
      <NavRow label="New" icon="plus" role="button" hint="N" current={false} onPress={() => setCreating(true)} />
      {creating ? <CreateSheet visible onClose={() => setCreating(false)} /> : null}
      <NavRow
        label="Search"
        icon="magnifyingglass"
        role="button"
        hint={isApplePlatform() ? '⌘K' : 'Ctrl K'}
        current={searching || pathname === '/search'}
        onPress={() => setSearching(true)}
      />
      <View style={styles.tabs}>
        {(mode === 'home' ? HOME_TABS : VENUE_TABS).map((t) => (
          <NavRow key={t.name} label={t.label} icon={t.icon} current={pathname === hrefFor(t.name)} onPress={() => go(t.name)} />
        ))}
        {/* Phones reach menus from Tonight; wide web has them here, with the back bar, as in the brief. */}
        {mode === 'venue' ? (
          <>
            <NavRow label="Menus" icon="list.bullet" current={pathname.startsWith('/menus')} onPress={() => go('menus/all')} />
            <NavRow label="Back bar" icon="map.fill" current={pathname.startsWith('/back-bar')} onPress={() => go('back-bar')} />
          </>
        ) : null}
        {showTeam ? (
          <View style={styles.team}>
            <NavRow label="My team" icon="person.2.fill" current={pathname.startsWith('/team')} onPress={() => go('team')} />
          </View>
        ) : null}
      </View>
      {/* Home mode has You as a tab; venue mode keeps it at the foot, where the phone has the avatar. */}
      {mode === 'venue' ? (
        <View style={styles.you}>
          <NavRow label="You" icon="person.crop.circle" current={pathname === '/you'} onPress={() => router.push('/you')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: WEB_SIDEBAR_WIDTH, height: '100%', flexShrink: 0, padding: space.md, gap: space.sm, borderRightWidth: StyleSheet.hairlineWidth },
  venue: { paddingHorizontal: space.xs, paddingBottom: space.sm },
  tabs: { gap: 2 },
  team: { marginTop: space.md },
  you: { marginTop: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.control },
  label: { flex: 1 },
});
