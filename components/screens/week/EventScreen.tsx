import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Body, BrandProvider, Button, Caption, DsText, GlassButton, PressableScale, TextLink, useDisplayFaces, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useBarPlace, useDeleteEvent, useEventDraft, useWeekEvent, useWeekEventBrand } from '@/hooks/useWeek';
import { faceFromDb, usableGroundTint } from '@/lib/brand';
import { menuStatus } from '@/lib/menus';
import { isHexColor } from '@/lib/color';
import { isApplePlatform } from '@/lib/platformKeys';
import { shareLink } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';
import { directionsUrl, kindLabel, timeLine, type WeekItem } from '@/lib/week';

import { EventDrinks } from './EventDrinks';
import { EventSheet } from './EventSheet';
import { EventStaff } from './EventStaff';
import { useDotColor } from './WeekParts';

/**
 * One event, as guests see it: the bars, when, whether the house menu is still
 * on, a booking link, Share, and Directions to the bar. Its team also gets Edit and
 * Delete, and sees team-only events here too. The page wears the bar's accent
 * (the guest bar's on a takeover, when we know it), as week-event-guest draws it.
 */
export function EventScreen({ id }: { id: string }) {
  const { data: event } = useWeekEvent(id);
  const { data: brand } = useWeekEventBrand(id);
  const takeover = event?.eventKind === 'takeover';
  const side = (takeover && brand?.guest) || brand?.host;
  const accent = [side?.accent, takeover ? event?.guestColor : null, event?.barColor].find((c): c is string => isHexColor(c));
  return (
    <BrandProvider accent={accent} displayFace={side?.face ? faceFromDb(side.face) : undefined} groundTint={usableGroundTint(side?.tint) ?? undefined}>
      <EventPage id={id} />
    </BrandProvider>
  );
}

function EventPage({ id }: { id: string }) {
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
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null);
  const barPlace = useBarPlace(event?.barProfileId);
  const directions = directionsUrl(barPlace.data, Platform.OS === 'ios' || (Platform.OS === 'web' && isApplePlatform()));
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

  const starts = new Date(event.startsAt);
  const short = starts.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const day = starts.toDateString() === new Date(now).toDateString() ? `Tonight, ${short}` : short;
  const place = [event.barName ? `At ${event.barName}` : null, event.ticketUrl ? null : 'walk-ins only', event.houseMenuOn === false ? 'house menu off' : 'house menu still on', event.isPublic ? null : 'team only']
    .filter(Boolean)
    .join(' · ');
  const link = `${siteOrigin()}/e/${event.id}`;
  const share = async () => {
    try {
      setShared((await shareLink(link, event.name)) === 'copied' ? 'copied' : null);
    } catch {
      setShared('failed');
    }
  };
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
          actionOnTop
          above={
            <View style={styles.above}>
              <EventMarks event={event} />
              <Caption color={color(event)}>{kindLabel(event)}</Caption>
            </View>
          }
          action={
            <View style={styles.top}>
              {canEdit && draft.data ? <Button label="Edit" variant="secondary" icon="pencil" onPress={() => setEditing(true)} /> : null}
              <GlassButton icon="square.and.arrow.up" accessibilityLabel={shared === 'copied' ? 'Link copied' : 'Share'} onPress={share} />
            </View>
          }
        />
        <Body style={styles.when}>{[day, timeLine(event)].filter(Boolean).join(' · ')}</Body>
        {event.barProfileId ? (
          <PressableScale role="link" accessibilityLabel={`${place}. See ${event.barName ?? 'the bar'}`} onPress={() => router.push(`/p/${event.barProfileId}` as Href)}>
            <Body tone="muted">{place}</Body>
          </PressableScale>
        ) : (
          <Body tone="muted">{place}</Body>
        )}
        {event.guestName && event.eventKind !== 'takeover' ? <Body>With {event.guestName}</Body> : null}
        {event.description ? <Body>{event.description}</Body> : null}
        <View style={styles.actions}>
          {event.ticketUrl ? <Button label="Book or get tickets" icon="link" onPress={() => Linking.openURL(event.ticketUrl!)} style={styles.flex} /> : null}
          {event.isPublic ? (
            <Button label="Add to calendar" variant={event.ticketUrl ? 'secondary' : 'primary'} onPress={() => Linking.openURL(`${siteOrigin()}/api/week-ics?event=${event.id}`)} style={styles.flex} />
          ) : null}
          {directions ? <Button label="Directions" variant="secondary" onPress={() => Linking.openURL(directions)} style={styles.flex} /> : null}
        </View>
        <EventDrinks event={event} />
        {canEdit && event.menuId ? <TextLink label="Open the menu" onPress={() => router.push(`/menus/${event.menuId}` as Href)} /> : null}
        <EventStaff event={event} canEdit={canEdit} />
        {shared === 'failed' ? <Caption tone="muted">{link}</Caption> : null}
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

/** The bars' square marks, the guest's over the host's for a takeover (week-event-guest). */
function EventMarks({ event }: { event: WeekItem }) {
  const ds = useDs();
  const brand = useWeekEventBrand(event.id).data;
  type Mark = { name: string; color: string | null | undefined; face: string | null | undefined };
  const marks = [
    event.eventKind === 'takeover' && event.guestName ? { name: event.guestName, color: event.guestColor ?? brand?.guest?.accent, face: brand?.guest?.face } : null,
    { name: event.barName ?? event.name, color: event.barColor ?? brand?.host.accent, face: brand?.host.face },
  ].filter((m): m is Mark => !!m);
  const family = useDisplayFaces(marks.map((m) => (m.face ? faceFromDb(m.face) : null)));
  return (
    <View aria-hidden style={styles.marks}>
      {marks.map((m, i) => {
        const color = isHexColor(m.color) ? m.color : null;
        // Each bar's letter in its own display face, as the board draws P and L.
        const face = family(m.face ? faceFromDb(m.face) : ds.displayFace, 'italic');
        return (
          <View key={m.name} style={[styles.mark, { backgroundColor: color ?? ds.c.raised }, i ? [styles.over, { borderColor: ds.c.ground }] : null]}>
            <DsText variant="title" color={color ? ds.c.ground : ds.c.ink} style={{ fontFamily: face }}>
              {m.name.slice(0, 1).toUpperCase()}
            </DsText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.sm, paddingBottom: space.xxxl },
  above: { gap: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  when: { fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1 },
  marks: { flexDirection: 'row' },
  mark: { width: 52, height: 52, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  over: { marginLeft: -12, borderWidth: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  delete: { alignSelf: 'flex-start', marginTop: space.xl },
});
