import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkDrawingFor, DsText, PencilState, PressableScale, Surface, useDs } from '@/components/ds';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { TonightSetupBanner } from '@/components/screens/venueSetup/SetupBanner';
import { TonightWeek } from '@/components/screens/week/TonightWeek';
import { displayFaces, space } from '@/constants/tokens';
import type { TonightBlock } from '@/hooks/useTonight';
import { itemHref } from '@/lib/itemRoutes';
import { plural } from '@/lib/menus';
import { prepLine } from '@/lib/tonight';

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
    <View style={styles.stack}>
      <TonightSetupBanner barId={barId} />
      <HeroTrio ids={t.heroIds} label={`${lead.menu.name}, on now. Opens the list.`} onPress={() => open(lead.menu.id)} />
      <ListHead eyebrow={`On the menu · ${plural(drinkCount(lead), 'drink')}`} name={lead.menu.name} onPress={() => open(lead.menu.id)} />
      {wide ? <DrinkGrid block={lead} /> : null}
      {t.blocks.slice(1).map((b) => (
        <ListHead key={b.menu.id} eyebrow={`Also on · ${plural(drinkCount(b), 'drink')}`} name={b.menu.name} onPress={() => open(b.menu.id)} />
      ))}
    </View>
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
        <PressableScale key={d.id} role="link" accessibilityLabel={d.name} onPress={() => router.push(itemHref('Cocktail', d.id) as Href)} style={[styles.cell, { borderBottomColor: ds.c.line }]}>
          <DrinkDrawingFor itemId={d.id} size="row" pour={false} />
          <DsText variant="headline" numberOfLines={1} style={[styles.flex, { fontFamily: displayFaces[ds.displayFace].regular }]}>
            {d.name}
          </DsText>
        </PressableScale>
      ))}
    </View>
  );
}

/** Before doors, Needs you (admins), Learn, and the week: the column beside the lists when wide. */
export function StaffSide({ t, barId }: { t: Staff; barId: string }) {
  const router = useRouter();
  const go = (href: string) => () => router.push(href as Href);
  const make = t.make ?? [];
  return (
    <View style={styles.side}>
      {(t.canPrep && (make.length || t.houseMade)) || t.off.length ? (
        <TonightSection title="Before doors">
          <Surface style={styles.card}>
            {make.slice(0, 3).map((line, i) => (
              <View key={line.id}>
                {i ? <RowDivider /> : null}
                <SettingsRow
                  icon="drop.fill"
                  label={line.name}
                  detail={prepLine(line)}
                  onPress={go(itemHref('Ingredient', line.id))}
                  trailing={<Button label="Prep" size="sm" variant="secondary" accessibilityLabel={`Prep ${line.name}`} onPress={go('/prep')} />}
                />
              </View>
            ))}
            {!make.length && t.houseMade ? <SettingsRow icon="drop.fill" label="House-made" detail={`${plural(t.houseMade, 'prep')} · enough for tonight`} onPress={go('/prep')} /> : null}
            {t.off.slice(0, 2).map((d) => (
              <View key={`off-${d.id}`}>
                <RowDivider />
                <SettingsRow icon="exclamationmark.triangle" label="Off tonight" value={d.name} onPress={go(itemHref('Cocktail', d.id))} />
              </View>
            ))}
          </Surface>
        </TonightSection>
      ) : null}
      {t.admin && (t.credits || t.next) ? (
        <TonightSection title="Needs you">
          <Surface style={styles.card}>
            {t.credits ? <SettingsRow icon="person.2.fill" label="Credits to check" value={String(t.credits)} onPress={go('/credits-to-check')} /> : null}
            {t.credits && t.next ? <RowDivider /> : null}
            {t.next ? (
              <SettingsRow
                icon="doc.text"
                label={`${t.next.name} goes on ${t.next.startsAt ? new Date(t.next.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'soon'}`}
                value={plural(t.next.itemIds.length, 'drink')}
                onPress={go(listHref(t.next.id) as string)}
              />
            ) : null}
          </Surface>
        </TonightSection>
      ) : null}
      {t.learn.length ? (
        <TonightSection title="Learn">
          <View role="list">
            {t.learn.map(({ drink, list }, i) => (
              <LearnRow key={drink.id} id={drink.id} name={drink.name} sub={`New on ${list}`} first={i === 0} />
            ))}
          </View>
        </TonightSection>
      ) : null}
      <TonightWeek barId={barId} />
    </View>
  );
}

function LearnRow({ id, name, sub, first }: { id: string; name: string; sub: string; first: boolean }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel={`${name}. ${sub}`} onPress={() => router.push(itemHref('Cocktail', id) as Href)} style={[styles.learn, { borderTopColor: first ? 'transparent' : ds.c.line }]}>
      <DrinkDrawingFor itemId={id} size="row" pour={false} />
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        <Caption tone="muted">{sub}</Caption>
      </View>
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
  card: { padding: 0, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.sm },
  cell: { width: '25%', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  learn: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
