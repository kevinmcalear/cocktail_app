import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Button, Caption, GlassButton, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { PersonProfile } from '@/components/screens/profile/PersonProfile';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useFollowers, useFollowing, usePeopleByUser, type FollowPerson } from '@/hooks/useFollows';
import { useProfile } from '@/hooks/useProfiles';

import { PEOPLE_NOTE, PeopleList, type PeopleTab } from './PeopleList';

/** The list's width beside the person on the web (Kept-follow-desk). */
const LIST_WIDTH = 460;
/** The person's page beside it. */
const PERSON_WIDTH = 600;

/**
 * You › People (Kept-people, Kept-follow-desk): Following and Followers. On a
 * phone a row opens the person's page; on the web the list sits on the left
 * and the person opens beside it, the first one to start with.
 */
export function PeopleScreen() {
  return (
    <BackbarTheme>
      <People />
    </BackbarTheme>
  );
}

function People() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame(LIST_WIDTH);
  const bottom = useTabBarInset();
  const params = useLocalSearchParams<{ tab?: string; person?: string }>();
  const tab: PeopleTab = params.tab === 'followers' ? 'followers' : 'following';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));
  const find = () => router.push('/people/find' as Href);
  const open = (p: FollowPerson) => (frame.wide ? router.setParams({ person: p.profileId }) : router.push(`/p/${p.handle}` as Href));
  const first = useFirstPerson(tab, frame.wide);
  const selectedId = frame.wide ? (params.person ?? first) : null;

  const list = (
    <View style={styles.page}>
      <SubPageHead
        title="People"
        subtitle={PEOPLE_NOTE}
        crumbs={[{ label: 'You', href: '/you' }]}
        onBack={back}
        trailing={frame.wide ? null : <GlassButton accessibilityLabel="Find people" icon="magnifyingglass" onPress={find} />}
      />
      <PeopleList tab={tab} onTab={(t) => router.setParams({ tab: t, person: undefined })} onOpen={open} onFind={find} selectedId={selectedId} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>People</title>
      </WebHead>
      {frame.wide ? (
        <View style={styles.split}>
          <ScrollView style={[styles.list, { borderRightColor: ds.c.line }]} contentContainerStyle={{ paddingTop: frame.top, paddingBottom: bottom + space.xxxl, paddingHorizontal: gutter }}>
            {list}
          </ScrollView>
          <ScrollView style={styles.flex} contentContainerStyle={[styles.side, { paddingTop: frame.top, paddingBottom: bottom + space.xxxl, paddingHorizontal: gutter }]}>
            <View style={styles.findRow}>
              <Button label="Find people" icon="magnifyingglass" variant="secondary" onPress={find} />
            </View>
            <View style={styles.person}>{selectedId ? <OpenPerson profileId={selectedId} /> : null}</View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: frame.top, paddingBottom: bottom + space.xxxl, paddingHorizontal: gutter }}>
          <View style={frame.column}>{list}</View>
        </ScrollView>
      )}
    </View>
  );
}

/** On the web, the person the page opens beside the list before you pick one. */
function useFirstPerson(tab: PeopleTab, wide: boolean): string | null {
  const following = useFollowing();
  const followers = useFollowers();
  const ids = (tab === 'following' ? following.data : followers.data) ?? [];
  const people = usePeopleByUser(wide ? ids : []).data ?? [];
  return people[0]?.profileId ?? null;
}

/** The person beside the list, as their own page reads. */
function OpenPerson({ profileId }: { profileId: string }) {
  const { data: profile, isLoading } = useProfile(profileId);
  if (isLoading) return <Caption tone="muted">Loading…</Caption>;
  if (!profile) return <Caption tone="muted">Their page isn’t public now.</Caption>;
  return <PersonProfile profile={profile} columns={2} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  page: { gap: space.lg },
  split: { flex: 1, flexDirection: 'row' },
  list: { width: LIST_WIDTH, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  side: { alignItems: 'center', gap: space.lg },
  findRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  person: { width: '100%', maxWidth: PERSON_WIDTH },
});
