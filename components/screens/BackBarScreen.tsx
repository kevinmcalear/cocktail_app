import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackBarPlan } from '@/components/backbar/BackBarPlan';
import { AddZone, ZoneEditor } from '@/components/backbar/PlanEditor';
import { WaitingForSpot } from '@/components/backbar/WaitingForSpot';
import { ZoneInspector } from '@/components/backbar/ZoneInspector';
import { Body, Button, Caption, Display, GlassButton, LockedSection, Surface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarZones, useItemLocations, useLocationMutations, useWaitingForSpot, useZoneMutations } from '@/hooks/useBackBar';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { moveRectTo, rectColumns, summaryLine, zoneRect, type NamedItem } from '@/lib/backBar';
import { roleLabel } from '@/lib/roles';
import type { BarZone, ItemLocation } from '@/types/backBar';

/**
 * The back bar map: the venue's zones on a plan, what lives in each, and the
 * ingredients still waiting for a spot. Everyone with `locations` reads it;
 * Drink Creators and up draw the plan; they and anyone with `prep` place items.
 */
export function BackBarScreen({ placeItem }: { placeItem?: NamedItem }) {
  const ds = useDs();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sidebar = useIsWideWeb();
  const { active } = useActiveVenue();
  const barId = active?.id ?? null;

  const caps = useCapabilities(barId);
  // Guard against a stale persisted cache entry that isn't an array.
  const capabilities = Array.isArray(caps.data) ? caps.data : null;
  const canRead = !!capabilities?.includes('locations');
  // Mirrors the policies: zones need level 35 (edit_drinks); locations also allow `prep`.
  const canDraw = !!capabilities?.includes('edit_drinks');
  const canPlace = canDraw || !!capabilities?.includes('prep');
  const { data: opensAt } = useCapabilityOpensAt(barId, 'locations');

  const zonesQuery = useBarZones(canRead ? barId : null);
  const locationsQuery = useItemLocations(canRead ? barId : null);
  const { waiting } = useWaitingForSpot(canRead ? barId : null);
  const zones = zonesQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const { updateZone } = useZoneMutations(barId);
  const { placeItem: place, updateLocation } = useLocationMutations(barId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState<NamedItem | null>(null);
  const [pendingPlace, setPendingPlace] = useState(placeItem ?? null);
  const [moving, setMoving] = useState<ItemLocation | null>(null);
  const [openLocationId, setOpenLocationId] = useState<string | null>(null);

  // An item handed over from its page ("Place it on the map") waits until we know the person can place it.
  if (pendingPlace && capabilities) {
    setPlacing(canPlace ? pendingPlace : null);
    setPendingPlace(null);
  }

  const selected = zones.find((z) => z.id === selectedId) ?? zones.find((z) => zoneRect(z)) ?? null;
  const contents = selected ? locations.filter((l) => l.zone_id === selected.id) : [];
  const task = placing ? `Tap the zone where ${placing.name} lives.` : moving ? `Tap the zone to move ${moving.item?.name ?? 'it'} to.` : null;

  const onPressZone = (zone: BarZone) => {
    if (placing) {
      place.mutate({ itemId: placing.id, zoneId: zone.id });
      setPlacing(null);
    } else if (moving) {
      if (zone.id !== moving.zone_id) updateLocation.mutate({ id: moving.id, changes: { zone_id: zone.id } });
      setMoving(null);
    }
    setSelectedId(zone.id);
    setOpenLocationId(null);
  };
  const onPressPlan =
    editing && selected && !task
      ? (x: number, y: number) => {
          updateZone(selected.id, (z) => {
            const r = zoneRect(z);
            return r ? rectColumns(moveRectTo(r, x, y)) : {};
          });
        }
      : undefined;
  const pick = (item: NamedItem | null) => {
    setMoving(null);
    setPlacing(item);
  };
  const startMove = (loc: ItemLocation) => {
    setPlacing(null);
    setOpenLocationId(null);
    setMoving(loc);
  };
  const cancelTask = () => {
    setPlacing(null);
    setMoving(null);
  };

  let body: React.ReactNode;
  if (!barId) body = <Body tone="muted">Once a venue adds you to its team, its back bar shows here.</Body>;
  else if (caps.error) body = <Body tone="muted">The back bar map isn’t set up for this venue yet.</Body>;
  else if (!capabilities || zonesQuery.isLoading) body = <Caption tone="muted">Opening the back bar…</Caption>;
  else if (!canRead)
    body = (
      <LockedSection title="Where things live" unlocked={false} opensAt={opensAt ? roleLabel(opensAt) : 'a higher role'}>
        {null}
      </LockedSection>
    );
  else if (zonesQuery.error) body = <Body tone="muted">Couldn’t load the back bar. Check your connection and try again.</Body>;
  else if (!zones.length)
    body = canDraw ? (
      <View style={styles.stack}>
        <Body tone="muted">Draw the back bar once: a zone for each shelf, fridge, rail and tray. Then give everything on the menu a spot.</Body>
        <AddZone barId={barId} zones={zones} onAdded={(z) => setSelectedId(z.id)} />
      </View>
    ) : (
      <Body tone="muted">Nobody has drawn {active?.name}’s back bar yet. Drink Creators and up can.</Body>
    );
  else {
    const plan = (
      <View style={styles.stack}>
        <BackBarPlan
          zones={zones}
          highlightIds={selected ? [selected.id] : []}
          onPressZone={onPressZone}
          zoneHint={(z) => (placing ? `Places ${placing.name} here` : moving ? `Moves ${moving.item?.name ?? 'it'} here` : undefined)}
          onPressPlan={onPressPlan}
          countFor={(id) => locations.filter((l) => l.zone_id === id).length}
          accessibilityLabel={`${active?.name ?? 'Venue'} back bar plan`}
        />
        {editing ? <AddZone barId={barId} zones={zones} onAdded={(z) => setSelectedId(z.id)} /> : null}
        {editing && selected ? <ZoneEditor key={selected.id} barId={barId} zone={selected} /> : null}
        {task ? (
          <Surface raised style={styles.task}>
            <Body aria-live="polite" style={styles.flex}>
              {task}
            </Body>
            <Button label="Cancel" variant="ghost" onPress={cancelTask} />
          </Surface>
        ) : null}
        <WaitingForSpot items={waiting} selectedId={placing?.id ?? null} onSelect={canPlace ? pick : undefined} />
        {!canPlace ? <Caption tone="muted">You can see where everything lives. Drink Creators and up can change it.</Caption> : null}
      </View>
    );
    const inspector = selected ? (
      <ZoneInspector
        barId={barId}
        zone={selected}
        contents={contents}
        canPlace={canPlace}
        openLocationId={openLocationId}
        onOpenLocation={setOpenLocationId}
        onMove={startMove}
      />
    ) : null;
    body = wide ? (
      <View style={styles.columns}>
        <View style={styles.flex}>{plan}</View>
        <View style={[styles.inspector, { borderLeftColor: ds.c.line }]}>{inspector}</View>
      </View>
    ) : (
      <View style={styles.stack}>
        {plan}
        {inspector}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <ScreenHeader />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          {!sidebar ? (
            <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/prep'))} />
          ) : null}
          <View style={[styles.header, wide && styles.headerWide]}>
            <View style={styles.flex}>
              <Display>Back bar</Display>
              {canRead && zones.length ? <Caption tone="muted">{summaryLine(zones.length, locations, waiting.length)}</Caption> : null}
            </View>
            {canDraw && zones.length ? (
              <Button
                label={editing ? 'Done' : 'Edit the plan'}
                variant={editing ? 'secondary' : 'primary'}
                onPress={() => setEditing((e) => !e)}
                style={styles.headerAction}
              />
            ) : null}
          </View>
          {body}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  body: { gap: space.lg, maxWidth: 1240, width: '100%' },
  header: { gap: space.md },
  headerWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerAction: { alignSelf: 'flex-start' },
  stack: { gap: space.lg },
  columns: { flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' },
  inspector: { width: 340, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: space.xl },
  task: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});
