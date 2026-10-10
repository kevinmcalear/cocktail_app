import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useDeleteEvent, useEventDraft, useWeekEvent } from '@/hooks/useWeek';
import { menuStatus } from '@/lib/menus';
import { siteOrigin } from '@/lib/venueLink';
import { kindLabel, timeLine } from '@/lib/week';

import { EventSheet } from './EventSheet';
import { useDotColor } from './WeekParts';

/**
 * One event, as guests see it: the bars, when, whether the house menu is still
 * on, a booking link and the way to the bar. Its team also gets Edit and
 * Delete, and sees team-only events here too.
 */
export function EventScreen({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const column = usePageColumn();
  const { data: event, isLoading } = useWeekEvent(id);
  const caps = useCapabilities(event?.barId);
  const canEdit = Array.isArray(caps.data) && caps.data.includes('menus');
  const draft = useEventDraft(canEdit ? id : null);
  const { data: menus = [] } = useVenueMenus(canEdit ? (event?.barId ?? undefined) : undefined);
  const remove = useDeleteEvent();
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());
  const color = useDotColor();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!event) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={[column, styles.body]}>
          <PageHeader title={isLoading ? 'Event' : 'Event not found'} onBack={back} />
          {isLoading ? null : <Body tone="muted">This event is over, was taken down, or is only for the bar’s team.</Body>}
        </View>
      </View>
    );
  }

  const day = new Date(event.startsAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const place = [event.barName ? `At ${event.barName}` : null, event.houseMenuOn === false ? 'house menu off' : 'house menu still on', event.isPublic ? null : 'team only']
    .filter(Boolean)
    .join(' · ');
  const confirmDelete = () => {
    const go = () => remove.mutate(event.id, { onSuccess: back });
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Delete ${event.name}?`)) go();
    } else {
      Alert.alert(`Delete ${event.name}?`, 'It leaves This week for your team and your guests.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: go },
      ]);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.body]}>
        <PageHeader
          title={event.name}
          onBack={back}
          action={canEdit && draft.data ? <Button label="Edit" variant="secondary" icon="pencil" onPress={() => setEditing(true)} /> : null}
        />
        <Caption color={color(event)}>{kindLabel(event)}</Caption>
        <Headline>{[day, timeLine(event)].filter(Boolean).join(' · ')}</Headline>
        <Body tone="muted">{place}</Body>
        {event.guestName ? <Body>With {event.guestName}</Body> : null}
        {event.description ? <Body>{event.description}</Body> : null}
        {event.drinkCount ? <Caption tone="muted">{`${event.drinkCount} ${event.drinkCount === 1 ? 'drink' : 'drinks'} on the event menu`}</Caption> : null}
        <View style={styles.actions}>
          {event.ticketUrl ? <Button label="Book or get tickets" icon="link" onPress={() => Linking.openURL(event.ticketUrl!)} /> : null}
          {event.isPublic ? (
            <Button label="Add to calendar" icon="calendar" variant={event.ticketUrl ? 'secondary' : 'primary'} onPress={() => Linking.openURL(`${siteOrigin()}/api/week-ics?event=${event.id}`)} />
          ) : null}
          {event.barProfileId ? (
            <Button label={`See ${event.barName ?? 'the bar'}`} variant="secondary" onPress={() => router.push(`/p/${event.barProfileId}` as Href)} />
          ) : null}
          {canEdit && event.menuId ? <Button label="Open the menu" variant="secondary" onPress={() => router.push(`/menus/${event.menuId}` as Href)} /> : null}
        </View>
        {canEdit ? <Button label="Delete event" variant="danger" onPress={confirmDelete} disabled={remove.isPending} style={styles.delete} /> : null}
      </ScrollView>
      {editing && draft.data && event.barId ? (
        <EventSheet
          visible
          barId={event.barId}
          event={draft.data}
          menus={menus.filter((m) => m.barId === event.barId && menuStatus(m, now) !== 'previous').map((m) => ({ id: m.id, name: m.name }))}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.sm, paddingBottom: space.xxxl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  delete: { alignSelf: 'flex-start', marginTop: space.xl },
});
