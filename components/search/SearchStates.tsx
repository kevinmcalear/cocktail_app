import { useRouter } from 'expo-router';
import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, PencilState, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { SearchMine } from '@/hooks/useSearchMine';
import { newDrinkHref } from '@/lib/itemRoutes';
import { capitalize } from '@/lib/stringUtils';

/*
 * Android's open search draws these its own way (Miss-search-and): the web
 * never shows them (SearchStates.web.tsx), so the pencil drawing stays out of
 * the web's search.
 */

function CardRow({ icon, label, ink, onPress }: { icon: ComponentProps<typeof IconSymbol>['name']; label: string; ink: string; onPress: () => void }) {
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} style={styles.cardRow}>
      <IconSymbol name={icon} size={22} color={ink} />
      <DsText variant="body" color={ink} numberOfLines={2} style={styles.flex}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/** After the typed results: "Add “negr” as a new drink", under "Search everywhere for “negr”" when the search is your place's only. */
export function SearchMore({ query, mine, onEverywhere }: { query: string; mine?: SearchMine; onEverywhere?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const q = query.trim();
  if (!mine?.canAdd && !onEverywhere) return null;
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised }]}>
      {onEverywhere ? <CardRow icon="magnifyingglass" label={`Search everywhere for “${q}”`} ink={ds.c.ink} onPress={onEverywhere} /> : null}
      {mine?.canAdd ? <CardRow icon="plus" label={`Add “${q}” as a new drink`} ink={ds.accentText} onPress={() => router.push(newDrinkHref(capitalize(q), mine.venueId) as never)} /> : null}
    </View>
  );
}

/** Nothing found: one drawing and one way forward. */
export function SearchNoMatch({ query, mine }: { query: string; mine?: SearchMine }) {
  const router = useRouter();
  const name = capitalize(query.trim());
  const add = mine?.canAdd ? { label: `Add ${name}`, onPress: () => router.push(newDrinkHref(name, mine.venueId) as never) } : undefined;
  return <PencilState kind="empty" title={`No drink called ${name} yet.${add ? ' Add it and it’s yours.' : ''}`} action={add} />;
}

const LOADING_ROWS = [0, 1, 2, 3, 4, 5];

/** While the search is out: six rows in outline. */
export function SearchLoading() {
  const ds = useDs();
  const outline = { borderColor: ds.c.line };
  return (
    <View role="progressbar" accessibilityLabel="Searching">
      {LOADING_ROWS.map((i) => (
        <View key={i} style={styles.loadingRow}>
          <View style={[styles.loadingPic, outline]} />
          <View style={styles.loadingBars}>
            <View style={[styles.loadingBar, styles.loadingLong, outline]} />
            <View style={[styles.loadingBar, styles.loadingShort, outline]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const RANK: Record<string, number> = { yours: 0, classics: 1, ingredients: 3, bars: 4, people: 5 };
const DRINKS = 2;

/**
 * Android's typed results (Miss-search-and) read as one Drinks group whoever's
 * they are, then Bottles, then Bars. A bar named what's typed still comes
 * right after your own drinks.
 */
export function drawnGroups(groups: readonly ReactNode[], barLeads: boolean): ReactNode[] {
  const rank = (g: ReactNode) => (isValidElement(g) ? (g.key === 'bars' && barLeads ? 0.5 : (RANK[g.key ?? ''] ?? DRINKS)) : DRINKS);
  let headed = false;
  return [...groups]
    .sort((a, b) => rank(a) - rank(b))
    .map((g) => {
      if (!isValidElement<{ items: readonly unknown[]; label: string }>(g)) return g;
      if (g.key === 'ingredients') return cloneElement(g, { label: 'Bottles' });
      if (g.key === 'bars' || g.key === 'people' || !g.props.items.length) return g;
      const label = headed ? '' : 'Drinks';
      headed = true;
      return cloneElement(g, { label });
    });
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 74 },
  loadingPic: { width: 52, height: 52, borderWidth: 1, borderRadius: radius.control },
  loadingBars: { flex: 1, gap: space.sm },
  loadingBar: { height: 12, borderWidth: 1, borderRadius: radius.pill },
  loadingLong: { width: '62%' },
  loadingShort: { width: '38%' },
});
