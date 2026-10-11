import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';

import { Body, Button, Caption, Field, useBreakpoint, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useBarRiffs, useStaffList, useStaffListEdit, type StaffPick } from '@/hooks/useStaffList';
import { plainDbMessage } from '@/lib/dbError';
import { itemHref } from '@/lib/itemRoutes';
import { menuState } from '@/lib/libraryFilters';
import { candidatesFor, CUTS, moved, ranked, STAFF_LIST_MAX, staffOrder, unranked } from '@/lib/staffList';

import { StaffRow } from './StaffRow';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

const NO_PICKS: StaffPick[] = [];
/** Rows in the first paint: a phone screen under the header. */
const FIRST_PAINT = 12;

/**
 * The staff list in Library: the drinks everyone here should know, most
 * important first, ranked to 50, with cut lines after 10 and 20. Everyone at the venue reads it; Drink
 * Creators and up drag to reorder, add and remove (bar_off_menu, through
 * set_staff_list_order). It is the screen's scroll view, with the screen's
 * header above it: nested in another scroll view, its drag gesture takes
 * every vertical swipe on Android and the page stops scrolling.
 */
export function StaffList({ barId, canEdit, onNow, past, header, contentContainerStyle }: {
  barId: string;
  canEdit: boolean;
  onNow: ReadonlySet<string>;
  past: ReadonlySet<string>;
  /** The screen above the list (Library's title and filters). */
  header?: ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const breakpoint = useBreakpoint();
  const arrows = Platform.OS === 'web' && breakpoint !== 'phone';
  const picks = useStaffList(barId);
  const [adding, setAdding] = useState(false);
  const riffs = useBarRiffs(adding ? barId : null);
  const catalog = useDrinkLists();
  const edit = useStaffListEdit(barId);
  const [query, setQuery] = useState('');

  const rows = picks.data ?? NO_PICKS;
  const order = staffOrder(rows);
  const ids = order.ranked.map((p) => p.itemId);
  const taken = useMemo(() => new Set(rows.map((p) => p.itemId)), [rows]);
  const results = useMemo(
    () => (adding ? candidatesFor(riffs.data ?? [], catalog.data ?? [], query, taken) : []),
    [adding, riffs.data, catalog.data, query, taken],
  );
  const full = ids.length >= STAFF_LIST_MAX;
  const reorder = (itemIds: string[] | null) => itemIds && edit.mutate({ op: 'order', itemIds });
  const remove = (pick: StaffPick) => {
    // Close the gap first, so the places stay 1, 2, 3.
    if (pick.rank != null) reorder(unranked(ids, pick.itemId));
    edit.mutate({ op: 'remove', itemId: pick.itemId });
  };
  const row = (pick: StaffPick, place: number | null) => ({
    pick,
    place,
    status: menuState(pick.itemId, onNow, past),
    canEdit,
    onOpen: () => router.push(itemHref('Cocktail', pick.itemId) as never),
    onPressIn: () => prefetch(pick.itemId, { name: pick.name, imageUrl: pick.imageUrl }),
    onRemove: () => remove(pick),
  });

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<StaffPick>) => {
    const i = getIndex() ?? 0;
    const cut = CUTS.find((c) => c === i + 1);
    return (
      <View>
        <StaffRow
          {...row(item, i + 1)}
          active={isActive}
          drag={drag}
          arrows={arrows}
          onMove={(by) => reorder(moved(ids, item.itemId, by))}
          first={i === 0}
          last={i === ids.length - 1}
          onUnrank={() => reorder(unranked(ids, item.itemId))}
        />
        {cut && !isActive ? <CutLine label={`Top ${cut}`} /> : null}
      </View>
    );
  };

  const top = (
    <View style={styles.top}>
      {header}
      <Body tone="muted">The drinks everyone here should know, most important first. Drink Creators and Admins can drag to reorder.</Body>
      {picks.isLoading ? <Caption tone="muted">Loading the staff list…</Caption> : null}
      {picks.error ? <Body tone="muted">Couldn’t load the staff list. Check your connection and try again.</Body> : null}
      {edit.error ? <Caption>{plainDbMessage(edit.error) ?? 'Couldn’t save that. Check your connection and try again.'}</Caption> : null}
      {picks.data && !rows.length ? <Body tone="muted">Nothing on the staff list yet.</Body> : null}
    </View>
  );
  const bottom = (
    <View style={styles.list}>
      {order.unranked.length ? (
        <>
          <CutLine label="Not ranked" quiet />
          {order.unranked.map((pick) => (
            <StaffRow key={pick.itemId} {...row(pick, null)} onRank={full ? undefined : () => reorder(ranked(ids, pick.itemId))} />
          ))}
        </>
      ) : null}
      {canEdit ? (
        <View style={styles.add}>
          <Caption tone="muted">{`Up to ${STAFF_LIST_MAX} drinks. ${ids.length} ranked.`}</Caption>
          {adding ? (
            <>
              <Field label="Add a classic or your take on one" value={query} onChangeText={setQuery} placeholder="Martini, Negroni" autoCapitalize="none" autoCorrect={false} />
              {results.map((c) => (
                <View key={c.id} style={styles.result}>
                  <View style={styles.flex}>
                    <Body>{c.name}</Body>
                    {c.classicName && c.classicName !== c.name ? <Caption tone="muted">{c.classicName}</Caption> : null}
                  </View>
                  <Button label="Add" variant="secondary" onPress={() => edit.mutate({ op: 'add', itemId: c.id }, { onSuccess: () => setQuery('') })} />
                </View>
              ))}
              {query.trim() && !results.length ? <Caption tone="muted">Nothing matches that yet. Link a drink to a classic first, or search the classic’s name.</Caption> : null}
            </>
          ) : (
            <Button label="Add a drink" icon="plus" variant="secondary" onPress={() => setAdding(true)} style={styles.start} />
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <DraggableFlatList
      data={order.ranked}
      keyExtractor={(p) => p.itemId}
      renderItem={renderItem}
      onDragEnd={({ data }) => reorder(data.map((p) => p.itemId))}
      ListHeaderComponent={top}
      ListFooterComponent={bottom}
      contentContainerStyle={contentContainerStyle}
      // The list's wrapper must fill the screen, or on web it grows to its
      // content and the screen clips it, so it never scrolls.
      containerStyle={styles.fill}
      // Fifty rows at most. The first screen paints, the rest mount in one batch
      // right after, and the default window (21 screens) keeps all fifty mounted,
      // so a drag never lands on an unrendered row.
      initialNumToRender={FIRST_PAINT}
      maxToRenderPerBatch={STAFF_LIST_MAX}
      activationDistance={10}
    />
  );
}

/** "TOP 10" with a rule after it, in the accent: where the ranking is cut. */
function CutLine({ label, quiet }: { label: string; quiet?: boolean }) {
  const ds = useDs();
  const color = quiet ? ds.c.muted : ds.accentText;
  return (
    <View style={styles.cut} role="heading" aria-label={label}>
      <Caption color={color} style={styles.cutText}>
        {label.toUpperCase()}
      </Caption>
      <View style={[styles.rule, { backgroundColor: color, opacity: 0.4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { gap: space.xs },
  top: { gap: space.md, paddingBottom: space.sm },
  cut: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.sm },
  cutText: { fontFamily: fontFamilies.bodySemiBold, letterSpacing: 0.6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  add: { gap: space.sm, paddingTop: space.md },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: space.xs },
  start: { alignSelf: 'flex-start' },
});
