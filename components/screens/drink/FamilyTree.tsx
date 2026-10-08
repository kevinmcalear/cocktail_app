import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useLineage } from '@/hooks/useLineage';
import {
  creditHint,
  creditLabel,
  creditSentence,
  creditText,
  creators,
  hasLineage,
  shortNames,
  yearLabel,
  type CreditProfile,
  type CreditStatus,
  type LineageDrink,
} from '@/lib/lineage';

import { FromTheBooks } from './FromTheBooks';

const profileHref = (id: string) => `/p/${id}` as Href;
const drinkHref = (id: string) => `/cocktail/${id}` as Href;

/** Credit status as a word, with what it means for screen readers. Colour is never the only signal. */
export function CreditTag({ status }: { status: CreditStatus | null }) {
  const label = creditLabel(status);
  if (!label) return null;
  return (
    <View accessible accessibilityLabel={`Credit ${label.toLowerCase()}. ${creditHint(status)}`}>
      <Tag label={label} tone={status === 'verified' ? 'success' : 'default'} />
    </View>
  );
}

/** "By Jo Marsh at Pale Moth, 2025" for a riff row; names only, no links. */
function byLine(d: LineageDrink): string {
  const text = creditText(creditSentence(d, null));
  return text || (d.origin ?? '');
}

