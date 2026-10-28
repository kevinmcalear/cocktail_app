import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import { useMenuRuns, useProfileNameCredits, useProfileOriginals, useProfilePositions, type Profile } from '@/hooks/useProfiles';
import { madeByGroups, madeByStats, type MadeDrink, type MadeGroup } from '@/lib/findYourself';
import { creators } from '@/lib/lineage';
import { jobYears } from '@/lib/profiles';
import { formatScore } from '@/lib/ranking';

import { BarMark } from '../home/BarMark';
import { LockedRow } from './LockedOriginals';
import { isShownPosition } from './Positions';

/**
 * What an unclaimed person's page shows before anything is claimed
 * (find-yourself step 3): every drink credited to them, grouped by bar then
 * menu, its numbers, and where they worked, with when.
 */
export function useMadeBy(profile: Profile) {
  const { data: originals = [] } = useProfileOriginals(profile.id);
  const { data: nameCredits = [] } = useProfileNameCredits(profile.id);
  const positions = (useProfilePositions(profile).data ?? []).filter(isShownPosition);
  const drinks = useMemo((): MadeDrink[] => {
    const seen = new Set(originals.map((d) => d.id));
    return [
      ...originals.map((d) => ({ id: d.id, name: d.name, barId: d.origin_bar?.id ?? null, barName: d.origin_bar?.display_name ?? null, others: creators(d).filter((p) => p.id !== profile.id).map((p) => p.display_name) })),
      // A drink at a Names or Private bar: its name and the bar, nothing more.
      ...nameCredits.filter((c) => !seen.has(c.item_id)).map((c) => ({ id: c.item_id, name: c.name, barId: c.bar_profile_id, barName: c.bar_name, others: [] })),
    ];
  }, [originals, nameCredits, profile.id]);
  const { data: runs = [] } = useMenuRuns(drinks.map((d) => d.id));
  const jobs = Object.fromEntries(positions.map((p) => [p.bar.id, jobYears(p)]));
  const groups = madeByGroups(drinks, runs, jobs);
  const { data: scores } = useItemScores(drinks.map((d) => d.id));
  return { groups, stats: madeByStats(groups, runs, positions.map((p) => p.bar.id)), scores: scores ?? {}, positions, pictures: new Map(originals.map((d) => [d.id, d])) };
}

type MadeBy = ReturnType<typeof useMadeBy>;

/** "Made by Ash", then "PALE MOTH · NIGHT GARDEN, ON NOW" and its drinks: "On now · 8.9". */
export function MadeByList({ name, made }: { name: string; made: MadeBy }) {
  if (!made.groups.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">{`Made by ${name.split(' ')[0]}`}</Headline>
      {made.groups.map((g) => (
        <Group key={g.barId ?? 'other'} group={g} made={made} />
      ))}
    </View>
  );
}

function Group({ group, made }: { group: MadeGroup; made: MadeBy }) {
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        {group.label}
      </Caption>
      <View role="list">
        {group.rows.map((r) => {
          const score = made.scores[r.id];
          const after = [r.caption, score !== undefined ? formatScore(score) : null].filter(Boolean).join(' · ') || null;
          const d = made.pictures.get(r.id);
          return <LockedRow key={r.id} drink={d ? { id: d.id, name: d.name, item_images: d.item_images, glass: d.glass } : { id: r.id, name: r.name }} people={[]} after={after} details quiet />;
        })}
      </View>
    </View>
  );
}

/** "Worked at": each bar and when, no job titles (decided 20 Oct). Each opens the bar. */
export function WorkedAt({ made }: { made: MadeBy }) {
  const ds = useDs();
  const router = useRouter();
  if (!made.positions.length) return null;
  const rows = [...made.positions].sort((a, b) => Number(b.is_current) - Number(a.is_current) || (b.start_year ?? 0) - (a.start_year ?? 0));
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Worked at
      </Caption>
      <View role="list">
        {rows.map((p) => {
          const when = jobYears(p);
          return (
            <PressableScale key={p.id} role="link" accessibilityLabel={[p.bar.display_name, when].filter(Boolean).join(', ')} onPress={() => router.push(`/p/${p.bar.handle || p.bar.id}` as Href)} style={styles.job}>
              <BarMark name={p.bar.display_name} logoUrl={p.bar.avatar_url} profileId={p.bar.id} size={32} />
              <Body style={styles.flex} numberOfLines={1}>
                {p.bar.display_name}
              </Body>
              {when ? <Caption style={[styles.mono, { color: ds.c.muted }]}>{when}</Caption> : null}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  group: { gap: space.xs },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
  job: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  flex: { flex: 1, minWidth: 0 },
  mono: { fontFamily: fontFamilies.monoMedium },
});
