import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WEB_SIDEBAR_WIDTH } from '@/components/WebSidebar';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useMode } from '@/hooks/useMode';
import { currentProps } from '@/lib/a11yState';
import { withAlpha } from '@/lib/color';
import { isApplePlatform } from '@/lib/platformKeys';

import { VenueBrandProvider } from './VenueBrandProvider';
import { VenueSwitcher } from './VenueSwitcher';
import { HOME_TABS, VENUE_TABS } from './WebTabBar';

const hrefFor = (name: string) => (name === 'index' ? '/' : `/${name}`) as Href;

function NavRow({ label, icon, current, hint, onPress }: { label: string; icon: IconName; current: boolean; hint?: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="link"
      {...currentProps(current)}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, current && { backgroundColor: withAlpha(ds.accentText, 0.16) }]}
    >
      <IconSymbol name={icon} size={18} color={current ? ds.accentText : ds.c.muted} />
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
 * chip, search, and the current mode's tabs (the same ones as the phone bar).
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
  const go = (name: string) => router.navigate(hrefFor(name));

  // ponytail: ⌘K lives on the always-mounted sidebar, like the legacy one.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.navigate('/search');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <View role="navigation" style={[styles.nav, { backgroundColor: ds.c.ground, borderRightColor: ds.c.line }]}>
      <View style={styles.venue}>
        <VenueSwitcher />
      </View>
      <NavRow
        label="Search"
        icon="magnifyingglass"
        hint={isApplePlatform() ? '⌘K' : 'Ctrl K'}
        current={pathname === '/search'}
        onPress={() => go('search')}
      />
      <View style={styles.tabs}>
        {(mode === 'home' ? HOME_TABS : VENUE_TABS).map((t) => (
          <NavRow key={t.name} label={t.label} icon={t.icon} current={pathname === hrefFor(t.name)} onPress={() => go(t.name)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: WEB_SIDEBAR_WIDTH, height: '100%', flexShrink: 0, padding: space.md, gap: space.sm, borderRightWidth: StyleSheet.hairlineWidth },
  venue: { paddingHorizontal: space.xs, paddingBottom: space.sm },
  tabs: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.control },
  label: { flex: 1 },
});
