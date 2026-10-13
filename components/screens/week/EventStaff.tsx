import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, TextLink, useDs } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useEventStaff } from '@/hooks/useEventStaff';
import { staffChips, type StaffChip } from '@/lib/eventStaff';
import type { WeekItem } from '@/lib/week';

import { EventStaffSheet } from './EventStaffSheet';

/** The initials circle and the pill around it, as week-event-guest draws them. */
const AVATAR = 32;

/**
 * "Behind the bar" on an event's page (week-event-guest): who's working it,
 * "Jun A., Pale Moth" and "Sam O., Little Rye", each opening their profile
 * when they have a public one. People who don't show themselves publicly come
 * back unnamed from the server and read as their side only ("Little Rye
 * team"). Whoever manages the bar's events gets Edit.
 */
export function EventStaff({ event, canEdit }: { event: WeekItem; canEdit: boolean }) {
  const { data: rows = [] } = useEventStaff(event.id);
  const [editing, setEditing] = useState(false);
  const guestBar = event.guestProfileId || event.eventKind === 'takeover' ? event.guestName : null;
  const chips = staffChips(rows, { barName: event.barName, guestBar });
  if (!chips.length && !canEdit) return null;
  return (
    <View role="region" accessibilityLabel="Behind the bar" style={styles.section}>
      <View style={styles.head}>
        <Eyebrow>Behind the bar</Eyebrow>
        {canEdit ? <TextLink label={rows.length ? 'Edit' : 'Add'} accessibilityHint="Who's working this event" onPress={() => setEditing(true)} /> : null}
      </View>
      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <StaffPill key={c.key} chip={c} />
          ))}
        </View>
      ) : (
        <Caption tone="muted">Add who&apos;s working it: your team, or guest bartenders by name.</Caption>
      )}
      {editing && event.barId ? <EventStaffSheet event={event} rows={rows} onClose={() => setEditing(false)} /> : null}
    </View>
  );
}

function StaffPill({ chip }: { chip: StaffChip }) {
  const ds = useDs();
  const router = useRouter();
  const body = (
    <>
      {chip.person ? <UserAvatar name={chip.person} size={AVATAR} /> : <View aria-hidden style={[styles.blank, { backgroundColor: ds.c.lineStrong }]} />}
      <Body numberOfLines={1} style={styles.label}>
        {chip.label}
      </Body>
    </>
  );
  const look = [styles.pill, { backgroundColor: ds.c.raised }];
  return chip.profileId ? (
    <PressableScale role="link" accessibilityLabel={chip.spoken} onPress={() => router.push(`/p/${chip.profileId}` as Href)} style={look}>
      {body}
    </PressableScale>
  ) : (
    <View style={look}>{body}</View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingLeft: space.xs, paddingRight: space.md, borderRadius: radius.pill, maxWidth: '100%' },
  blank: { width: AVATAR, height: AVATAR, borderRadius: radius.pill },
  label: { flexShrink: 1 },
});
