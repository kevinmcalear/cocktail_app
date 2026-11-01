import { useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import { searchBarLabel, YOUR_DRINKS } from '@/lib/tabs';
import { useBringIn } from '@/store/useBringIn';

import { useMaterialRoles } from './material';

/**
 * Android's top search bar (Prod-and): a Material 3 search bar that opens the
 * one search (the /search page, pushed on the tab's stack), the camera into Bring
 * in, and the place at its end. The web has none, so it stays out of the web's
 * pages (SearchBar.web.tsx).
 */
export function SearchBar({ end }: { end: ReactNode }) {
  const ds = useDs();
  const roles = useMaterialRoles();
  const openSearch = useOpenSearch();
  const label = searchBarLabel(useSegments());
  // Bring in mounts with a session (app/_layout.tsx), so the camera does too.
  const { session } = useAuth();
  const open = () => openSearch(label === YOUR_DRINKS ? { query: '', scope: 'mine' } : undefined);
  return (
    <View style={[styles.search, { backgroundColor: roles.search }]}>
      <PressableScale role="button" accessibilityLabel={label} onPress={open} style={styles.field}>
        <IconSymbol name="magnifyingglass" size={22} color={ds.c.ink} />
        <Body tone="muted" numberOfLines={1} style={styles.label}>
          {label}
        </Body>
      </PressableScale>
      {session ? (
        <PressableScale role="button" accessibilityLabel="Snap a menu or bottle" onPress={() => useBringIn.getState().openSheet()} style={styles.tool}>
          <IconSymbol name="camera" size={22} color={ds.c.ink} />
        </PressableScale>
      ) : null}
      {end}
    </View>
  );
}

const styles = StyleSheet.create({
  // Material 3's search bar: 56 tall, a full pill.
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, paddingLeft: space.lg + 2, paddingRight: space.sm, borderRadius: radius.pill },
  field: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md + 2, minHeight: layout.minTapTarget },
  label: { flexShrink: 1 },
  tool: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
