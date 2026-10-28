import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useCreditsToCheck } from '@/hooks/useCreditsToCheck';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks, useMyPersonClaim, useProfile, useProfilePositions } from '@/hooks/useProfiles';
import { useMyHadDrinks, useMyHadPicks } from '@/hooks/useRankings';
import { hadStats } from '@/lib/hadDrinks';
import { pickedShown, profileLine } from '@/lib/profiles';
import { siteOrigin } from '@/lib/venueLink';

import { TasteCard } from '../taste/TasteCard';
import { CreditsToCheckCard } from './CreditsToCheck';
import { MyJobRequests } from './JobRequests';
import { MyAwards } from './PersonAwards';
import { Stat, Stats } from './ProfileSections';
import { TopFour, fourSlots } from './TopFour';
import { useShareLink } from './useShareLink';
import { YouTabs } from './YouTabs';
import { ItsYou, YourBarCard } from './YourBarCard';

/**
 * You: your own profile, whether or not you've made a public one. Every
 * drink you've had with your score, your favourites, how each bar did across
 * what you had there, and the drinks you've made. /you, opened from the
 * avatar in the header on phones, and the sidebar's You on wide web (the
 * home sidebar's You tab shows it too). Always with Close and Settings on top.
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
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const authName = useUserDisplayName();
  const { data: profile } = useMyProfile();
  const had = useMyHadDrinks();
  const picks = useMyHadPicks().data ?? {};
  const made = useMyMadeDrinks(profile?.id);
  const waitingCredits = useCreditsToCheck().data?.length ?? 0;
  const positions = useProfilePositions(profile ? { id: profile.id, kind: 'person' } : null).data ?? [];
  const name = profile?.displayName || authName || 'You';
  // A claim on a page waiting, with no profile yet: that page becomes theirs, so no "Make a public profile" (a second one).
  const claim = useMyPersonClaim().data;
  const waiting = !profile && claim?.status === 'pending' ? claim : null;
  const confirmer = useProfile(waiting?.confirm_bar ?? null).data?.display_name;
  const share = useShareLink(`${siteOrigin()}/p/${profile?.handle ?? ''}`, name);

  const drinks = had.data ?? [];
  const stats = hadStats(drinks);
  const madeCount = made.data?.length ?? 0;
  const shown = profile?.isPublic && !profile.isModerated;
  // You is its own preview: the line and city as people see them.
  const line = profile ? profileLine({ tagline: profile.tagline, headline_position_id: profile.headlinePositionId }, positions) : null;
  const city = profile?.showsCity ? profile.city : null;
  // Pins in order; a place whose drink doesn't show (its section is None) is Empty.
  const pinned = drinks
    .filter((d) => picks[d.id]?.pin && profile && pickedShown(profile.sharing.had, picks[d.id]?.onProfile))
    .sort((a, b) => (picks[a.id]?.pin ?? 0) - (picks[b.id]?.pin ?? 0));
  const padding = { paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>You</title>
      </WebHead>
      <ScrollView contentContainerStyle={padding}>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          {profile ? <ItsYou drinks={madeCount} waiting={waitingCredits} /> : null}
          <View style={styles.header}>
            <CurrentUserAvatar size={96} />
            <Title role="heading" align="center">
              {name}
            </Title>
            <Caption tone="muted" align="center">
              {profile
                ? [`@${profile.handle}`, city, shown ? 'Public profile' : 'Private profile'].filter(Boolean).join(' · ')
                : waiting
                  ? `Claim sent for ${waiting.profile.display_name} · ${waiting.confirm_bar ? `${confirmer ?? 'The bar'}’s Admin confirms it` : 'A person checks it, usually within a day'}`
                  : 'No public profile yet'}
            </Caption>
            {line ? <Body align="center">{line}</Body> : null}
            <View style={styles.actions}>
              {waiting ? (
                <Button label="See the page" variant="secondary" onPress={() => router.push(`/p/${waiting.profile.handle}`)} />
              ) : (
                <Button label={profile ? 'Edit profile' : 'Make a public profile'} variant="secondary" onPress={() => router.push('/settings/profile')} />
              )}
              {profile && shown ? <Button label="Share" variant="secondary" icon="square.and.arrow.up" onPress={() => void share()} /> : null}
            </View>
          </View>

          {profile ? <CreditsToCheckCard /> : null}

          {profile ? <MyJobRequests personId={profile.id} /> : null}

          <Stats>
            <Stat value={stats.drinks} label={stats.drinks === 1 ? 'drink' : 'drinks'} />
            <Stat value={stats.bars} label={stats.bars === 1 ? 'bar' : 'bars'} />
            <Stat value={madeCount} label={madeCount === 1 ? 'original' : 'originals'} />
          </Stats>

          {profile ? <YourBarCard positions={positions} headlineId={profile.headlinePositionId} /> : null}

          <TasteCard />

          {profile ? <TopFour slots={fourSlots(pinned)} changeHref="/settings/profile-picks?section=had" /> : null}

          {profile ? <MyAwards profileId={profile.id} mode={profile.awardsMode} /> : null}

          <YouTabs profile={profile ?? null} drinks={drinks} made={made.data ?? []} loading={had.isLoading || made.isLoading} failed={!!had.error} />
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <GlassButton accessibilityLabel="Settings" icon="place.settings" onPress={() => router.push('/settings')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Centred: the profile itself is centred under your avatar. Wider than text for the drink grids.
  body: { gap: space.xl, width: '100%', maxWidth: 960, alignSelf: 'center' },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  header: { alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.xs },
});
