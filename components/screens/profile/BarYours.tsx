import { Linking, StyleSheet, View } from 'react-native';

import { Caption, Spec, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useCollection } from '@/hooks/useCollection';
import { useMadeDrinks } from '@/hooks/useMade';
import { useProfileAwards, type Profile } from '@/hooks/useProfiles';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { awardLines, sortAwards } from '@/lib/awards';
import { instagramUrl, normalizeInstagram } from '@/lib/profiles';
import { formatScore } from '@/lib/ranking';

/** What you've had at this bar: how many drinks, and your average across them. */
export function useYouHere(profileId: string) {
  const had = (useMyHadDrinks().data ?? []).filter((d) => d.venue?.id === profileId);
  const average = had.length ? had.reduce((n, d) => n + d.score, 0) / had.length : null;
  return { count: had.length, average };
}

/**
 * "Your drinks here" over a bar's Top drinks (ppl-bar-top): your average
 * across what you've had there, how many of its drinks are on your To make
 * list, and how many you've made at home. Nothing until one of them has a number.
 */
export function BarYours({ profileId, drinkIds }: { profileId: string; drinkIds: string[] }) {
  const ds = useDs();
  const signedIn = useSignedIn();
  const here = useYouHere(profileId);
  const ids = new Set(drinkIds);
  const toMake = (useCollection().data?.drinks ?? []).filter((d) => d.itemId && ids.has(d.itemId)).length;
  const made = new Set((useMadeDrinks().data ?? []).filter((d) => ids.has(d.itemId)).map((d) => d.itemId)).size;
  if (!signedIn || (here.average === null && !toMake && !made)) return null;
  const cells = [
    here.average !== null ? { value: formatScore(here.average), label: 'your average' } : null,
    { value: String(toMake), label: 'to make' },
    { value: String(made), label: 'made at home' },
  ].filter((c): c is { value: string; label: string } => !!c);
  return (
    <View role="list" accessibilityLabel="Your drinks here" style={[styles.strip, { backgroundColor: ds.c.surface }]}>
      {cells.map((c) => (
        <View key={c.label} role="listitem" accessible accessibilityLabel={`${c.value} ${c.label}`} style={styles.cell}>
          <Spec>{c.value}</Spec>
          <Caption tone="muted">{c.label}</Caption>
        </View>
      ))}
    </View>
  );
}

/**
 * The facts an unclaimed bar's page lists (ppl-bar-unclaimed): when it
 * opened, its best award, and where it is online. Rows it has no fact for
 * are left out.
 */
export function BarFactsList({ profile }: { profile: Profile }) {
  const ds = useDs();
  const facts = useBarFacts(profile.id).data;
  const best = sortAwards(useProfileAwards(profile.id).data ?? [])[0];
  const award = best ? awardLines(best) : null;
  const rows = [
    facts?.opened_year ? { term: 'Opened', value: String(facts.opened_year) } : null,
    award ? { term: 'Award', value: `${award.detail} · ${award.headline}` } : null,
  ].filter((r): r is { term: string; value: string } => !!r);
  if (!rows.length && !profile.instagram) return null;
  return (
    <View role="list" style={styles.facts}>
      {rows.map((r) => (
        <View key={r.term} role="listitem" style={[styles.fact, { borderBottomColor: ds.c.line }]}>
          <Caption tone="muted" style={styles.term}>
            {r.term}
          </Caption>
          <Caption style={styles.flex}>{r.value}</Caption>
        </View>
      ))}
      {profile.instagram ? (
        <View role="listitem" style={[styles.fact, { borderBottomColor: ds.c.line }]}>
          <Caption tone="muted" style={styles.term}>
            Online
          </Caption>
          <TextLink label="Instagram" accessibilityHint={`@${normalizeInstagram(profile.instagram)}, opens Instagram`} onPress={() => void Linking.openURL(instagramUrl(normalizeInstagram(profile.instagram!)))} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', borderRadius: radius.card, paddingVertical: space.md },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  facts: { gap: 0 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth },
  term: { width: 80 },
  flex: { flex: 1, minWidth: 0 },
});
