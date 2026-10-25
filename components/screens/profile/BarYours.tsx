import { Linking, StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Spec, useDs } from '@/components/ds';
import { radius, space, type } from '@/constants/tokens';
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
    <View role="list" accessibilityLabel="Your drinks here" style={styles.strip}>
      {cells.map((c) => (
        <View key={c.label} role="listitem" accessible accessibilityLabel={`${c.value} ${c.label}`} style={[styles.cell, { backgroundColor: ds.c.surface }]}>
          <Spec style={type.headline}>{c.value}</Spec>
          <Caption tone="muted">{c.label}</Caption>
        </View>
      ))}
    </View>
  );
}

/**
 * The facts every bar's page lists, claimed or not (ppl-bar-unclaimed,
 * -private, -names): when it opened, its best two awards, one a line (the
 * awards count above opens them all), and Online: its Instagram, which the
 * hours card shows as @handle too (Kevin's pick, d46). Rows it has no fact
 * for are left out.
 */
export function BarFactsList({ profile }: { profile: Profile }) {
  const ds = useDs();
  const facts = useBarFacts(profile.id).data;
  const best = sortAwards(useProfileAwards(profile.id).data ?? []).slice(0, 2).map(awardLines);
  const handle = profile.instagram ? normalizeInstagram(profile.instagram) : '';
  const rows = [
    facts?.opened_year ? { term: 'Opened', value: String(facts.opened_year) } : null,
    best.length ? { term: best.length > 1 ? 'Awards' : 'Award', value: best.map((a) => `${a.detail} · ${a.headline}`).join('\n') } : null,
    handle ? { term: 'Online', value: 'Instagram', url: instagramUrl(handle) } : null,
  ].filter((r): r is { term: string; value: string; url?: string } => !!r);
  if (!rows.length) return null;
  return (
    <View role="list" style={styles.facts}>
      {rows.map((r) => (
        <View key={r.term} role="listitem" style={styles.fact}>
          <DsText variant="body" tone="muted" style={[styles.text, styles.term]}>
            {r.term}
          </DsText>
          {r.url ? (
            <PressableScale role="link" accessibilityLabel={`@${handle} on ${r.value}`} accessibilityHint={`Opens ${r.value}`} onPress={() => void Linking.openURL(r.url!)} style={styles.flex}>
              <DsText variant="body" color={ds.accentText} style={styles.text}>
                {r.value}
              </DsText>
            </PressableScale>
          ) : (
            <DsText variant="body" style={[styles.text, styles.flex]}>
              {r.value}
            </DsText>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Three cards, the number over its label (ppl-bar-top).
  strip: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1, minWidth: 0, gap: 2, padding: space.md, borderRadius: radius.control + space.xs, borderCurve: 'continuous' },
  // Term and value in two columns, 15 on 22 (ppl-bar-unclaimed's facts).
  facts: { gap: space.sm },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  term: { width: 96 - space.md },
  text: { fontSize: type.label.fontSize, lineHeight: 22 },
  flex: { flex: 1, minWidth: 0 },
});
