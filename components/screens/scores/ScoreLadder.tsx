import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, useDs } from '@/components/ds';
import { BlockLabel, ScoreRow } from '@/components/screens/rankings/ScoreRows';
import { space } from '@/constants/tokens';
import { useFriendsRanks } from '@/hooks/useFollows';
import { areaFor, useDrinkRankings, useMyRankList, type AreaRanking } from '@/hooks/useRankings';
import { useDrinkScore } from '@/hooks/useScores';
import { formatScore } from '@/lib/ranking';
import { barRanksLine, belowFloorNote, cityPlaceLine, floorProgress, ladderStep, listsNextLine, num, whenHad, yourPlace, type DrinkScore } from '@/lib/scores';

import { Note, PersonRow, Stats } from './ScoreParts';

/** Rows a list shows here: the top three, and this bar if it's further down. */
const TOP = 3;

/**
 * Where a bar drink's score stands on the ladder (Loop-ladder "rung"): you
 * and your friends' ranks until people pass the floor, then the bar's drinks
 * together, then the drink's own score beside where it sits in your list,
 * then its city's and postcode's lists. Nothing for a drink without a public
 * bar page. Its score opens the score page (Red-score).
 */
export function ScoreLadder({ itemId }: { itemId: string }) {
  const { data: s } = useDrinkScore(itemId);
  if (!s) return null;
  return <Ladder itemId={itemId} s={s} />;
}

function Ladder({ itemId, s }: { itemId: string; s: DrinkScore }) {
  const router = useRouter();
  const step = ladderStep(s);
  const name = s.ranked_as_name;
  const score = num(s.score);
  const openScore = () => router.push(`/score/${itemId}` as Href);
  const people = usePeople(itemId, s.ranked_as_item_id, step <= 2);
  const { data: mine = [] } = useMyRankList(step === 3 ? s.ranked_as_item_id : null);

  if (step === 1) {
    return (
      <View style={styles.block}>
        {people.length ? <People rows={people} /> : null}
        <Note icon="chart.bar">{belowFloorNote(name, s.city, s.floor)}</Note>
      </View>
    );
  }
  if (step === 2) {
    return (
      <View style={styles.block}>
        <Stats
          items={[
            { title: `${s.bar_name}, all drinks`, value: formatScore(Number(s.bar.score)), sub: barRanksLine(s.bar.ranks, s.bar.since) },
            { title: `This ${s.name}`, value: floorProgress(s.rankers, s.floor), sub: 'to its own score', onPress: openScore },
          ]}
        />
        {people.length ? <People rows={people.slice(0, 2)} /> : null}
      </View>
    );
  }
  if (step === 3) {
    const you = yourPlace(mine, itemId, name);
    const next = listsNextLine(s);
    return (
      <View style={styles.block}>
        <Stats
          items={[
            { title: `${s.name} here`, value: formatScore(score ?? 0), sub: `${s.rankers} ranks`, onPress: openScore },
            ...(you ? [{ title: you.title, value: you.score, sub: you.sub }] : []),
          ]}
        />
        {next ? <Note icon="chart.bar">{next}</Note> : null}
      </View>
    );
  }
  return <AreaList itemId={itemId} s={s} scope={step === 5 ? 'postcode' : 'city'} />;
}

/** Rungs 4 and 5: the best of it in the city, or the postcode, this bar's row on the wash. */
function AreaList({ itemId, s, scope }: { itemId: string; s: DrinkScore; scope: 'city' | 'postcode' }) {
  const ds = useDs();
  const router = useRouter();
  const { data: rows = [] } = useDrinkRankings(s.ranked_as_item_id, areaFor(s, scope));
  const shown = rows.filter((r) => r.position <= TOP || r.venue_profile_id === s.venue_profile_id);
  const where = scope === 'city' ? s.city : s.postcode;
  const city = scope === 'postcode' ? cityPlaceLine(s) : null;
  return (
    <View style={styles.list}>
      <BlockLabel aside="Each hour">{`Best ${s.ranked_as_name} · ${where ?? ''}`}</BlockLabel>
      <View>
        {shown.map((r: AreaRanking) => (
          <ScoreRow
            key={r.venue_profile_id}
            position={r.position}
            itemId={r.venue_profile_id === s.venue_profile_id ? itemId : s.ranked_as_item_id}
            title={r.display_name}
            sub={`${r.rankers} ranks`}
            score={r.score}
            mine={r.venue_profile_id === s.venue_profile_id}
            onPress={() => (r.venue_profile_id === s.venue_profile_id ? router.push(`/score/${itemId}` as Href) : router.push(`/p/${r.handle || r.venue_profile_id}` as Href))}
          />
        ))}
      </View>
      {city ? (
        <Body tone="muted">
          {`${city} `}
          <Body role="link" color={ds.accentText} onPress={() => router.push(`/rankings/${s.ranked_as_item_id}` as Href)}>
            See the city.
          </Body>
        </Body>
      ) : null}
    </View>
  );
}

interface Person {
  key: string;
  name: string;
  avatarUrl: string | null;
  when: string;
  score: number;
}

/** You and the people you follow who ranked this drink at this bar, best first. */
function usePeople(itemId: string, rankedAsId: string, enabled: boolean): Person[] {
  const { data: mine = [] } = useMyRankList(enabled ? rankedAsId : null);
  const { data: friends = [] } = useFriendsRanks(50, enabled);
  const you = mine.find((e) => e.item_id === itemId);
  return [
    ...(you ? [{ key: 'you', name: 'You', avatarUrl: null, when: whenHad(you), score: you.score }] : []),
    ...friends.filter((f) => f.itemId === itemId).map((f) => ({ key: f.entryId, name: f.displayName, avatarUrl: f.avatarUrl, when: whenHad({ had_on: null, created_at: f.createdAt }), score: f.score })),
  ];
}

function People({ rows }: { rows: Person[] }) {
  return (
    <View>
      {rows.map((p) => (
        <PersonRow key={p.key} name={p.name} avatarUrl={p.avatarUrl} sub={p.when} score={formatScore(p.score)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  list: { gap: space.sm },
});
