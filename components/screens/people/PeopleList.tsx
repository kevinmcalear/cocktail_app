import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Segmented } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useFollowers, useFollowing, useFriendsRanks, usePeopleByUser, type FollowPerson, type FriendRank } from '@/hooks/useFollows';
import { useProfilePositions } from '@/hooks/useProfilePositions';
import { useProfileDrinks } from '@/hooks/useRankings';
import { isThisWeek, rankWhen, withArticle } from '@/lib/follows';
import { plural } from '@/lib/menus';
import { profileLine } from '@/lib/profiles';

import { FollowText } from './Follow';
import { PeopleEmpty, PersonRow } from './PersonRow';

export type PeopleTab = 'following' | 'followers';

/** Under People's title: who sees these lists. */
export const PEOPLE_NOTE = 'Only you see who you follow and who follows you.';

/**
 * People (Kept-people): who you follow and who follows you, yours alone.
 * Following rows say what each person did lately; Followers rows say where
 * they are and how many they've ranked, with Follow back. Someone with no
 * public page can't be named here, so they're counted under the list.
 */
export function PeopleList({ tab, onTab, onOpen, onFind, selectedId }: { tab: PeopleTab; onTab: (t: PeopleTab) => void; onOpen: (p: FollowPerson) => void; onFind: () => void; selectedId?: string | null }) {
  const following = useFollowing();
  const followers = useFollowers();
  const ids = tab === 'following' ? following : followers;
  const people = usePeopleByUser(ids.data);
  // Their latest shared rank, for "Ranked a Penicillin tonight" (friends_ranks reads only what they show).
  const latest = useFriendsRanks(50).data ?? [];
  const list = ids.data?.length ? (people.data ?? []) : [];
  const unnamed = (ids.data?.length ?? 0) - list.length;
  const failed = ids.error || people.error;
  const loading = ids.isLoading || (!!ids.data?.length && people.isLoading);

  return (
    <View style={styles.body}>
      <Segmented
        accessibilityLabel="People"
        stretch
        options={[
          { value: 'following', label: count('Following', following.data) },
          { value: 'followers', label: count('Followers', followers.data) },
        ]}
        value={tab}
        onChange={onTab}
      />
      {failed ? (
        <View style={styles.note}>
          <Body tone="muted">Couldn’t load people. Check your connection and try again.</Body>
          <Button label="Try again" variant="secondary" onPress={() => void (ids.refetch(), people.refetch())} style={styles.start} />
        </View>
      ) : loading ? (
        <Caption tone="muted">Loading people…</Caption>
      ) : !ids.data?.length ? (
        tab === 'following' ? (
          <PeopleEmpty title="Follow people whose taste you trust" text="Their new ranks show on your Tonight. Nobody else sees who you follow." onFind={onFind} />
        ) : (
          <PeopleEmpty title="Nobody follows you yet" text="When someone does, they show here. Only you see who follows you." onFind={onFind} />
        )
      ) : (
        <View role="list">
          {list.map((p, i) =>
            tab === 'following' ? (
              <FollowingRow key={p.profileId} person={p} latest={latest.find((r) => r.profileId === p.profileId)} first={i === 0} selected={p.profileId === selectedId} onPress={() => onOpen(p)} />
            ) : (
              <FollowerRow key={p.profileId} person={p} first={i === 0} selected={p.profileId === selectedId} onPress={() => onOpen(p)} />
            ),
          )}
        </View>
      )}
      {unnamed > 0 && !loading && !failed ? (
        <Caption tone="muted">
          {tab === 'following'
            ? `${plural(unnamed, 'more person', 'more people')} you follow ${unnamed === 1 ? 'has' : 'have'} no public page now.`
            : `${plural(unnamed, 'more person', 'more people')} without a public page ${unnamed === 1 ? 'follows' : 'follow'} you.`}
        </Caption>
      ) : null}
    </View>
  );
}

const count = (label: string, ids: string[] | undefined) => (ids ? `${label} · ${ids.length}` : label);

/** Someone you follow: what they ranked this week, else their line, else nothing new. */
function FollowingRow({ person: p, latest, first, selected, onPress }: { person: FollowPerson; latest: FriendRank | undefined; first: boolean; selected: boolean; onPress: () => void }) {
  const positions = useProfilePositions({ id: p.profileId, kind: 'person' }).data ?? [];
  const now = new Date();
  const sub =
    latest && isThisWeek(latest.createdAt, now)
      ? `Ranked ${withArticle(latest.name)} ${rankWhen(latest.createdAt, now)}`
      : (profileLine({ tagline: p.tagline, headline_position_id: p.headlinePositionId }, positions) ?? 'Nothing new this week');
  return <PersonRow name={p.name} avatarUrl={p.avatarUrl} sub={sub} first={first} selected={selected} onPress={onPress} />;
}

/** Someone who follows you: where they are, how many they've ranked, and Follow back. */
function FollowerRow({ person: p, first, selected, onPress }: { person: FollowPerson; first: boolean; selected: boolean; onPress: () => void }) {
  return <PersonRow name={p.name} avatarUrl={p.avatarUrl} sub={usePersonSub(p)} first={first} selected={selected} onPress={onPress} end={p.userId ? <FollowText userId={p.userId} name={p.name} /> : undefined} />;
}

/** "New York · 61 ranked", from what they show. */
export function usePersonSub(p: FollowPerson, extra?: string | null): string | null {
  // ponytail: one get_profile_drinks call per row; a definer read with the counts (Kevin's) would make it one.
  const ranked = useProfileDrinks(p.profileId, p.hadMode !== 'none').data?.length ?? 0;
  return [p.place, ranked ? `${ranked} ranked` : null, extra].filter(Boolean).join(' · ') || null;
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  note: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
