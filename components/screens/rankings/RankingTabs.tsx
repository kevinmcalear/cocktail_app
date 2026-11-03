import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useDrinkRankings, type RankEntry } from '@/hooks/useRankings';
import { useDrinkMakers, useFriendsInList } from '@/hooks/useRankResult';
import { useBarVersions } from '@/hooks/useSpecMatches';
import { heroPicture } from '@/lib/itemImages';
import { entryLine } from '@/lib/rankResult';
import { formatScore, MIN_RANKERS, plural } from '@/lib/ranking';

import { ReportAction } from '../safety/ReportSheet';
import { ListNote } from './RankingLists';
import { BlockLabel, ScoreRow } from './ScoreRows';

interface AreaListProps {
  rankedAs: { id: string; name: string };
  area: Record<string, string>;
  /** "in New York", "in Brooklyn", "anywhere". */
  where: string;
  mine: RankEntry[];
  mineLoading: boolean;
  signedIn: boolean;
}

/**
 * Best Negroni in an area: one drink at one bar per row, how many ranked it
 * and who made it; the bar you ranked it at sits on the accent with your
 * score. Below the floor it says so and shows your own.
 */
export function AreaList({ rankedAs, area, where, mine, mineLoading, signedIn }: AreaListProps) {
  const router = useRouter();
  const { data: best, isLoading, error } = useDrinkRankings(rankedAs.id, area);
  const rows = best ?? [];
  const pours = useBarVersions(rankedAs.id, rows.map((r) => r.venue_profile_id));
  const drinkOf = (venueId: string) => pours[venueId]?.itemId ?? rankedAs.id;
  const makers = useDrinkMakers(rows.map((r) => drinkOf(r.venue_profile_id)).filter((id) => id !== rankedAs.id));

  if (error) return <ListNote>{`Couldn't load the rankings: ${error.message}`}</ListNote>;
  if (isLoading) return <ListNote>Loading…</ListNote>;
  if (!rows.length) {
    return (
      <View style={styles.block}>
        <ListNote>{`Not enough rankers yet ${where}. A bar’s ${rankedAs.name} shows here once ${MIN_RANKERS} people have ranked it there.`}</ListNote>
        {signedIn && (mineLoading || mine.length) ? (
          <>
            <BlockLabel>{`Your ${plural(rankedAs.name)}`}</BlockLabel>
            {mineLoading ? <ListNote>Loading your list…</ListNote> : <MyRows mine={mine} rankedAs={rankedAs} />}
          </>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.block}>
      <View aria-label={`Best ${rankedAs.name} ${where}`}>
        {rows.map((r) => {
          const itemId = drinkOf(r.venue_profile_id);
          // Your rank of this row's drink; while the bar's version is unknown, your rank at that bar.
          const atBar = mine.filter((e) => e.venue_profile_id === r.venue_profile_id);
          const yours = atBar.find((e) => e.item_id === itemId) ?? (pours[r.venue_profile_id] ? undefined : atBar[0]);
          const who = yours ? `your ${formatScore(yours.score)}` : makers[itemId];
          return (
            <ScoreRow
              key={r.venue_profile_id}
              position={r.position}
              itemId={itemId}
              title={r.display_name}
              sub={[`${r.rankers} ranks`, who].filter(Boolean).join(' · ')}
              score={r.score}
              mine={!!yours}
              onPress={() => router.push(`/p/${r.handle || r.venue_profile_id}`)}
            />
          );
        })}
      </View>
      <Caption tone="muted">Each row is one drink at one bar. Scores are 0 to 10, from people comparing drinks two at a time. Updated every hour.</Caption>
      <View style={styles.report}>
        <ReportAction
          subject={`a ${rankedAs.name} ranking`}
          targets={rows.map((r) => ({ label: `${r.display_name}'s ${rankedAs.name}`, target: { kind: 'ranking', itemId: rankedAs.id, profileId: r.venue_profile_id } }))}
        />
      </View>
    </View>
  );
}

/** Your own list for this drink, best first. */
function MyRows({ mine, rankedAs }: { mine: RankEntry[]; rankedAs: { name: string } }) {
  return (
    <View>
      {mine.map((e, i) => {
        const picture = heroPicture(e.item?.item_images);
        return (
          <ScoreRow
            key={e.id}
            position={i + 1}
            itemId={e.item_id}
            pictureUrl={picture?.url}
            pictureIsSketch={picture?.isSketch}
            title={e.venue?.display_name ?? 'Home'}
            sub={entryLine(e, rankedAs.name)}
            score={e.score}
          />
        );
      })}
    </View>
  );
}

/** The people you follow who ranked this drink, best first, as each of them shows it. */
export function FriendsList({ rankedAs }: { rankedAs: { id: string; name: string } }) {
  const { data, isLoading, error } = useFriendsInList(rankedAs.id, true);
  if (error) return <ListNote>{`Couldn't load your friends' ranks: ${error.message}`}</ListNote>;
  if (isLoading) return <ListNote>Loading…</ListNote>;
  if (!data.length) return <ListNote>{`Nobody you follow has ranked a ${rankedAs.name} yet. Their ranks show here as they make them.`}</ListNote>;
  return (
    <View aria-label={`Your friends' ${plural(rankedAs.name)}`}>
      {data.map((f, i) => (
        <ScoreRow key={f.entryId} position={i + 1} itemId={f.itemId} title={f.name} sub={f.venueName ?? 'Home'} score={f.score} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  report: { alignItems: 'flex-start' },
});

