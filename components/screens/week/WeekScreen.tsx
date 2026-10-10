import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Headline, Title, useBreakpoint, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { backbar, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useBarWeek, useMyWeek, useWeekStart } from '@/hooks/useWeek';
import { toDay } from '@/lib/collection';
import { itemHref } from '@/lib/itemRoutes';
import { menuStatus } from '@/lib/menus';
import { byDay, filterWeek, itemDay, newDrinks, shortDay, upcoming, weekRange, type WeekFilter, type WeekItem } from '@/lib/week';

import { EventSheet } from './EventSheet';
import { WeekAgenda, WeekColumns } from './WeekColumns';
import { WeekRibbon } from './WeekParts';

const FILTERS: { key: WeekFilter; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'events', label: 'Events' },
  { key: 'menus', label: 'Menus and drinks' },
  { key: 'public', label: 'Only what guests see' },
];

/**
 * The week page: the next seven days at this venue (events, menus going on,
 * new drinks), or at home the bars you love and your own dated menus. Desktop
 * lays the days out as columns; phones as a list under the day ribbon.
 */
export function WeekScreen() {
  const ds = useDs();
  const router = useRouter();
  const wide = useBreakpoint() === 'desktop';
  const column = usePageColumn(wide ? 'wide' : 'text');
  const bottom = useTabBarInset();
  const { mode } = useMode();
  const venue = mode === 'venue';
  const { active } = useActiveVenue();
  const barId = venue ? (active?.id ?? null) : null;
  const barWeek = useBarWeek(barId);
  const myWeek = useMyWeek();
  const caps = useCapabilities(barId);
  const canAdd = venue && Array.isArray(caps.data) && caps.data.includes('menus');
  const { data: menus = [] } = useVenueMenus(barId ?? undefined);
  const from = useWeekStart();
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<WeekFilter>('all');
  const [addingOn, setAddingOn] = useState<string | null>(null);
  // Dates come from the device's clock, which the static web build doesn't have.
  const hydrated = useIsHydrated();

  const all = (venue ? barWeek.data : myWeek.data) ?? [];
  const items = filterWeek(all, filter);
  const days = byDay(items, from);
  const on = upcoming(all, from);
  const fresh = newDrinks(items);
  const eventMenus = menus.filter((m) => m.barId === barId && menuStatus(m, now) !== 'previous').map((m) => ({ id: m.id, name: m.name }));
  const subtitle = [weekRange(from), `${on.length} on`, fresh.length ? `${fresh.length} new ${fresh.length === 1 ? 'drink' : 'drinks'}` : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.body, { paddingBottom: bottom + space.xl }]}>
        <PageHeader
          title="This week"
          subtitle={hydrated ? subtitle : null}
          width={wide ? 'wide' : 'text'}
          onBack={router.canGoBack() ? () => router.back() : undefined}
          action={canAdd ? <Button label="Add event" icon="plus" onPress={() => setAddingOn(toDay(from))} /> : null}
        />
        {venue ? (
          <View role="radiogroup" accessibilityLabel="Show" style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} quiet />
            ))}
          </View>
        ) : null}
        {!hydrated ? null : wide ? (
          <WeekColumns days={days} from={from} member={venue} onAdd={canAdd ? setAddingOn : undefined} />
        ) : (
          <>
            <WeekRibbon days={days} today={toDay(from)} />
            <WeekAgenda days={days} from={from} member={venue} bar={!venue} onAdd={canAdd ? setAddingOn : undefined} />
          </>
        )}
        {!on.length && !(venue ? barWeek.isLoading : myWeek.isLoading) ? <EmptyWeek venue={venue} canAdd={canAdd} /> : null}
        <View style={[styles.lower, wide && styles.lowerWide]}>
          <NewDrinks drinks={fresh} from={from} venue={venue} barName={active?.name} />
          {venue ? <GuestView items={on.filter((i) => i.isPublic)} from={from} barName={active?.name} /> : null}
        </View>
      </ScrollView>
      {addingOn && barId ? <EventSheet visible barId={barId} menus={eventMenus} day={addingOn} onClose={() => setAddingOn(null)} /> : null}
    </View>
  );
}

function EmptyWeek({ venue, canAdd }: { venue: boolean; canAdd: boolean }) {
  return (
    <View style={styles.empty}>
      <Headline>Nothing on this week yet</Headline>
      <Body tone="muted">
        {venue
          ? canAdd
            ? 'Menus going on and new drinks show up here by themselves. Add a takeover, a guest shift or a tasting and your team sees it on Tonight.'
            : 'Menus going on, new drinks and events show here once someone on the team adds them.'
          : 'Love a bar and its events, new menus and new drinks show here, with your own dated home menus.'}
      </Body>
    </View>
  );
}

function NewDrinks({ drinks, from, venue, barName }: { drinks: WeekItem[]; from: Date; venue: boolean; barName?: string }) {
  if (!drinks.length) return null;
  const since = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 7).toLocaleDateString(undefined, { weekday: 'long' });
  return (
    <View style={styles.flexPanel}>
      <DsText variant="caption" tone="muted" style={styles.caps}>
        {venue ? `New at ${barName ?? 'your bar'} since last ${since}` : 'New at bars you love'}
      </DsText>
      {drinks.map((d) => (
        <DrinkRow
          key={d.id}
          name={d.name}
          href={itemHref('Cocktail', d.id)}
          itemId={d.id}
          imageUrl={d.imageUrl}
          glass={d.glassKey}
          caption={[venue ? null : d.barName, `${venue ? 'Added' : 'New'} ${shortDay(itemDay(d), from)}`, venue ? (d.isPublic ? 'guests can see it' : 'team only') : null]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
    </View>
  );
}

/** What the bar page and Discover show of this week: the public things only, on paper like the menu card. */
function GuestView({ items, from, barName }: { items: WeekItem[]; from: Date; barName?: string }) {
  const paper = backbar.light;
  return (
    <View role="region" accessibilityLabel="What guests see" style={[styles.paper, { backgroundColor: backbar.dark.paper }]}>
      <Caption color={paper.muted}>On your bar page and in Discover</Caption>
      <Title color={paper.ink}>This week at {barName ?? 'your bar'}</Title>
      {items.length ? (
        items.map((i) => (
          <View key={`${i.kind}-${i.id}`} style={[styles.paperRow, { borderBottomColor: paper.lineStrong }]}>
            <Body color={paper.ink} style={styles.flex}>
              {i.name}
            </Body>
            <Caption color={paper.muted}>{shortDay(itemDay(i), from)}</Caption>
          </View>
        ))
      ) : (
        <Body color={paper.muted}>Nothing public this week. Set an event to Everyone and it shows here.</Body>
      )}
      <Caption color={paper.muted}>Team-only events never show here.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  empty: { gap: space.sm, paddingVertical: space.md },
  lower: { gap: space.xl, marginTop: space.md },
  lowerWide: { flexDirection: 'row', alignItems: 'flex-start' },
  flexPanel: { flex: 1, minWidth: 0 },
  caps: { textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.xs },
  paper: { flex: 1, minWidth: 0, gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  paperRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
