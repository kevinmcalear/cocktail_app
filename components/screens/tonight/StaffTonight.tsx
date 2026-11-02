import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkDrawingFor, DsText, PencilState, PressableScale, Tag, useDs } from '@/components/ds';
import { DrawingBar } from '@/components/ds/DrawingBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TonightSetupBanner } from '@/components/screens/venueSetup/SetupBanner';
import { TonightWeek } from '@/components/screens/week/TonightWeek';
import { displayFaces, space } from '@/constants/tokens';
import { categoryOf, type TonightBlock } from '@/hooks/useTonight';
import { itemHref } from '@/lib/itemRoutes';
import { plural } from '@/lib/menus';

import type { NightPhase } from '@/lib/nightPhase';

import { BeforeDoors, NeedsYou, OffTonight, OnShift } from './BeforeDoors';
import { HeroTrio, ListHead, TonightSection } from './TonightParts';
import type { useStaffTonight } from './useStaffTonight';

type Staff = ReturnType<typeof useStaffTonight>;

const listHref = (id: string) => `/menus/${id}` as Href;
const drinkCount = (b: TonightBlock) => b.sections.reduce((n, s) => n + s.drinks.length, 0);

/**
 * The list on now, drawn on its sky: three of its drinks, then its name (tap
 * opens it). Any other list on now (happy hour, specials) follows as its own
 * line. Wide, the lead list's drinks sit under it in four columns (Prod-desk).
 */
export function StaffLists({ t, barId, wide }: { t: Staff; barId: string; wide: boolean }) {
  const router = useRouter();
  if (!t.lead) {
    if (t.isLoading) return <PencilState kind="loading" title="Loading tonight’s lists" compact />;
    return (
      <View style={styles.stack}>
        <TonightSetupBanner barId={barId} />
        <PencilState
          kind="empty"
          title="Nothing on tonight yet"
          detail="When a list goes on, its drinks show here by the hour."
          action={{ label: 'See all menus', onPress: () => router.push('/menus/all') }}
        />
      </View>
    );
  }
  const { lead } = t;
  const open = (id: string) => router.push(listHref(id));
  return (
    <DrawingBar barId={barId}>
      <View style={styles.stack}>
        <TonightSetupBanner barId={barId} />
        <HeroTrio ids={t.heroIds} label={`${lead.menu.name}, on now. Opens the list.`} onPress={() => open(lead.menu.id)} />
        <ListHead eyebrow={`On the menu · ${plural(drinkCount(lead), 'drink')}`} name={lead.menu.name} onPress={() => open(lead.menu.id)} />
        {wide ? <DrinkGrid block={lead} /> : null}
        {t.blocks.slice(1).map((b) => (
          <ListHead key={b.menu.id} eyebrow={`Also on · ${plural(drinkCount(b), 'drink')}`} name={b.menu.name} onPress={() => open(b.menu.id)} />
        ))}
      </View>
    </DrawingBar>
  );
}

/** The lead list's drinks, four to a row, each a small drawing and its name (Prod-desk). */
function DrinkGrid({ block }: { block: TonightBlock }) {
  const ds = useDs();
  const router = useRouter();
  const drinks = block.sections.flatMap((s) => s.drinks);
  return (
    <View role="list" style={[styles.grid, { borderTopColor: ds.c.line }]}>
      {drinks.map((d) => (
        <PressableScale key={d.id} role="link" accessibilityLabel={d.name} onPress={() => router.push(itemHref(categoryOf(d.kind), d.id) as Href)} style={[styles.cell, { borderBottomColor: ds.c.line }]}>
          <DrinkDrawingFor itemId={d.id} size="row" pour={false} />
          <DsText variant="headline" numberOfLines={1} style={[styles.flex, { fontFamily: displayFaces[ds.displayFace].regular }]}>
            {d.name}
          </DsText>
        </PressableScale>
      ))}
    </View>
  );
}

type Part = 'service' | 'off' | 'doors' | 'needs' | 'learn' | 'shift' | 'week';

