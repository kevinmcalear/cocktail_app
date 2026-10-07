import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DraggableFlatList, { NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Body, Button, Caption, Field, useBreakpoint, useDs } from '@/components/ds';
import { supportsNestableDrag } from '@/components/recipe/FormScrollContainer';
import { fontFamilies, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useBarRiffs, useStaffList, useStaffListEdit, type StaffPick } from '@/hooks/useStaffList';
import { plainDbMessage } from '@/lib/dbError';
import { itemHref } from '@/lib/itemRoutes';
import { menuState } from '@/lib/libraryFilters';
import { candidatesFor, CUTS, moved, ranked, STAFF_LIST_MAX, staffOrder, unranked } from '@/lib/staffList';

import { StaffRow } from './StaffRow';

const NO_PICKS: StaffPick[] = [];
const List = supportsNestableDrag ? NestableDraggableFlatList : DraggableFlatList;

/**
 * The staff list in Library: the drinks every new hire should know, ranked to
 * 50, with cut lines after 10 and 20. Everyone at the venue reads it; Drink
 * Creators and up drag to reorder, add and remove (bar_off_menu, through
 * set_staff_list_order). On native it must sit in a NestableScrollContainer.
 */
export function StaffList({ barId, canEdit, onNow, past }: { barId: string; canEdit: boolean; onNow: ReadonlySet<string>; past: ReadonlySet<string> }) {
  const router = useRouter();
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
    onRemove: () => remove(pick),
  });

  if (picks.isLoading) return <Caption tone="muted">Loading the staff list…</Caption>;
  if (picks.error) return <Body tone="muted">Couldn’t load the staff list. Check your connection and try again.</Body>;

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

  return (
    <View style={styles.list}>
      <Body tone="muted">The drinks every new hire should know, in order. Drink Creators and Admins can drag to reorder.</Body>
      {edit.error ? <Caption>{plainDbMessage(edit.error) ?? 'Couldn’t save that. Check your connection and try again.'}</Caption> : null}
      {!rows.length ? <Body tone="muted">Nothing on the staff list yet.</Body> : null}
      {order.ranked.length ? (
        <List
          data={order.ranked}
          keyExtractor={(p) => p.itemId}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorder(data.map((p) => p.itemId))}
          scrollEnabled={false}
          // It doesn't scroll itself, so nothing may be held back: render all 50.
          initialNumToRender={STAFF_LIST_MAX}
          activationDistance={10}
        />
      ) : null}
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
  list: { gap: space.xs },
  cut: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.sm },
  cutText: { fontFamily: fontFamilies.bodySemiBold, letterSpacing: 0.6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  add: { gap: space.sm, paddingTop: space.md },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: space.xs },
  start: { alignSelf: 'flex-start' },
});
