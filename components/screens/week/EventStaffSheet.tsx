import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { NearPicks, splitNear } from '@/components/search/NearPicks';
import { radius, space } from '@/constants/tokens';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useAddEventStaff, useRemoveEventStaff, type NewStaff } from '@/hooks/useEventStaff';
import { usePublicPeople } from '@/hooks/useProfiles';
import type { EventStaffRow } from '@/lib/eventStaff';
import type { WeekItem } from '@/lib/week';

/**
 * Who's behind the bar at an event, for whoever manages the bar's events:
 * people from the team by a tap, and guest bartenders by name, linked to
 * their profile here when they have one. Each change saves as it's made.
 * Guests see a teammate's name only when that person's public profile shows
 * the job; the sheet says so.
 */
export function EventStaffSheet({ event, rows, onClose }: { event: WeekItem; rows: EventStaffRow[]; onClose: () => void }) {
  const ds = useDs();
  const { data: members = [] } = useBarMembers(event.barId);
  const add = useAddEventStaff();
  const remove = useRemoveEventStaff();
  const [guest, setGuest] = useState('');
  const [linked, setLinked] = useState<{ id: string; name: string } | null>(null);
  const [people, near] = splitNear(usePublicPeople(linked ? '' : guest, { near: true }).data ?? []);
  const [error, setError] = useState<string | null>(null);

  const taken = new Set(rows.map((r) => r.userId).filter(Boolean));
  const personChip = (p: (typeof people)[number]) => (
    <Chip
      key={p.id}
      selected={false}
      label={p.job ? `${p.display_name}, ${p.job}` : p.display_name}
      onPress={() => {
        setLinked({ id: p.id, name: p.display_name });
        setGuest(p.display_name);
      }}
    />
  );
  const next = rows.reduce((n, r) => Math.max(n, r.sortOrder + 1), 0);
  const busy = add.isPending || remove.isPending;
  const team = event.barName ?? 'your team';

  const put = (s: Omit<NewStaff, 'eventId' | 'sortOrder'>, then?: () => void) => {
    setError(null);
    add.mutate({ ...s, eventId: event.id, sortOrder: next } as NewStaff, {
      onSuccess: then,
      onError: (e) => setError(e instanceof Error ? e.message : "Couldn't add them. Try again."),
    });
  };
  const addGuest = () => {
    const name = guest.trim() || linked?.name || '';
    if (!name) return setError('Type their name.');
    put({ guestName: name, profileId: linked?.id ?? null }, () => {
      setGuest('');
      setLinked(null);
    });
  };

  return (
    <MenuSheet visible onClose={onClose} title="Behind the bar" subtitle={event.name}>
      {rows.length ? (
        <View role="list" accessibilityLabel="Working this event" style={styles.list}>
          {rows.map((r) => (
            <View key={r.id} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <View style={styles.flex}>
                <DsText numberOfLines={1}>{r.name ?? 'Someone'}</DsText>
                <Caption tone="muted">{r.isGuest ? (r.profileId ? 'Guest, linked to their profile' : 'Guest') : `${team} team`}</Caption>
              </View>
              <PressableScale role="button" accessibilityLabel={`Take ${r.name ?? 'them'} off`} disabled={busy} onPress={() => remove.mutate(r.id)} style={styles.remove}>
                <Caption tone="accent">Remove</Caption>
              </PressableScale>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Caption tone="muted">From {team}</Caption>
        <View role="group" accessibilityLabel={`Add from ${team}`} style={styles.chips}>
          {members
            .filter((m) => !taken.has(m.user_id))
            .map((m) => (
              <Chip key={m.user_id} multi selected={false} disabled={busy} label={m.display_name ?? 'Teammate'} onPress={() => put({ userId: m.user_id })} />
            ))}
        </View>
        <Caption tone="muted">Guests see a teammate&apos;s name only when their public profile shows they work here. Otherwise it says {team} team.</Caption>
      </View>

      <View style={styles.block}>
        <Field
          label="A guest bartender"
          value={guest}
          onChangeText={(t) => {
            setGuest(t);
            if (linked && !t.trim()) setLinked(null);
          }}
          placeholder="Jun A."
          autoCapitalize="words"
          autoCorrect={false}
        />
        {linked ? (
          <View style={[styles.linked, { backgroundColor: ds.c.raised }]}>
            <Caption style={styles.flex}>Linked to {linked.name}</Caption>
            <PressableScale role="button" accessibilityLabel={`Unlink ${linked.name}`} onPress={() => setLinked(null)} style={styles.remove}>
              <Caption tone="accent">Unlink</Caption>
            </PressableScale>
          </View>
        ) : people.length || near.length ? (
          <View role="group" accessibilityLabel="Link their profile" style={styles.links}>
            <View style={styles.chips}>{people.map(personChip)}</View>
            <NearPicks found={people.length > 0} near={near} render={personChip} rowStyle={styles.chips} />
          </View>
        ) : null}
        <Caption tone="muted">Shown as you type it. Pick their profile if they have one here, so guests can open it.</Caption>
        <Button label="Add guest" variant="secondary" disabled={busy || !(guest.trim() || linked)} onPress={addGuest} style={styles.add} />
      </View>
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  links: { gap: space.xs },
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  remove: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  linked: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.md, borderRadius: radius.control },
  add: { alignSelf: 'flex-start' },
});
