import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, Segmented, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMyMadeDrinks } from '@/hooks/useProfiles';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { hadStats, tallyBars } from '@/lib/hadDrinks';

import { TasteCard } from '../taste/TasteCard';
import { BarTallies, Favourites, HadList } from './HadDrinks';
import { MyJobRequests } from './JobRequests';
import { OriginalsGrid, Stat, Stats } from './ProfileSections';

type Tab = 'had' | 'bars' | 'made';
const TABS = [
  { value: 'had', label: 'Had' },
  { value: 'bars', label: 'Bars' },
  { value: 'made', label: 'Made' },
] as const;

/**
 * You: your own profile, whether or not you've made a public one. Every
 * drink you've had with your score, your favourites, how each bar did across
 * what you had there, and the drinks you've made. It's the You tab in home
 * mode, and /you (the avatar in the header) in venue mode.
 */
export function YouScreen({ inTabs }: { inTabs?: boolean }) {
  // The tabs already sit in the Back Bar theme (VenueBrandProvider).
  if (inTabs) return <You inTabs />;
  return (
    <BackbarTheme>
      <You />
    </BackbarTheme>
  );
}

function You({ inTabs }: { inTabs?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const tabInset = useTabBarInset();
  const breakpoint = useBreakpoint();
  const columns = breakpoint === 'phone' ? 2 : breakpoint === 'tablet' ? 3 : 4;
  const authName = useUserDisplayName();
  const { data: profile } = useMyProfile();
  const had = useMyHadDrinks();
  const made = useMyMadeDrinks(profile?.id);
  const [tab, setTab] = useState<Tab>('had');

  const drinks = had.data ?? [];
  const stats = hadStats(drinks);
  const madeCount = made.data?.length ?? 0;
  const shown = profile?.isPublic && !profile.isModerated;
  const padding = inTabs
    ? { paddingBottom: tabInset }
    : { paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl };

  const nothingYet = (
    <View style={styles.empty}>
      <Body tone="muted">Nothing here yet. Open a drink you’ve had and tap Rank it: it lands here with your score, and counts towards the bar’s.</Body>
      <Button label="Find a drink" icon="magnifyingglass" onPress={() => router.navigate('/search')} style={styles.start} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>You</title>
      </WebHead>
      <ScrollView contentContainerStyle={padding}>
        {inTabs ? <ScreenHeader you={false} /> : null}
        <View style={[styles.body, inTabs && styles.underHeader, { paddingHorizontal: gutter }]}>
          <View style={styles.header}>
            <CurrentUserAvatar size={88} />
            <Title role="heading" align="center">
              {profile?.displayName || authName || 'You'}
            </Title>
            <Caption tone="muted" align="center">
              {profile ? `@${profile.handle} · ${shown ? 'Public profile' : 'Private profile'}` : 'No public profile yet'}
            </Caption>
            <View style={styles.actions}>
              <Button label={profile ? 'Edit profile' : 'Make a public profile'} variant="secondary" onPress={() => router.push('/settings/profile')} />
              {profile && shown ? <Button label="See public page" variant="ghost" icon="globe" onPress={() => router.push(`/p/${profile.handle}` as Href)} /> : null}
            </View>
          </View>

          {profile ? <MyJobRequests personId={profile.id} /> : null}

          <Stats>
            <Stat value={stats.drinks} label={stats.drinks === 1 ? 'drink had' : 'drinks had'} />
            <Stat value={stats.bars} label={stats.bars === 1 ? 'bar' : 'bars'} />
            <Stat value={madeCount} label="made" />
          </Stats>

          <TasteCard />

          {drinks.some((d) => d.sentiment === 'loved') ? (
            <View style={styles.section}>
              <Headline role="heading">Favourites</Headline>
              <Favourites drinks={drinks} columns={columns} />
            </View>
          ) : null}

          <View style={styles.section}>
            <Segmented accessibilityLabel="Your drinks" options={TABS} value={tab} onChange={setTab} />
            {tab === 'made' ? (
              made.isLoading ? (
                <Caption tone="muted">Loading your drinks…</Caption>
              ) : (
                <OriginalsGrid originals={made.data ?? []} selfId={profile?.id ?? ''} columns={columns} emptyText="You haven’t made a drink yet. Tap New to write one up." />
              )
            ) : had.error ? (
              <Body tone="muted">Couldn’t load your drinks. Check your connection and try again.</Body>
            ) : had.isLoading ? (
              <Caption tone="muted">Loading your drinks…</Caption>
            ) : !drinks.length ? (
              nothingYet
            ) : tab === 'had' ? (
              <HadList drinks={drinks} />
            ) : (
              <BarTallies bars={tallyBars(drinks)} whose="Your" />
            )}
            {drinks.length && tab !== 'made' ? (
              <Caption tone="muted">
                {shown && profile?.sharing[tab === 'had' ? 'had' : 'bars'] === 'all'
                  ? 'Shown on your public profile, apart from ones you hide and drinks a bar hasn’t published. Change it in Edit profile.'
                  : shown && profile?.sharing[tab === 'had' ? 'had' : 'bars'] === 'picked'
                    ? 'Only the ones you pick show on your public profile. Choose them in Edit profile.'
                    : `Only you can see ${tab === 'had' ? 'what you’ve had and your scores' : 'your bars and your average at each'}. You can show them on a public profile.`}
              </Caption>
            ) : null}
          </View>
        </View>
      </ScrollView>
      {inTabs ? null : (
        <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
          <GlassButton
            accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
            icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
          <GlassButton accessibilityLabel="Settings" icon="gearshape" onPress={() => router.push('/settings')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Centred: the profile itself is centred under your avatar. Wider than text for the drink grids.
  body: { gap: space.xl, width: '100%', maxWidth: 960, alignSelf: 'center' },
  underHeader: { paddingTop: space.lg },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  header: { alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.xs },
  section: { gap: space.md },
  empty: { gap: space.md, paddingVertical: space.md },
  start: { alignSelf: 'flex-start' },
});
