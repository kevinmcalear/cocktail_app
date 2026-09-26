import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useLineage } from '@/hooks/useLineage';
import {
  creditHint,
  creditLabel,
  creditSentence,
  creditText,
  hasLineage,
  type CreditProfile,
  type CreditStatus,
  type LineageDrink,
} from '@/lib/lineage';

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

/**
 * Who made this drink, where and when, what it's a riff of (up to the root),
 * and the riffs on it. Names link to profiles and drinks. Hidden when the
 * drink has no credit or family yet.
 */
export function FamilyTree({ itemId }: { itemId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useLineage(itemId);
  if (!data || !hasLineage(data.drink, data.ancestors, data.riffs)) return null;
  const { drink, ancestors, riffs } = data;
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
            <DsText variant="headline" numberOfLines={2}>
              {drink!.creator ? `Created by ${drink!.creator.display_name}` : `First made at ${who.display_name}`}
            </DsText>
            <Caption tone="muted" numberOfLines={2}>
              {[drink!.origin_bar && drink!.creator ? drink!.origin_bar.display_name : who.locality, drink!.origin_year].filter(Boolean).join(' · ') || 'See their drinks'}
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

      {ancestors.length ? (
        <View role="list" accessibilityLabel="Where it comes from" style={[styles.tree, { borderLeftColor: ds.c.lineStrong }]}>
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

      {riffs.length ? (
        <View style={styles.riffs}>
          <Caption tone="muted" style={styles.cap}>
            Riffs on this
          </Caption>
          <View role="list">
            {riffs.map((r) => (
              <PressableScale
                key={r.id}
                role="link"
                accessibilityLabel={`${r.name}. ${byLine(r)}`}
                onPress={() => router.push(drinkHref(r.id))}
                style={[styles.riff, { borderBottomColor: ds.c.line }]}
              >
                <View style={styles.flex}>
                  <DsText variant="headline" numberOfLines={1}>
                    {r.name}
                  </DsText>
                  {byLine(r) ? (
                    <Caption tone="muted" numberOfLines={1}>
                      {byLine(r)}
                    </Caption>
                  ) : null}
                </View>
                <CreditTag status={r.credit_status} />
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}
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
  treeName: { flexShrink: 1 },
  riffs: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  riff: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
