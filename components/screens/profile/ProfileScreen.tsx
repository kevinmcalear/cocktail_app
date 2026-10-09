import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, Segmented, Tag, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMyProfile } from '@/hooks/useMyProfile';
import { isUnclaimed, useMenuCredits, useProfile, useProfileOriginals, useProfilePicks, useProfilePositions, type Profile } from '@/hooks/useProfiles';
import { useProfileBars, useProfileDrinks } from '@/hooks/useRankings';
import { hadStats, topFour } from '@/lib/hadDrinks';
import { pageLocksSpecs, pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';
import { barsCrediting, personTabs, pickedShown, profileLine } from '@/lib/profiles';

import { SpecLockPanel } from '../drink/SpecLockPanel';
import { SignInCard } from '../published/SignInCard';
import { LoveBarButton } from '../kept/LoveBarButton';
import { BlockedProfileNote, ProfileSafety } from '../safety/ProfileSafety';
import { BarClassics } from './BarClassics';
import { BarMatches } from './BarMatches';
import { BarRankings } from './BarRankings';
import { Awards, MenuHistory } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { Favourites, SharedDrinks } from './HadDrinks';
import { LockedOriginals } from './LockedOriginals';
import { MakerProfile } from './MakerProfile';
import { Positions } from './Positions';
import { ProfileLinks } from './ProfileLinks';
import { WorkedMenus } from './WorkedMenus';
import { BarHeader, BarStats, MenuCredits, OriginalsGrid, Stat, Stats } from './ProfileSections';

type Tab = 'menus' | 'originals' | 'rankings' | 'people' | 'had' | 'bars';
/**
 * A person's page has the drinks they've had, how each bar did, and the drinks
 * they've made, each one only when they show it (or to them).
 * ponytail: no Shelf tab, since shelves aren't public yet and an empty one
 * (worst on a bartender who has died) reads wrong. When shelves can be shown,
 * add the tab only for a profile whose shelf has bottles.
 */
const PERSON_TABS = [
  { value: 'had', label: 'Had' },
  { value: 'bars', label: 'Bars' },
  { value: 'originals', label: 'Originals' },
] as const;
/** A bar's page leads with its menus. */
const BAR_TABS = [
  { value: 'menus', label: 'Menus' },
  { value: 'originals', label: 'Originals' },
  { value: 'rankings', label: 'Top drinks' },
  { value: 'people', label: 'People' },
] as const;

/**
 * A public profile: a person or a bar, the same kind of page (a maker's has
 * its own, MakerProfile). Who they are,
 * the drinks credited to them, and the bars that put those drinks on a menu
 * (the credit that matters most). A person who chooses to can show the
 * drinks they've had, with their scores.
 */
export function ProfileScreen({ profileRef }: { profileRef: string | string[] | undefined }) {
  return (
    <BackbarTheme>
      <ProfilePage profileRef={profileRef} />
    </BackbarTheme>
  );
}

function ProfilePage({ profileRef }: { profileRef: string | string[] | undefined }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const signedIn = useSignedIn();
  const { data: profile, isLoading, error } = useProfile(profileRef);
  // A person's page is for people who've signed in; a bar's opens to anyone.
  const gated = profile?.kind === 'person' && !signedIn;

  const controls = (
    <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
      <GlassButton
        accessibilityLabel="Back"
        icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      {profile && !gated ? (
        <View style={styles.right}>
          {profile.kind === 'bar' ? <LoveBarButton profileId={profile.id} name={profile.display_name} /> : null}
          <ProfileSafety profile={profile} />
        </View>
      ) : null}
    </View>
  );

  let body;
  if (profile && gated) body = <SignInCard text={`Sign in to see ${profile.display_name}’s profile: the drinks they’ve made, where they’ve worked and what they’re drinking.`} />;
  else if (profile) {
    const columns = breakpoint === 'phone' ? 2 : breakpoint === 'tablet' ? 3 : 4;
    body = profile.kind === 'maker' ? <MakerProfile profile={profile} columns={columns} /> : <ProfileBody profile={profile} columns={columns} />;
  }
  else if (isLoading) body = <Caption tone="muted" accessibilityLabel="Loading profile">Loading…</Caption>;
  else
    body = (
      <BlockedProfileNote profileRef={profileRef}>
        <Body tone="muted">{error ? "Couldn't load this profile. Check your connection and try again." : "There's no public profile here. It may be private or the link may be wrong."}</Body>
      </BlockedProfileNote>
    );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.readable}>{body}</View>
      </ScrollView>
      {controls}
    </View>
  );
}

