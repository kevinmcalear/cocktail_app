import { useRouter } from 'expo-router';
import { useDeferredValue, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useMineFacts } from '@/hooks/useMineFacts';
import type { SearchMine } from '@/hooks/useSearchMine';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { foldName } from '@/lib/discover';
import { newDrinkHref } from '@/lib/itemRoutes';
import { openSearchItem } from '@/lib/openSearchItem';
import { learnTitle, madeFirst, usedFor } from '@/lib/paletteRows';
import { drinkFacts, ingredientFacts, menuFacts } from '@/lib/searchCaptions';
import { groupCatalog } from '@/lib/searchScope';
import { capitalize } from '@/lib/stringUtils';
import { searchTechniques, useTechniques } from '@/lib/techniques';
import type { SearchItem } from '@/types/search';

import { MineResults, useMineCatalog } from './MineResults';
import { EverywhereRow } from './ResultRows';
import { KeyCap } from './SearchField';
import { useSearchNavRow } from './searchNav';

/**
 * The list whose first row leads (searchNav): Log a batch when there is one,
 * as drawn, else Go to, so Return opens what was found rather than adding it again.
 */
export const LEAD = 'search-palette-lead';

/** Learn pages under what the place has (Prod-desk-cmdk draws one). */
const LEARN = 3;

/**
 * One of the palette's rows (Prod-desk-cmdk): an icon, the words, what it is
 * on the right, and ↵ on the row the arrow keys are on.
 */
export function PaletteRow({ icon, title, aside, action, onPress }: { icon: IconName; title: string; aside?: string; action?: boolean; onPress: () => void }) {
  const ds = useDs();
  const nav = useSearchNavRow();
  return (
    <PressableScale
      role={action ? 'button' : 'link'}
      accessibilityLabel={[title, aside].filter(Boolean).join('. ')}
      onPress={onPress}
      nativeID={nav.nativeID}
      style={[styles.row, nav.active && { backgroundColor: ds.c.raised }]}
    >
      <IconSymbol name={icon} size={19} color={nav.active ? ds.accentText : ds.c.muted} />
      <Body numberOfLines={1} style={styles.title}>
        {title}
      </Body>
      {aside ? (
        <Caption tone="muted" numberOfLines={1} style={styles.aside}>
          {aside}
        </Caption>
      ) : null}
      {nav.active ? <KeyCap label="↵" /> : null}
    </PressableScale>
  );
}

/** "Do", "Go to": a group's small heading. */
function Head({ label }: { label: string }) {
  return (
    <Caption tone="muted" role="heading" style={styles.head}>
      {label}
    </Caption>
  );
}

/**
 * Do (Prod-desk-cmdk): log a batch of the house-made found (the house-made
 * page's Log batch), then add what's typed, as a new drink or a new
 * house-made, the house-made first when what's typed is closest to an ingredient.
 */
export function PaletteDo({ query, mine, made, batch }: { query: string; mine: SearchMine; made?: boolean; batch?: SearchItem | null }) {
  const router = useRouter();
  const q = query.trim();
  if (!q || (!mine.canAdd && !batch)) return null;
  const name = capitalize(q);
  const drink = <PaletteRow key="drink" icon="plus" action title={`Add “${q}” as a new drink`} onPress={() => router.push(newDrinkHref(name, mine.venueId) as never)} />;
  const house = (
    <PaletteRow
      key="house"
      icon="plus"
      action
      title={`Add “${q}” as a new house-made`}
      onPress={() => router.push({ pathname: '/make-recipe', params: { name, ...(mine.venueId ? { barId: mine.venueId } : {}) } })}
    />
  );
  return (
    <View nativeID={batch ? LEAD : undefined}>
      <Head label="Do" />
      {batch ? <PaletteRow icon="flask" action title={`Log a batch of ${batch.name}`} aside="House-made" onPress={() => router.push(`/ingredient/${batch.id}/make?factor=1` as never)} /> : null}
      {mine.canAdd ? (made ? [house, drink] : [drink, house]) : null}
    </View>
  );
}

