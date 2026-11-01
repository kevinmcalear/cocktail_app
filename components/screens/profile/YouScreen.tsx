import { useNetInfo } from '@react-native-community/netinfo';
import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Caption, ListGroup, ListNote, ListRow, PencilState, PressableScale, SectionLabel, Title, useDs } from '@/components/ds';
import { usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { useCreditsToCheck } from '@/hooks/useCreditsToCheck';
import { useMyTaste } from '@/hooks/useFlavor';
import { useLovedBars } from '@/hooks/useKept';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks, useMyPersonClaim, useProfile, useProfilePositions } from '@/hooks/useProfiles';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import { useWantToGo } from '@/hooks/useWantToGo';
import { namesLine } from '@/lib/collectionStages';
import { tasteHeadline } from '@/lib/flavor';
import { sortHad } from '@/lib/hadDrinks';
import { plural } from '@/lib/menus';
import { profileLine, youLine } from '@/lib/profiles';

import { CreditsToCheckCard } from './CreditsToCheck';
import { MyJobRequests } from './JobRequests';
import { BestRows, YouStats, YouTop } from './YouParts';
import { YouEmpty, YouError, YouLoading, YouOffline } from './YouStates';
import { ItsYou, YourBarCard } from './YourBarCard';

/** Your best shows this many (Prod-you). */
const BEST = 3;

/**
 * You: your name and line, three stats, your bars, your best, your taste and
 * what you've kept (Prod-you, Kept-you-bars), with Settings behind the gear.
 * The You tab, and the sidebar's You on wide web. Collection's Bars and
 * Drinks fold in here: each row opens its own list (/your-bars, /saved,
 * /your-drinks). Nothing pending shows nothing: a claim, credits to answer
 * and a job to confirm appear only while they wait for you.
 */
export function YouScreen() {
  return (
    <BackbarTheme>
      <You />
    </BackbarTheme>
  );
}

function You() {
  const ds = useDs();
  const router = useRouter();
  const bottom = useTabBarInset();
  const column = usePageColumn('text');
  const openSearch = useOpenSearch();
  const offline = useNetInfo().isConnected === false;
  const authName = useUserDisplayName();
  const me = useMyProfile();
  const profile = me.data;
  const had = useMyHadDrinks();
  const made = useMyMadeDrinks(profile?.id);
  const loved = useLovedBars();
  const { want, isLoading: wantLoading } = useWantToGo();
  const saved = useCollection().data?.drinks.length ?? 0;
  const taste = useMyTaste().data;
  const waitingCredits = useCreditsToCheck().data?.length ?? 0;
  const positions = useProfilePositions(profile ? { id: profile.id, kind: 'person' } : null).data ?? [];
  const claim = useMyPersonClaim().data;
  const waiting = claim?.status === 'pending' ? claim : null;
  const confirmer = useProfile(waiting?.confirm_bar ?? null).data?.display_name;

  const name = profile?.displayName || authName || 'You';
  const drinks = had.data;
  const best = sortHad(drinks ?? [], 'score').slice(0, BEST);
  if (offline) return <YouOffline name={name} best={best} />;
  if (had.error && !drinks) return <YouError name={name} onRetry={() => void had.refetch()} />;
  if (me.isLoading || had.isLoading || loved.isLoading || wantLoading) return <YouLoading name={name} />;

  const ranked = drinks?.length ?? 0;
  const lovedBars = loved.data ?? [];
  const madeCount = made.data?.length ?? 0;
  if (!ranked && !lovedBars.length && !want.length && !madeCount) return <YouEmpty name={name} />;

  const headline = taste ? tasteHeadline(taste.taste) : null;
  const job = positions.find((p) => p.id === profile?.headlinePositionId && p.is_current);
  const line = youLine({
    line: profile ? profileLine({ tagline: profile.tagline, headline_position_id: profile.headlinePositionId }, positions) : null,
    since: job?.start_year ?? null,
    city: profile?.showsCity ? profile.city : null,
    taste: headline,
  });
  const openNow = want.filter((b) => b.hours?.open).length;
  const push = (href: string) => () => router.push(href as Href);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>You</title>
      </WebHead>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <YouTop />
        <View style={[column, styles.body]}>
          {profile ? <ItsYou drinks={madeCount} waiting={waitingCredits} /> : null}
          <View style={styles.identity}>
            <CurrentUserAvatar size={84} />
            <Title aria-level={1} align="center">
              {name}
            </Title>
            {line ? (
              <Caption tone="muted" align="center">
                {line}
              </Caption>
            ) : null}
          </View>
          <YouStats
            stats={[
              { n: ranked, label: 'ranked' },
              { n: lovedBars.length, label: lovedBars.length === 1 ? 'bar loved' : 'bars loved' },
              { n: madeCount, label: 'made by you' },
            ]}
          />

          {waiting ? (
            <PressableScale role="link" onPress={push(`/p/${waiting.profile.handle}`)}>
              <ListNote
                icon="clock"
                text={waiting.confirm_bar ? `Your claim on ${waiting.profile.display_name} is with ${confirmer ?? 'the bar'}’s Admin.` : `Your claim on ${waiting.profile.display_name} is being checked. It usually takes a day.`}
              />
            </PressableScale>
          ) : null}
          {profile ? <CreditsToCheckCard /> : null}
          {profile ? <MyJobRequests personId={profile.id} /> : null}
          {profile ? <YourBarCard positions={positions} headlineId={profile.headlinePositionId} /> : null}

          <View style={styles.section}>
            <SectionLabel title="Your bars" aside="All" onAside={push('/your-bars')} />
            <ListGroup>
              <ListRow first icon="heart" title="Loved" detail={namesLine(lovedBars.map((b) => b.name))} value={String(lovedBars.length)} onPress={push('/your-bars')} />
              <ListRow icon="mappin.and.ellipse" title="Want to go" detail={openNow ? `${openNow === want.length && openNow > 1 ? 'All' : openNow} of them ${openNow === 1 ? 'is' : 'are'} open now` : null} value={String(want.length)} onPress={push('/your-bars?tab=want')} />
            </ListGroup>
          </View>

          <View style={styles.section}>
            <SectionLabel title="Your best" />
            {best.length ? <BestRows drinks={best} /> : <PencilState compact kind="empty" title="No ranks yet" detail="Rank your first drink tonight and your list starts here." action={{ label: 'Rank a drink', onPress: openSearch }} />}
          </View>

          <View style={styles.section}>
            <SectionLabel title="Your taste" />
            <ListGroup>
              <ListRow first title={headline ?? 'Not set yet'} detail={headline && ranked ? `From your ${plural(ranked, 'rank')}` : 'Tell us what you like'} onPress={push('/taste')} />
            </ListGroup>
          </View>

          <View style={styles.section}>
            <SectionLabel title="Kept" />
            <ListGroup>
              <ListRow first icon="bookmark" title="Saved drinks" value={String(saved)} onPress={push('/saved')} />
              <ListRow icon="wineglass" title="Drinks you’ve had" value={String(ranked)} onPress={push('/your-drinks')} />
              {madeCount ? <ListRow icon="person" title="Credits" detail={`${plural(madeCount, 'drink')} ${madeCount === 1 ? 'names' : 'name'} you as their maker`} onPress={push('/your-drinks?tab=originals')} /> : null}
            </ListGroup>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.xl, paddingTop: space.sm },
  identity: { alignItems: 'center', gap: space.sm },
  section: { gap: space.md },
});