/**
 * Tonight by the hour (Loop-tonight, decided 1 Nov): before doors, the work
 * to do before opening; during service, the list as it goes out, what's off
 * and who's on; after close, tomorrow's prep and rota. The lists lead before
 * doors and during service, and step aside after close.
 */
const ORDER: Record<NightPhase, readonly Part[]> = {
  before: ['off', 'doors', 'needs', 'learn', 'shift', 'week'],
  service: ['service', 'off', 'shift', 'week'],
  after: ['doors', 'shift', 'learn', 'week'],
};

/** Whether the night shows its lists first (not after close). */
export const showsLists = (phase: NightPhase) => phase !== 'after';

/** The sections after the lists, in the night's order: the column beside the lists when wide. */
export function StaffSide({ t, barId, wide }: { t: Staff; barId: string; wide: boolean }) {
  const parts = ORDER[t.phase].filter((p) => !(wide && p === 'service'));
  const after = t.phase === 'after';
  return (
    <View style={styles.side}>
      {after ? <TonightSetupBanner barId={barId} /> : null}
      {parts.map((p) => {
        switch (p) {
          case 'service':
            return <ServiceRows key={p} t={t} />;
          case 'off':
            return <OffTonight key={p} t={t} />;
          case 'doors':
            return <BeforeDoors key={p} t={t} barId={barId} title={after ? 'Before doors tomorrow' : undefined} />;
          case 'needs':
            return <NeedsYou key={p} t={t} />;
          case 'learn':
            return t.learn.length ? (
              <TonightSection key={p} title="Learn" aside={`${t.learn.length} to read`}>
                <View role="list">
                  {t.learn.map((row, i) => (
                    <LearnRow key={`${row.id}-${i}`} {...row} first={i === 0} />
                  ))}
                </View>
              </TonightSection>
            ) : null;
          case 'shift':
            return after && t.tomorrow ? <OnShift key={p} t={{ ...t, onShift: t.tomorrow.onShift }} title={t.tomorrow.night} /> : <OnShift key={p} t={t} />;
          case 'week':
            return <TonightWeek key={p} barId={barId} />;
        }
      })}
    </View>
  );
}

/** During service, the lead list's drinks as they go out: "Rocks · Large cube", what to tell guests, Off. */
function ServiceRows({ t }: { t: Staff }) {
  const ds = useDs();
  const router = useRouter();
  if (!t.service.length) return null;
  return (
    <View role="list">
      {t.service.map((d, i) => (
        <PressableScale key={d.id} role="link" accessibilityLabel={[d.name, d.sub].filter(Boolean).join('. ')} onPress={() => router.push(itemHref(categoryOf(d.kind), d.id) as Href)} style={[styles.learn, { borderTopColor: i ? ds.c.line : 'transparent' }]}>
          <DrinkDrawingFor itemId={d.id} size="row" pour={false} />
          <View style={styles.flex}>
            <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
              {d.name}
            </DsText>
            {d.sub ? (
              <Caption tone="muted" numberOfLines={1}>
                {d.sub}
              </Caption>
            ) : null}
          </View>
          {d.off ? <Tag label="Off" tone="warning" /> : null}
          <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
        </PressableScale>
      ))}
    </View>
  );
}

/** A Learn row: a drink and what to learn about it; `href` opens Study on it (a run-through), null opens the drink. */
function LearnRow({ id, kind, name, sub, href, first }: { id: string; kind: string; name: string; sub: string; href: string | null; first: boolean }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel={`${name}. ${sub}`} onPress={() => router.push((href ?? itemHref(categoryOf(kind), id)) as Href)} style={[styles.learn, { borderTopColor: first ? 'transparent' : ds.c.line }]}>
      <DrinkDrawingFor itemId={id} size="row" pour={false} />
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        <Caption tone="muted">{sub}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** Shown when the person has no bar yet. */
export function NoVenue() {
  return <Body tone="muted">Once a bar adds you to its team, tonight’s lists show here.</Body>;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  side: { gap: space.xl },
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.sm },
  cell: { width: '25%', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  learn: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
