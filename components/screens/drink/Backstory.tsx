import { useRouter, type Href } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, space } from '@/constants/tokens';
import { useDrinkHistory } from '@/hooks/useDrinkHistory';
import { useLineage } from '@/hooks/useLineage';
import { historyFor } from '@/lib/drinkHistory';
import { creditSentence, creditText, joinNames, shortNames, yearLabel, type CreditProfile, type LineageDrink } from '@/lib/lineage';

import { BarVersions, useVersionGroups, versionCounts } from './BarVersions';
import { CreditTag } from './DrinkCredit';
import { FactRow } from './FactRow';
import { FirstInPrint } from './FirstInPrint';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;

/** "By Jo Marsh at Pale Moth, 2025" for a riff row; names only, no links. */
function byLine(d: LineageDrink): string {
  const text = creditText(creditSentence(d, null));
  return text || (d.origin ?? '');
}

/** A drink in a list under a fact: name, then who made it where. */
function DrinkRow({ d, onPress }: { d: LineageDrink; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${d.name}. ${byLine(d)}`} onPress={onPress} style={[styles.riff, { borderTopColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Body numberOfLines={1}>{d.name}</Body>
        {byLine(d) ? (
          <Caption tone="muted" numberOfLines={1}>
            {byLine(d)}
          </Caption>
        ) : null}
      </View>
      <CreditTag status={d.credit_status} />
    </PressableScale>
  );
}

/** Who made these drinks, each once, best-credited first. */
function makersOf(drinks: LineageDrink[]): CreditProfile[] {
  return drinks.map((d) => d.origin_bar ?? d.creator).filter((p, i, all): p is CreditProfile => !!p && all.findIndex((q) => q?.id === p.id) === i);
}

/** "Death & Co, Temple Bar, Little Rye and more": versions often share the classic's name, so name who made them. */
function makersLine(drinks: LineageDrink[]): string {
  const names = makersOf(drinks).map((p) => p.display_name);
  if (!names.length) return shortNames(drinks.map((d) => d.name));
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} and more` : joinNames(names);
}

/** Up to three makers' faces, overlapping. */
function Faces({ drinks }: { drinks: LineageDrink[] }) {
  const ds = useDs();
  const makers = makersOf(drinks).slice(0, 3);
  if (!makers.length) return null;
  return (
    <View aria-hidden style={styles.faces}>
      {makers.map((p, i) => (
        <View key={p.id} style={i ? styles.overlap : null}>
          <UserAvatar uri={p.avatar_url} name={p.display_name} size={24} borderColor={ds.c.ground} />
        </View>
      ))}
    </View>
  );
}

/**
 * The drink's backstory, on the side of its page: its line back through the
 * classics and the historic styles to Punch, what changed from its parent,
 * its first printing, and what came from it. One fact per row, each a tap
 * from the whole story. Hidden when there's nothing to tell.
 */
export function Backstory({ itemId }: { itemId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useLineage(itemId);
  const drink = data?.drink ?? null;
  const ancestors = data?.ancestors ?? [];
  const lineStyles = data?.styles ?? [];
  // Its own printed history, else its nearest classic's: this drink first, then up the tree.
  const family = [drink ?? { id: itemId, name: '' }, ...[...ancestors].reverse()].map((d) => ({ id: d.id, name: d.name }));
  const { data: printed = [] } = useDrinkHistory(family.map((f) => f.id));
  const found = historyFor(
    printed,
    family.map((f) => f.id)
  );
  const classics = data?.classics ?? [];
  const riffs = data?.riffs ?? [];
  const steps = [
    ...lineStyles.map((s) => ({ key: s.id, name: s.name, year: yearLabel(s.year, s.year_approx), isStyle: true })),
    ...ancestors.map((d) => ({ key: d.id, name: d.name, year: yearLabel(d.origin_year, d.origin_year_approx), isStyle: false })),
  ];
  const versions = useVersionGroups(drink?.is_catalog ? drink.id : null, riffs);
  // The hook reads the best 100, so a count at the cap says so.
  const capped = riffs.length >= 100;
  const versionLine = `${versionCounts(versions)}${capped ? ' in the first 100' : ''}`;
  if (!steps.length && !drink?.lineage_note && !found && !classics.length && !riffs.length) return null;
  const focus = drink?.is_catalog ? drink.id : ancestors.findLast((a) => a.is_catalog)?.id;
  const inTree = !!drink && (!!focus || lineStyles.length > 0);
  const borrowed = found && found.itemId !== family[0].id ? (family.find((f) => f.id === found.itemId)?.name ?? null) : null;

  return (
    <View style={styles.section}>
      <Headline role="heading">Backstory</Headline>
      <View style={[styles.list, { borderBottomColor: ds.c.line }]}>
        {steps.length ? (
          <FactRow
            label="Family"
            accessibilityLabel={`Family: ${steps.map((s) => [s.name, s.year].filter(Boolean).join(', ')).join('; ')}; then this drink.${inTree ? ' Open the family tree' : ''}`}
            onPress={inTree ? () => router.push({ pathname: '/history', params: { focus: focus ?? drink!.id } }) : undefined}
          >
            <Body tone="muted">
              {steps.map((s) => (
                <Fragment key={s.key}>
                  <DsText tone={s.isStyle ? 'muted' : 'ink'}>{s.name}</DsText>
                  {s.year ? <DsText tone="muted" style={styles.year}>{` ${s.year}`}</DsText> : null}
                  {'  ›  '}
                </Fragment>
              ))}
              <DsText style={styles.here}>this one</DsText>
            </Body>
          </FactRow>
        ) : null}

        {drink?.lineage_note ? (
          <FactRow label="What changed" accessibilityLabel={`What changed: ${drink.lineage_note}`}>
            <Body>{drink.lineage_note}</Body>
          </FactRow>
        ) : null}

        {found ? <FirstInPrint records={found.records} borrowed={borrowed} /> : null}

        {classics.length ? (
          <FactRow
            label="Came from it"
            mark={String(classics.length)}
            accessibilityLabel={`Came from it: ${shortNames(classics.map((c) => c.name))}`}
            more={classics.map((r) => (
              <DrinkRow key={r.id} d={r} onPress={() => router.push(drinkHref(r.id))} />
            ))}
          >
            <Body numberOfLines={2}>{shortNames(classics.map((c) => c.name))}</Body>
          </FactRow>
        ) : null}

        {riffs.length ? (
          <FactRow
            label={drink?.is_catalog ? "Bars' versions" : 'Riffs on this'}
            mark={capped ? '100+' : String(riffs.length)}
            accessibilityLabel={`${drink?.is_catalog ? "Bars' versions" : 'Riffs on this'}: ${drink?.is_catalog ? versionLine : makersLine(riffs)}`}
            more={
              drink?.is_catalog ? (
                // Served at, variations and riffs, by spec match.
                <BarVersions groups={versions} />
              ) : (
                riffs.map((r) => <DrinkRow key={r.id} d={r} onPress={() => router.push(drinkHref(r.id))} />)
              )
            }
          >
            <View style={styles.riffLine}>
              <Faces drinks={riffs} />
              <Body numberOfLines={2} style={styles.flex}>
                {drink?.is_catalog ? versionLine : makersLine(riffs)}
              </Body>
            </View>
          </FactRow>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  list: { borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  year: { fontFamily: fontFamilies.mono },
  here: { fontFamily: fontFamilies.bodySemiBold },
  faces: { flexDirection: 'row' },
  overlap: { marginLeft: -space.sm },
  riffLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  riff: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
