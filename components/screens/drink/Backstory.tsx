import { useRouter, type Href } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, space } from '@/constants/tokens';
import { useDrinkHistory } from '@/hooks/useDrinkHistory';
import { useLineage } from '@/hooks/useLineage';
import { historyFor } from '@/lib/drinkHistory';
import { joinNames, shortNames, yearLabel, type CreditProfile, type LineageDrink } from '@/lib/lineage';
import type { SpecLine } from '@/lib/spec';

import { CreditTag } from './DrinkCredit';
import { FactRow } from './FactRow';
import { FirstInPrint } from './FirstInPrint';
import { byLine, RankedRiffs } from './RankedRiffs';
import { useVersionGroups } from './ServedAt';

const drinkHref = (id: string) => `/cocktail/${id}` as Href;

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

interface BackstoryProps {
  itemId: string;
  /** This page's spec, for First in print's Then and now. */
  lines?: SpecLine[];
  /** A bar's copy of a classic: the classic's backstory, said so (board drink-phone-barcopy). */
  classicName?: string | null;
  /** Start a new drink from this one; null hides Riff on this. */
  onRiff?: (() => void) | null;
}

/**
 * The drink's backstory, on the side of its page: its line back through the
 * classics and the historic styles to Punch, what changed from its parent,
 * its first printing, what came from it, and the riffs on it, best first.
 * One fact per row, each a tap from the whole story. Hidden when there's
 * nothing to tell.
 */
export function Backstory({ itemId, lines = [], classicName, onRiff = null }: BackstoryProps) {
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
  // A classic's bars that pour it, and their variations, sit under its spec (ServedAt); its riffs stay here.
  const versions = useVersionGroups(drink?.is_catalog ? drink.id : null, riffs);
  const ranked = drink?.is_catalog ? versions.riffs : riffs;
  // The hook reads the best 100, so a count at the cap says so.
  const capped = riffs.length >= 100;
  if (!steps.length && !drink?.lineage_note && !found && !classics.length && !ranked.length) return null;
  const focus = drink?.is_catalog ? drink.id : ancestors.findLast((a) => a.is_catalog)?.id;
  const inTree = !!drink && (!!focus || lineStyles.length > 0);
  const borrowed = found && found.itemId !== family[0].id ? (family.find((f) => f.id === found.itemId)?.name ?? null) : null;

  return (
    <View style={styles.section}>
      <Headline role="heading">Backstory</Headline>
      {classicName ? <Caption tone="muted">{`From the classic ${classicName}: family, riffs and credit.`}</Caption> : null}
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

        {found ? <FirstInPrint records={found.records} borrowed={borrowed} itemId={itemId} lines={lines} /> : null}

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

        {ranked.length ? (
          <RankedRiffs
            label={drink?.is_catalog ? 'Riffs' : 'Riffs on this'}
            mark={capped ? '100+' : String(ranked.length)}
            riffs={ranked}
            accessibilityLabel={`${drink?.is_catalog ? 'Riffs' : 'Riffs on this'}: ${drink?.is_catalog ? 'the best, ranked' : makersLine(ranked)}`}
            onRiff={onRiff}
            summary={
              drink?.is_catalog ? (
                <Body>The best, ranked</Body>
              ) : (
                <View style={styles.riffLine}>
                  <Faces drinks={ranked} />
                  <Body numberOfLines={2} style={styles.flex}>
                    {makersLine(ranked)}
                  </Body>
                </View>
              )
            }
          />
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