/** A drink in a list under the tree: name, then who made it where. */
function DrinkRow({ d, onPress }: { d: LineageDrink; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${d.name}. ${byLine(d)}`} onPress={onPress} style={[styles.riff, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1}>
          {d.name}
        </DsText>
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

/**
 * Who made this drink, where and when, its line back through the classics
 * and the historic styles to Punch, what changed from its parent, and what
 * came from it. Names link to profiles and drinks. Hidden when the drink has
 * no credit or family yet.
 */
export function FamilyTree({ itemId }: { itemId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useLineage(itemId);
  // Its own printed history, else its nearest classic's: this drink first, then up the tree.
  const family = [data?.drink ?? { id: itemId, name: '' }, ...[...(data?.ancestors ?? [])].reverse()].map((d) => ({ id: d.id, name: d.name }));
  const books = <FromTheBooks family={family} />;
  if (!data || !hasLineage(data.drink, data.ancestors, [...data.riffs, ...data.classics], data.styles)) return books;
  const { drink, ancestors, riffs, classics, styles: lineStyles } = data;
  const inTree = !!drink?.is_catalog || lineStyles.length > 0 || ancestors.some((a) => a.is_catalog);
  const parent = ancestors.at(-1) ?? null;
  const parts = creditSentence(drink!, parent);
  const who: CreditProfile | null = drink!.creator ?? drink!.origin_bar;

  return (
    <View style={styles.section}>
      <Headline role="heading">Family tree</Headline>

      {who ? (
        <PressableScale
          role="link"
          accessibilityLabel={[creditText(parts), drink!.credit_status && `Credit ${creditLabel(drink!.credit_status)?.toLowerCase()}`, `Open ${who.display_name}'s profile`].filter(Boolean).join('. ')}
          onPress={() => router.push(profileHref(who.id))}
          style={[styles.credit, { backgroundColor: ds.c.raised }]}
        >
          <UserAvatar uri={who.avatar_url} name={who.display_name} size={40} />
          <View style={styles.flex}>
            <DsText variant="headline" numberOfLines={3}>
              {drink!.creator ? `Created by ${shortNames(creators(drink!).map((c) => c.display_name))}` : `First made at ${who.display_name}`}
            </DsText>
            <Caption tone="muted" numberOfLines={2}>
              {[
                drink!.origin_bar && drink!.creator ? drink!.origin_bar.display_name : who.locality,
                drink!.origin_bar?.is_closed ? `closed${drink!.origin_bar.closed_year ? ` ${drink!.origin_bar.closed_year}` : ''}` : null,
                yearLabel(drink!.origin_year, drink!.origin_year_approx),
              ]
                .filter(Boolean)
                .join(' · ') || 'See their drinks'}
            </Caption>
          </View>
          <CreditTag status={drink!.credit_status} />
        </PressableScale>
      ) : null}

      {parts.length ? (
        <Body tone="muted">
          {parts.map((p, i) =>
            p.profileId || p.drinkId ? (
              <DsText
                key={i}
                role="link"
                style={styles.link}
                onPress={() => router.push(p.profileId ? profileHref(p.profileId) : drinkHref(p.drinkId!))}
              >
                {p.text}
              </DsText>
            ) : (
              p.text
            )
          )}
        </Body>
      ) : null}

      {ancestors.length || lineStyles.length ? (
        <View role="list" accessibilityLabel="Where it comes from" style={[styles.tree, { borderLeftColor: ds.c.lineStrong }]}>
          {lineStyles.map((s) => (
            <View key={s.id} role="listitem" accessibilityLabel={`${s.name}, a historic style${s.year ? `, ${yearLabel(s.year, s.year_approx)}` : ''}`} style={styles.treeRow}>
              <View style={[styles.dot, styles.square, { backgroundColor: ds.c.muted, borderColor: ds.c.muted }]} />
              <Caption tone="muted" style={styles.cap}>
                {s.name}
              </Caption>
              <Caption tone="muted">{yearLabel(s.year, s.year_approx) ?? ''}</Caption>
            </View>
          ))}
          {[...ancestors, drink!].map((d) => {
            const here = d.id === drink!.id;
            return (
              <PressableScale
                key={d.id}
                role={here ? undefined : 'link'}
                aria-current={here ? 'page' : undefined}
                accessibilityLabel={here ? `${d.name}, this drink` : `${d.name}. ${byLine(d)}`}
                disabled={here}
                onPress={() => router.push(drinkHref(d.id))}
                style={styles.treeRow}
              >
                <View style={[styles.dot, { backgroundColor: here ? ds.c.ink : ds.c.ground, borderColor: here ? ds.c.ink : ds.c.muted }]} />
                <DsText variant="title" style={styles.treeName}>
                  {d.name}
                </DsText>
                <Caption tone="muted">
                  {here ? "You're here" : byLine(d)}
                </Caption>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {drink!.lineage_note ? <Body>{`What changed: ${drink!.lineage_note}`}</Body> : null}

      {classics.length ? (
        <View style={styles.riffs}>
          <Caption tone="muted" style={styles.cap}>
            Classics that came from it
          </Caption>
          <View role="list">
            {classics.map((r) => (
              <DrinkRow key={r.id} d={r} onPress={() => router.push(drinkHref(r.id))} />
            ))}
          </View>
        </View>
      ) : null}

      {riffs.length ? (
        <View style={styles.riffs}>
          <Caption tone="muted" style={styles.cap}>
            {drink!.is_catalog ? "Bars' versions" : 'Riffs on this'}
          </Caption>
          <View role="list">
            {riffs.map((r) => (
              <DrinkRow key={r.id} d={r} onPress={() => router.push(drinkHref(r.id))} />
            ))}
          </View>
        </View>
      ) : null}

      {inTree ? (
        <Button
          label="See the whole family tree"
          variant="secondary"
          icon="chevron.right"
          onPress={() => router.push({ pathname: '/history', params: { focus: drink!.is_catalog ? drink!.id : (ancestors.findLast((a) => a.is_catalog)?.id ?? drink!.id) } })}
        />
      ) : null}

      {books}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  link: { textDecorationLine: 'underline' },
  tree: { marginLeft: space.sm - 1, paddingLeft: space.lg, borderLeftWidth: 1.5, gap: space.xs },
  treeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.sm, minHeight: 44, paddingVertical: space.xs },
  dot: { position: 'absolute', left: -space.lg - 6, top: space.md + 2, width: 11, height: 11, borderRadius: radius.pill, borderWidth: 1.5 },
  square: { borderRadius: radius.mark / 2 },
  treeName: { flexShrink: 1 },
  riffs: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  riff: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
