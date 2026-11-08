import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, Field, useDs } from '@/components/ds';
import { DragList, type DragRowState } from '@/components/ds/DragList';
import { DragScrollView } from '@/components/ds/dragScroll';
import { font, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useBarRiffs, useStaffList, useStaffListEdit, type StaffPick } from '@/hooks/useStaffList';
import { plainDbMessage } from '@/lib/dbError';
import { itemHref } from '@/lib/itemRoutes';
import { menuState } from '@/lib/drinksFilters';
import { candidatesFor, classicRows, CUTS, moved, NOT_RANKED, ranked, rankedAbove, STAFF_LIST_MAX, staffOrder, unranked, type ClassicRow } from '@/lib/staffList';

import { StaffRow } from './StaffRow';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

const NO_PICKS: StaffPick[] = [];
/** The "Not ranked yet" line, as a row of the dragged list: drag a drink above it to rank it. */
type Row = ClassicRow | { itemId: typeof NOT_RANKED };
const LINE: Row = { itemId: NOT_RANKED };

/**
 * Classics in Drinks: the staff list, the drinks everyone here should know, most
 * important first, ranked to 50, with cut lines after 10 and 20, then every other
 * drink here linked to a classic under Not ranked yet (E50). Everyone at the venue reads it; Drink
 * Creators and up drag to reorder, add and remove (bar_also_makes, "Also makes", through
 * set_staff_list_order). It is the screen's scroll view, with the screen's
 * header above it, so a held row scrolls the page near its edges.
 */
export function StaffList({ barId, canEdit, onNow, past, header, contentContainerStyle }: {
  barId: string;
  canEdit: boolean;
  onNow: ReadonlySet<string>;
  past: ReadonlySet<string>;
  /** The screen above the list (Drinks' head and chips). */
  header?: ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const picks = useStaffList(barId);
  const [adding, setAdding] = useState(false);
  const riffs = useBarRiffs(barId);
  const catalog = useDrinkLists();
  const edit = useStaffListEdit(barId);
  const [query, setQuery] = useState('');

  const rows = picks.data ?? NO_PICKS;
  const order = staffOrder(classicRows(rows, riffs.data ?? []));
  const ids = order.ranked.map((p) => p.itemId);
  const taken = useMemo(() => new Set(rows.map((p) => p.itemId)), [rows]);
  const results = useMemo(
    () => (adding ? candidatesFor(riffs.data ?? [], catalog.data ?? [], query, taken) : []),
    [adding, riffs.data, catalog.data, query, taken],
  );
  const full = ids.length >= STAFF_LIST_MAX;
  // A linked drink ranked from under the line joins the staff list first.
  const reorder = (itemIds: string[] | null) => {
    if (!itemIds) return;
    const join = order.unranked.filter((r) => !r.onList && itemIds.includes(r.itemId)).map(({ onList: _, ...pick }) => pick);
    edit.mutate(join.length ? { op: 'order', itemIds, join } : { op: 'order', itemIds });
  };
  // Ranked, the Not ranked line, then the rest: one list, so a Not ranked drink drags into the ranking.
  const saved: Row[] = order.unranked.length ? [...order.ranked, LINE, ...order.unranked] : order.ranked;
  const data = saved;
  // A move that leaves the ranking as it was (under the line, which stays A to Z) saves nothing: DragList shows no gap for it and the row goes back to its place.
  const changes = (rows: Row[]) => rankedAbove(rows.map((r) => r.itemId)).join() !== ids.join();
  const dropped = (rows: Row[]) => {
    if (changes(rows)) reorder(rankedAbove(rows.map((r) => r.itemId)));
  };
  const remove = (pick: ClassicRow) => {
    // Close the gap first, so the places stay 1, 2, 3.
    if (pick.rank != null) reorder(unranked(ids, pick.itemId));
    edit.mutate({ op: 'remove', itemId: pick.itemId });
  };
  const row = (pick: ClassicRow, place: number | null) => ({
    pick,
    place,
    status: menuState(pick.itemId, onNow, past),
    canEdit,
    onOpen: () => router.push(itemHref('Cocktail', pick.itemId) as never),
    onPressIn: () => prefetch(pick.itemId, { name: pick.name, imageUrl: pick.imageUrl }),
    // A drink here only because it's linked to a classic stays while it's linked.
    onRemove: pick.onList ? () => remove(pick) : undefined,
  });

  const renderItem = (item: Row, { index: i, lifted, grip }: DragRowState) => {
    if (!('name' in item)) return <CutLine label={`Not ranked yet · ${order.unranked.length}`} quiet />;
    if (i > ids.length) {
      return <StaffRow {...row(item, null)} lifted={lifted} grip={grip} onRank={full ? undefined : () => reorder(ranked(ids, item.itemId))} />;
    }
    const cut = CUTS.find((c) => c === i + 1);
    return (
      <View>
        <StaffRow
          {...row(item, i + 1)}
          lifted={lifted}
          grip={grip}
          onMove={(by) => reorder(moved(ids, item.itemId, by))}
          first={i === 0}
          last={i === ids.length - 1}
          onUnrank={() => reorder(unranked(ids, item.itemId))}
        />
        {cut && !lifted ? <CutLine label={`Top ${cut}`} /> : null}
      </View>
    );
  };

  const top = (
    <View style={styles.top}>
      {header}
      <Body tone="muted">The drinks everyone here should know, most important first, then every other drink linked to a classic.</Body>
      {picks.isLoading ? <Caption tone="muted">Loading the classics…</Caption> : null}
      {picks.error ? <Body tone="muted">Couldn’t load the classics. Check your connection and try again.</Body> : null}
      {edit.error ? <Caption>{plainDbMessage(edit.error) ?? 'Couldn’t save that. Check your connection and try again.'}</Caption> : null}
      {picks.data && riffs.data && !data.length ? <Body tone="muted">No classics yet. Link a drink to a classic and it shows here.</Body> : null}
    </View>
  );
  const bottom = (
    <View style={styles.list}>
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
    // ponytail: every row is rendered, as the old list kept them all mounted for the drag; fine for a bar's few hundred linked drinks, past that page the Not ranked yet rows.
    <DragScrollView style={styles.fill} contentContainerStyle={contentContainerStyle}>
      {top}
      <DragList label="Classics" data={data} keyOf={(p) => p.itemId} still={(r) => !('name' in r)} onReorder={dropped} accept={changes} renderRow={renderItem} />
      {bottom}
    </DragScrollView>
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
  cutText: { ...font.semiBold, letterSpacing: 0.6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  add: { gap: space.sm, paddingTop: space.md },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: space.xs },
  start: { alignSelf: 'flex-start' },
});