function ProfileBody({ profile, columns }: { profile: Profile; columns: number }) {
  const router = useRouter();
  const person = profile.kind === 'person';
  const signedIn = useSignedIn();
  const mine = useMyProfile().data?.id === profile.id;
  const shown = personTabs(profile, mine);
  const tabs = person ? PERSON_TABS.filter((t) => shown.includes(t.value)) : BAR_TABS;
  const [picked, setTab] = useState<Tab | null>(null);
  // Until they pick, the first tab; and never one the profile has stopped showing.
  const tab: Tab | undefined = tabs.find((t) => t.value === picked)?.value ?? tabs[0]?.value;
  // A bar's credits always show; a person's when they choose to, one by one.
  const showsMade = !person || profile.made_mode !== 'none';
  const had = useProfileDrinks(profile.id, person && profile.had_mode !== 'none');
  const bars = useProfileBars(profile.id, person && profile.bars_mode !== 'none');
  const hadStat = hadStats(had.data ?? []);
  const pinned = topFour(had.data ?? []);
  const madePicks = useProfilePicks(person ? profile.id : null, 'originals').data ?? {};
  const { data: credited = [], isLoading } = useProfileOriginals(profile.id, { locked: profile.page_visibility === 'locked' });
  const originals = person ? credited.filter((d) => pickedShown(profile.made_mode, madePicks[d.id])) : credited;
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const onMenus = barsCrediting(credits);
  const unclaimed = isUnclaimed(profile);
  // A bar whose page keeps its specs back (unclaimed, or not open): names, a lock, and why.
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const specsLocked = !person && pageLocksSpecs(profile.page_visibility, onTeam);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  // What they said they do, or the job they picked; never a label we made up.
  const line = profileLine(profile, useProfilePositions(person ? profile : null).data ?? []);

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={person ? styles.header : styles.barHead}>
        {person ? (
          <>
            <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={88} />
            <Title align="center">{profile.display_name}</Title>
            <Caption tone="muted" align="center">
              {[`@${profile.handle}`, place].filter(Boolean).join(' · ')}
            </Caption>
            {line ? <Body align="center">{line}</Body> : null}
          </>
        ) : (
          <BarHeader profile={profile} detail={[place || 'Bar', unclaimed ? 'Not claimed yet' : 'Claimed'].join(' · ')} />
        )}
        <View style={[styles.chips, !person && styles.chipsStart]}>
          {originals.length > 0 && person && showsMade ? <Tag label="Creator" /> : null}
          {onMenus && showsMade ? <Tag label={`Credited on ${onMenus} bar ${onMenus === 1 ? 'menu' : 'menus'}`} /> : null}
          {profile.is_closed ? <Tag label={profile.closed_year ? `Closed ${profile.closed_year}` : 'Closed'} /> : null}
          {unclaimed && person ? <Tag label="Not claimed yet" /> : null}
          {profile.is_public ? null : <Tag label="Private" />}
        </View>
        {profile.bio ? <Body align={person ? 'center' : undefined}>{profile.bio}</Body> : null}
        <ProfileLinks profile={profile} align={person ? 'center' : 'start'} />
      </View>

      {person ? (
        <Stats>
          {had.data?.length ? <Stat value={hadStat.drinks} label={hadStat.drinks === 1 ? 'drink had' : 'drinks had'} /> : null}
          {showsMade ? <Stat value={originals.length} label={originals.length === 1 ? 'original' : 'originals'} /> : null}
          {showsMade ? <Stat value={onMenus} label={onMenus === 1 ? 'bar menu' : 'bar menus'} /> : null}
        </Stats>
      ) : (
        <BarStats profile={profile} originals={originals.length} />
      )}

      {profile.kind === 'bar' ? <BarMatches barProfileId={profile.id} /> : null}

      {profile.kind === 'bar' ? <BarClassics barId={profile.bar_id} /> : null}

      <Awards profileId={profile.id} />

      {unclaimed && !specsLocked ? <ClaimProfile profile={profile} /> : null}

      {person ? <Positions profile={profile} /> : null}

      {profile.kind === 'person' ? <WorkedMenus profileId={profile.id} /> : null}

      {showsMade ? <MenuCredits credits={credits} names={names} /> : null}

      {had.data && (pinned.length || had.data.some((d) => d.sentiment === 'loved')) ? (
        <View style={styles.favourites}>
          <Headline role="heading">{pinned.length ? 'Top four' : 'Favourites'}</Headline>
          <Favourites drinks={had.data} picked={pinned} columns={columns} />
        </View>
      ) : null}

      {tab ? <Segmented accessibilityLabel="Profile sections" options={tabs} value={tab} onChange={setTab} /> : null}
      {mine && person && (tab === 'had' || tab === 'bars' || tab === 'originals') ? (
        <View style={styles.mine}>
          <Caption tone="muted" style={styles.flex}>This is what others see.</Caption>
          <Button label="Choose what shows" variant="ghost" onPress={() => router.push(`/settings/profile-picks?section=${tab}` as Href)} />
        </View>
      ) : null}
      {tab === 'had' || tab === 'bars' ? (
        <SharedDrinks
          name={profile.display_name}
          tab={tab}
          shared={(tab === 'had' ? profile.had_mode : profile.bars_mode) !== 'none'}
          signedIn={signedIn}
          drinks={had.data}
          bars={bars.data}
          failed={!!(tab === 'had' ? had.error : bars.error)}
        />
      ) : tab === 'originals' && !showsMade ? (
        <View style={styles.favourites}>
          <Body tone="muted">Only you see the drinks you’ve made here. Their credits still show on each drink’s own page. You can show them from your profile settings.</Body>
          <Button label="Profile settings" variant="ghost" onPress={() => router.push('/settings/profile')} style={styles.start} />
        </View>
      ) : tab === 'menus' ? (
        <MenuHistory profileId={profile.id} name={profile.display_name} />
      ) : tab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : specsLocked ? (
          <LockedOriginals
            originals={originals}
            selfId={profile.id}
            details={pageShowsDescriptions(profile.page_visibility)}
            emptyText="No drinks credited to this bar yet."
          />
        ) : (
          <OriginalsGrid
            originals={originals}
            selfId={profile.id}
            columns={columns}
            emptyText={profile.kind === 'bar' ? 'No drinks credited to this bar yet.' : 'No drinks credited to them yet.'}
          />
        )
      ) : tab === 'rankings' ? (
        <BarRankings bar={profile} />
      ) : (
        <Positions profile={profile} emptyText={`Nobody is listed at ${profile.display_name} yet.`} />
      )}
      {specsLocked ? (
        <SpecLockPanel
          note={specLockNote(profile.display_name, unclaimed, false)}
          action={unclaimed ? <ClaimProfile profile={profile} label="Work here? Claim this page" /> : null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  right: { flexDirection: 'row', gap: space.sm },
  body: { gap: space.xl },
  header: { alignItems: 'center', gap: space.sm },
  barHead: { gap: space.sm },
  chipsStart: { justifyContent: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  favourites: { gap: space.md },
  start: { alignSelf: 'flex-start' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