/**
 * The palette with something typed, searching where you are (Prod-desk-cmdk):
 * Do, then Go to: the house-mades and bottles, the drinks (one found by what
 * it uses says so), the menus, then Learn's pages, and Search everywhere at
 * the end. Nothing of the place's: Do, any Learn pages, then what everywhere
 * has (MineResults).
 */
export function PaletteResults({ query: typed, mine, onEverywhere }: { query: string; mine: SearchMine; onEverywhere: () => void }) {
  const router = useRouter();
  // The field never waits on the results, as SearchBody's don't.
  const query = useDeferredValue(typed);
  const { items, isLoading } = useMineCatalog(mine);
  const facts = useMineFacts(mine.venueId, items);
  const q = query.trim();
  const groups = useMemo(() => groupCatalog(items, q), [items, q]);
  // The house-mades its drinks use, shared ones too, as the Library's Preps shelf has them.
  const preps = useMemo(() => facts.prepItems.filter((p) => foldName(p.name).includes(foldName(q))), [facts.prepItems, q]);
  const ingredients = [...preps, ...groups.ingredients.filter((i) => !preps.some((p) => p.id === i.id))];
  // Techniques, at a venue that switched them on (lib/venueFeatures.ts), once the library is in (lib/techniques).
  const techniques = useVenueFeature('techniques');
  const library = useTechniques();
  const learn = useMemo(() => (techniques && library ? searchTechniques(q).slice(0, LEARN) : []), [q, techniques, library]);
  const open = (item: SearchItem) => openSearchItem(item, (href) => router.push(href as never));
  const made = madeFirst({ drinks: groups.drinks, ingredients }, q);
  const batch = mine.canPrep ? (preps[0] ?? null) : null;
  const found = ingredients.length + groups.drinks.length + groups.menus.length;
  const drinkIds = groups.drinks.map((i) => i.id);
  const goTo =
    found || learn.length ? (
      <View nativeID={batch ? undefined : LEAD}>
        <Head label="Go to" />
        {ingredients.map((i) => (
          <PaletteRow key={i.id} icon={facts.preps.has(i.id) ? 'flask' : 'drop.fill'} title={i.name} aside={i.isDraft ? 'Draft' : ingredientFacts(i.id, facts)} onPress={() => open(i)} />
        ))}
        {groups.drinks.map((i) => {
          // A drink found by what's in it says so: "Uses Grenadine".
          const via = usedFor(i, q);
          return <PaletteRow key={i.id} icon="place.drinks" title={i.name} aside={i.isDraft ? 'Draft' : via ? `Uses ${via}` : drinkFacts(i.id, i.category ?? 'Cocktail', facts).caption} onPress={() => open(i)} />;
        })}
        {groups.menus.map((i) => (
          <PaletteRow key={i.id} icon="list.bullet" title={i.name} aside={i.isDraft ? 'Draft' : menuFacts(i.id.replace(/^menu-/, ''), drinkIds, facts)} onPress={() => open(i)} />
        ))}
        {learn.map((t) => (
          <PaletteRow key={t.id} icon="book" title={learnTitle(t)} aside="Learn" onPress={() => router.push(`/techniques/${t.id}` as never)} />
        ))}
      </View>
    ) : null;
  return (
    <>
      <PaletteDo query={q} mine={mine} made={made} batch={batch} />
      {goTo}
      {found ? <EverywhereRow label={`Search everywhere for “${q}”`} onPress={onEverywhere} /> : isLoading ? null : <MineResults query={q} mine={mine} onEverywhere={onEverywhere} palette />}
    </>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.sm, paddingBottom: space.xs },
  // 48 tall, its corners round when it's the one in hand (Prod-desk-cmdk).
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.xs, marginHorizontal: -space.md, paddingHorizontal: space.md, borderRadius: radius.control },
  title: { flex: 1, minWidth: 0 },
  aside: { flexShrink: 1, maxWidth: '45%' },
});
