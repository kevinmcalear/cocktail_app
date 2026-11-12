import { getLocales } from 'expo-localization';
import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, DrinkImage, Headline, PressableScale, useDs } from '@/components/ds';
import { TonightLabel } from '@/components/screens/tonight/TonightParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import type { OnMenuRow } from '@/lib/discoverHome';
import { STYLES } from '@/lib/drinkStyles';
import { itemHref } from '@/lib/itemRoutes';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { MIN_RANKERS } from '@/lib/ranking';

/** What the search field on Discover says: what a search from here looks through (lib/tabs.ts searchBarLabel). */
const SEARCH_LABEL = 'Search bars, drinks, bottles';

/**
 * The search field on Discover's page (Kevin, 12 Nov 2026): a door to the one
 * search, which starts on this area. iPhones and phone web; Android's top bar
 * and the desktop's sidebar already have one.
 */
export function DiscoverSearchField() {
  const ds = useDs();
  const openSearch = useOpenSearch();
  return (
    <PressableScale role="button" accessibilityLabel={SEARCH_LABEL} onPress={() => openSearch()} style={[styles.field, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="magnifyingglass" size={20} color={ds.c.muted} />
      <Body tone="muted" numberOfLines={1} style={styles.flex}>
        {SEARCH_LABEL}
      </Body>
    </PressableScale>
  );
}

/** The styles a phone can flip the list through: every one with a classic to rank. */
const PHONE_STYLES = STYLES.filter((s) => s.classics.length > 0);

/** Phones: the list's style, as chips in one line that scrolls (the desktop has DeskChips). */
export function PhoneStyleChips({ styleId, onStyle }: { styleId: string; onStyle: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} role="radiogroup" accessibilityLabel="Style" contentContainerStyle={styles.chips}>
      {PHONE_STYLES.map((s) => (
        <Chip key={s.id} label={s.label} selected={styleId === s.id} onPress={() => onStyle(s.id)} />
      ))}
    </ScrollView>
  );
}

function OnMenuRowView({ row, highlight, onHover }: { row: OnMenuRow; highlight: boolean; onHover?: (barId: string | null) => void }) {
  const ds = useDs();
  const router = useRouter();
  const face = { fontFamily: displayFaces[ds.displayFace].regular };
  const away = row.distanceM !== null ? formatDistance(row.distanceM / 1000, usesMiles(getLocales()[0])) : row.place;
  const sub = [row.barName, away].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${row.name}, ${sub}`}
      onPress={() => router.push(itemHref('Cocktail', row.drinkId) as Href)}
      onHoverIn={onHover ? () => onHover(row.barId) : undefined}
      onFocus={onHover ? () => onHover(row.barId) : undefined}
      style={[styles.row, { borderBottomColor: ds.c.line }, highlight ? [styles.lit, { backgroundColor: ds.c.raised }] : null]}
    >
      <DrinkImage itemId={row.drinkId} glass={null} accessibilityLabel="" radius={0} style={styles.drawing} thumb />
      <View style={styles.flex}>
        <Headline numberOfLines={1} style={face}>
          {row.name}
        </Headline>
        <Caption tone="muted" numberOfLines={1}>
          {sub}
        </Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * "Martinis on menus near you": what the ranked list shows before any bar in
 * the area has its rankers, so Discover is never without drinks. One drink a
 * bar; All opens the one search on the classic. The line under it says when
 * scores come.
 */
export function OnMenusNear({ label, classic, rows, limit, highlight, onHover }: { label: string; classic: string; rows: readonly OnMenuRow[]; limit: number; highlight?: string | null; onHover?: (barId: string | null) => void }) {
  const openSearch = useOpenSearch();
  return (
    <View role="region" accessibilityLabel={label} style={styles.section}>
      <TonightLabel title={label} aside="All" onAside={() => openSearch({ query: classic, scope: null })} />
      <View>
        {rows.slice(0, limit).map((r) => (
          <OnMenuRowView key={r.barId} row={r} highlight={highlight === r.barId} onHover={onHover} />
        ))}
      </View>
      <Caption tone="muted">{`Not ranked yet. A bar’s ${classic} gets a score once ${MIN_RANKERS} people have ranked it there.`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.pill },
  chips: { gap: space.sm },
  // The same row as the ranked list's (DiscoverParts), without the place and the score.
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  lit: { borderRadius: radius.control, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  drawing: { width: 56, height: 56 },
});
