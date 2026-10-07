import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, PressableScale, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useBarRiffs, useStaffList, useStaffListEdit, type StaffPick } from '@/hooks/useStaffList';
import { plainDbMessage } from '@/lib/dbError';
import { itemHref } from '@/lib/itemRoutes';
import { candidatesFor, cutOf, moved, ranked, STAFF_LIST_MAX, staffOrder, unranked, type Cut } from '@/lib/staffList';

const NO_PICKS: StaffPick[] = [];

const CUT_HINT: Record<Cut, string> = {
  10: 'Suggest these first',
  20: 'The next ten',
  50: 'The rest of the list',
};

/**
 * The staff list in Library: the drinks to know and suggest, ranked, with
 * cut lines at 10, 20 and 50. Everyone at the venue reads it; Drink Creators
 * and up add, order and remove (bar_off_menu, via set_staff_list_order).
 */
export function StaffList({ barId, canEdit, opensAt }: { barId: string; canEdit: boolean; opensAt: string }) {
  const picks = useStaffList(barId);
  const [editing, setEditing] = useState(false);
  const riffs = useBarRiffs(editing ? barId : null);
  const catalog = useDrinkLists();
  const edit = useStaffListEdit(barId);
  const [query, setQuery] = useState('');

  const rows = picks.data ?? NO_PICKS;
  const order = staffOrder(rows);
  const ids = order.ranked.map((p) => p.itemId);
  const taken = useMemo(() => new Set(rows.map((p) => p.itemId)), [rows]);
  const results = useMemo(
    () => (editing ? candidatesFor(riffs.data ?? [], catalog.data ?? [], query, taken) : []),
    [editing, riffs.data, catalog.data, query, taken],
  );
  const full = ids.length >= STAFF_LIST_MAX;
  const reorder = (itemIds: string[] | null) => itemIds && edit.mutate({ op: 'order', itemIds });

  if (picks.isLoading) return <Caption tone="muted">Loading the staff list…</Caption>;
  if (picks.error) return <Body tone="muted">Couldn’t load the staff list. Check your connection and try again.</Body>;

  return (
    <View style={styles.list}>
      <Caption tone="muted">The drinks to know and suggest, in order. Start with the top 10.</Caption>
      {canEdit ? (
        <Button label={editing ? 'Done' : 'Edit the list'} icon={editing ? 'checkmark' : 'list.number'} variant="secondary" onPress={() => setEditing(!editing)} style={styles.start} />
      ) : (
        <Caption tone="muted">{`Ordering this list opens at ${opensAt}.`}</Caption>
      )}
      {editing ? (
        <View style={styles.add}>
          <Field label="Add a classic or your take on one" value={query} onChangeText={setQuery} placeholder="Martini, Negroni" autoCapitalize="none" autoCorrect={false} />
          {results.map((c) => (
            <View key={c.id} style={styles.addRow}>
              <View style={styles.text}>
                <Body>{c.name}</Body>
                {c.classicName && c.classicName !== c.name ? <Caption tone="muted">{c.classicName}</Caption> : null}
              </View>
              <Button label="Add" variant="secondary" onPress={() => edit.mutate({ op: 'add', itemId: c.id }, { onSuccess: () => setQuery('') })} />
            </View>
          ))}
          {query.trim() && !results.length ? <Caption tone="muted">Nothing matches that yet. Link a drink to a classic first, or search the classic’s name.</Caption> : null}
        </View>
      ) : null}
      {edit.error ? <Caption>{plainDbMessage(edit.error) ?? 'Couldn’t save that. Check your connection and try again.'}</Caption> : null}
      {!rows.length ? <Body tone="muted">Nothing on the staff list yet.</Body> : null}

      {order.ranked.map((pick, i) => {
        const cut = cutOf(pick.rank);
        const opens = cut !== cutOf(order.ranked[i - 1]?.rank ?? null);
        return (
          <View key={pick.itemId}>
            {opens && cut ? <CutLine title={`Top ${cut}`} hint={CUT_HINT[cut]} /> : null}
            <Row pick={pick} editing={editing}>
              <IconButton icon="chevron.up" label={`Move ${pick.name} up`} disabled={i === 0} onPress={() => reorder(moved(ids, pick.itemId, -1))} />
              <IconButton icon="chevron.down" label={`Move ${pick.name} down`} disabled={i === ids.length - 1} onPress={() => reorder(moved(ids, pick.itemId, 1))} />
              <IconButton icon="minus" label={`Take ${pick.name} out of the ranking`} onPress={() => reorder(unranked(ids, pick.itemId))} />
            </Row>
          </View>
        );
      })}
      {order.unranked.length ? <CutLine title="Also on the list" hint="Not ranked" /> : null}
      {order.unranked.map((pick) => (
        <Row key={pick.itemId} pick={pick} editing={editing}>
          <IconButton icon="plus" label={`Rank ${pick.name} at the end`} disabled={full} onPress={() => reorder(ranked(ids, pick.itemId))} />
          <IconButton icon="trash" label={`Remove ${pick.name} from the staff list`} onPress={() => edit.mutate({ op: 'remove', itemId: pick.itemId })} />
        </Row>
      ))}
      {editing && full ? <Caption tone="muted">{`The ranking is full at ${STAFF_LIST_MAX}. Take one out to rank another.`}</Caption> : null}
    </View>
  );
}

function CutLine({ title, hint }: { title: string; hint: string }) {
  const ds = useDs();
  return (
    <View style={[styles.cut, { borderTopColor: ds.c.lineStrong }]}>
      <Headline role="heading">{title}</Headline>
      <Caption tone="muted">{hint}</Caption>
    </View>
  );
}

/** One drink: a row that opens it, or, while editing, its name and the controls. */
function Row({ pick, editing, children }: { pick: StaffPick; editing: boolean; children: ReactNode }) {
  const ds = useDs();
  const caption = pick.classicName && pick.classicName !== pick.name ? pick.classicName : undefined;
  return (
    <View style={styles.row}>
      <Caption tone="muted" style={styles.rank}>
        {pick.rank ?? '·'}
      </Caption>
      {editing ? (
        <View style={[styles.editRow, { borderBottomColor: ds.c.line }]}>
          <View style={styles.text}>
            <Body numberOfLines={1}>{pick.name}</Body>
            {caption ? <Caption tone="muted">{caption}</Caption> : null}
          </View>
          {children}
        </View>
      ) : (
        <View style={styles.text}>
          <DrinkRow
            name={pick.name}
            caption={caption}
            href={itemHref('Cocktail', pick.itemId)}
            imageUrl={pick.imageUrl}
            itemId={pick.itemId}
            glass="Coupe"
            label={pick.rank ? `${pick.rank}. ${pick.name}` : pick.name}
          />
        </View>
      )}
    </View>
  );
}

function IconButton({ icon, label, disabled, onPress }: { icon: 'chevron.up' | 'chevron.down' | 'minus' | 'plus' | 'trash'; label: string; disabled?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} aria-disabled={disabled} disabled={disabled} onPress={onPress} style={[styles.icon, { opacity: disabled ? 0.3 : 1 }]}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
  add: { gap: space.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: space.xs },
  cut: { gap: space.xs, paddingTop: space.md, marginTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rank: { width: 24, textAlign: 'right' },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
