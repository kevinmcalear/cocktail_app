import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, LockedSection, Segmented, useDs, useGutter } from '@/components/ds';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { BackBarLink } from '@/components/backbar/BackBarLink';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { CountScreen } from '@/components/screens/prep/CountScreen';
import { EventSheet } from '@/components/screens/week/EventSheet';
import { PrepLists } from '@/components/screens/prep/PrepLists';
import { PrepSources, ServesControl, type PrepSource } from '@/components/screens/prep/PrepSources';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useEvents } from '@/hooks/useEvents';
import { usePrepData } from '@/hooks/usePrepList';
import { buildPrepList, servesPerDrink } from '@/lib/prep';
import { roleLabel } from '@/lib/roles';

interface MenuRow {
  id: string;
  name: string;
  bar_id: string | null;
  is_active: boolean;
}

const SEGMENTS = [
  { value: 'make', label: 'Prep' },
  { value: 'order', label: 'Order' },
  { value: 'count', label: 'Count' },
] as const;
type Segment = (typeof SEGMENTS)[number]['value'];

const DEFAULT_SERVES = 20;
const DRINKS_PER_GUEST = 2;

/** Tonight's service starts at 6 pm for start-by times; ponytail: a venue setting later. */
function tonightAt6(): Date {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d;
}

/**
 * Prep: worked back from tonight's menu or an upcoming event. What to make
 * (house-made ingredients, in batches, with when to start them) and what to
 * order, grouped by supplier and rounded up to whole packs.
 */
export function PrepScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const { active } = useActiveVenue();
  const barId = active?.id ?? null;
  const caps = useCapabilities(barId);
  // Guard against a stale persisted cache entry that isn't an array.
  const capabilities = Array.isArray(caps.data) ? caps.data : null;
  const { data: prepOpensAt } = useCapabilityOpensAt(barId, 'prep');
  const canPrep = !!capabilities?.includes('prep');
  const { data: events = [] } = useEvents(canPrep ? barId : null);
  const { data: dropdowns } = useDropdowns({ menus: true });
  const venueMenus = ((dropdowns?.menus ?? []) as MenuRow[]).filter((m) => m.bar_id === barId);

  const [segment, setSegment] = useState<Segment>('make');
  const [tools, setTools] = useState(false);
  const [source, setSource] = useState<PrepSource>({ kind: 'tonight' });
  const [servesOverride, setServesOverride] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => new Date());

  const menuIds =
    source.kind === 'tonight'
      ? venueMenus.filter((m) => m.is_active).map((m) => m.id)
      : source.event.menu_id
        ? [source.event.menu_id]
        : [];
  const { data, isLoading } = usePrepData(canPrep ? barId : null, menuIds);

  const covers = source.kind === 'event' ? source.event.covers_estimate : null;
  const drinkCount = data?.drinks.length ?? 0;
  const serves = servesOverride ?? (covers && drinkCount ? servesPerDrink(covers, drinkCount, DRINKS_PER_GUEST) : DEFAULT_SERVES);
  const startsAtMs = (source.kind === 'event' ? new Date(source.event.starts_at) : tonightAt6()).getTime();
  const list = useMemo(
    () => (data ? buildPrepList({ ...data, servesPerDrink: serves, startsAt: new Date(startsAtMs), now }) : null),
    [data, serves, startsAtMs, now]
  );
  const basis = covers
    ? `${covers} guests × ${DRINKS_PER_GUEST} drinks, spread over ${drinkCount} drinks. Adjust for the night you expect.`
    : 'A starting point. Adjust for the night you expect.';

  const pick = (s: PrepSource) => {
    setSource(s);
    setServesOverride(null);
  };

  let content: React.ReactNode;
  if (!barId) content = <Body tone="muted">Once a venue adds you to its team, its prep list shows here.</Body>;
  else if (caps.error) content = <Body tone="muted">Prep isn’t set up for this venue yet.</Body>;
  else if (capabilities && !canPrep)
    content = (
      <LockedSection title="Prep list and orders" unlocked={false} opensAt={prepOpensAt ? roleLabel(prepOpensAt) : 'a higher role'}>
        {null}
      </LockedSection>
    );
  else if (segment === 'count') content = <CountScreen barId={barId} menuIds={menuIds} />;
  else if (menuIds.length === 0)
    content = (
      <Body tone="muted">
        {source.kind === 'tonight' ? 'Set a current menu to build tonight’s prep list.' : 'This event has no menu yet.'}
      </Body>
    );
  else if (isLoading || !list) content = <Caption tone="muted">Working out the prep list…</Caption>;
  else
    content = (
      <>
        <ServesControl serves={serves} onChange={setServesOverride} basis={basis} />
        <PrepLists list={list} show={segment === 'order' ? 'order' : 'make'} />
      </>
    );

  return (
    // Wrapped so NativeTabs doesn't also inset the ScrollView: ScreenHeader
    // handles the top safe area itself, the same as on Tonight and Library.
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <ScreenHeader />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <View style={styles.links}>
            <BackBarLink />
            <Button label="Tools" icon="percent" variant="secondary" onPress={() => setTools(true)} />
          </View>
          <Display>Prep</Display>
          {canPrep ? <Segmented options={SEGMENTS} value={segment} onChange={setSegment} accessibilityLabel="Prep, Order or Count" /> : null}
          {canPrep && segment !== 'count' ? (
            <PrepSources events={events} source={source} onSource={pick} canCreate={!!capabilities?.includes('menus')} onNewEvent={() => setCreating(true)} />
          ) : null}
          {content}
        </View>
      </ScrollView>
      {tools ? <ToolsSheet visible onClose={() => setTools(false)} /> : null}
      {barId && creating ? (
        <EventSheet visible onClose={() => setCreating(false)} barId={barId} menus={venueMenus.map((m) => ({ id: m.id, name: m.name }))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.lg, maxWidth: 760, width: '100%' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
