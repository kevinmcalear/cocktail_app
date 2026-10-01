import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, DsText, GlassButton, Headline, Segmented, Tag, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyProfile } from '@/hooks/useMyProfile';
import { isUnclaimed, useMenuCredits, useProfile, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { useProfileDrinks } from '@/hooks/useRankings';
import { hadStats } from '@/lib/hadDrinks';
import { barsCrediting, profileLinks } from '@/lib/profiles';

import { BlockedProfileNote, ProfileSafety } from '../safety/ProfileSafety';
import { BarClassics } from './BarClassics';
import { Awards, MenuHistory } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { Favourites, SharedDrinks } from './HadDrinks';
import { Positions } from './Positions';
import { BarScore, ComingSoon, MenuCredits, OriginalsGrid, Stat, Stats } from './ProfileSections';

type Tab = 'menus' | 'originals' | 'rankings' | 'shelf' | 'had' | 'bars';
/** A person's page has the drinks they've had and how each bar did. */
const PERSON_TABS = [
  { value: 'had', label: 'Had' },
  { value: 'bars', label: 'Bars' },
  { value: 'originals', label: 'Originals' },
  { value: 'shelf', label: 'Shelf' },
] as const;
/** Someone who keeps their drinks to themselves, or a profile nobody has claimed (a historic bartender). */
const QUIET_TABS = PERSON_TABS.filter((t) => t.value !== 'had' && t.value !== 'bars');
/** A bar's page leads with its menus. */
const BAR_TABS = [
  { value: 'menus', label: 'Menus' },
  { value: 'originals', label: 'Originals' },
  { value: 'rankings', label: 'Rankings' },
  { value: 'shelf', label: 'Shelf' },
] as const;

/**
 * A public profile: a person or a bar, the same kind of page. Who they are,
 * the drinks credited to them, and the bars that put those drinks on a menu
 * (the credit that matters most). A person who chooses to can show the
 * drinks they've had, with their scores. The shelf comes later.
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
  const { data: profile, isLoading, error } = useProfile(profileRef);

  const controls = (
    <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
      <GlassButton
        accessibilityLabel="Back"
        icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      {profile ? <ProfileSafety profile={profile} /> : null}
    </View>
  );

  let body;
  if (profile) body = <ProfileBody profile={profile} columns={breakpoint === 'phone' ? 2 : breakpoint === 'tablet' ? 3 : 4} />;
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

const KIND: Record<Profile['kind'], string> = { person: 'Bartender', bar: 'Bar' };

function ProfileBody({ profile, columns }: { profile: Profile; columns: number }) {
  const person = profile.kind === 'person';
  const [tab, setTab] = useState<Tab>(!person ? 'menus' : profile.shares_rankings ? 'had' : 'originals');
  const signedIn = !!useAuth().user;
  const mine = useMyProfile().data?.id === profile.id;
  const had = useProfileDrinks(profile.id, person && profile.shares_rankings);
  const hadStat = hadStats(had.data ?? []);
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id);
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const onMenus = barsCrediting(credits);
  const unclaimed = isUnclaimed(profile);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  const links = profileLinks(profile);

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.header}>
        <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={88} />
        <Title align="center">{profile.display_name}</Title>
        <Caption tone="muted" align="center">
          {[`@${profile.handle}`, KIND[profile.kind], place].filter(Boolean).join(' · ')}
        </Caption>
        <View style={styles.chips}>
          {originals.length > 0 && profile.kind === 'person' ? <Tag label="Creator" /> : null}
          {onMenus ? <Tag label={`Credited on ${onMenus} bar ${onMenus === 1 ? 'menu' : 'menus'}`} /> : null}
          {profile.is_closed ? <Tag label={profile.closed_year ? `Closed ${profile.closed_year}` : 'Closed'} /> : null}
          {unclaimed ? <Tag label="Not claimed yet" /> : null}
          {profile.is_public ? null : <Tag label="Private" />}
        </View>
        {profile.bio ? <Body align="center">{profile.bio}</Body> : null}
        {links.map((link) => (
          <DsText key={link.href} variant="caption" role="link" style={styles.link} onPress={() => Linking.openURL(link.href)}>
            {link.label}
          </DsText>
        ))}
      </View>

      <Stats>
        {had.data?.length ? <Stat value={hadStat.drinks} label={hadStat.drinks === 1 ? 'drink had' : 'drinks had'} /> : null}
        <Stat value={originals.length} label={originals.length === 1 ? 'original' : 'originals'} />
        <Stat value={onMenus} label={onMenus === 1 ? 'bar menu' : 'bar menus'} />
      </Stats>

      {profile.kind === 'bar' ? <BarScore profileId={profile.id} /> : null}
      {profile.kind === 'bar' ? <BarClassics barId={profile.bar_id} /> : null}

      <Awards profileId={profile.id} />

      {unclaimed ? <ClaimProfile profile={profile} /> : null}

      <Positions profile={profile} />

      <MenuCredits credits={credits} names={names} />

      {had.data?.some((d) => d.sentiment === 'loved') ? (
        <View style={styles.favourites}>
          <Headline role="heading">Favourites</Headline>
          <Favourites drinks={had.data} columns={columns} />
        </View>
      ) : null}

      <Segmented accessibilityLabel="Profile sections" options={!person ? BAR_TABS : profile.shares_rankings || mine ? PERSON_TABS : QUIET_TABS} value={tab} onChange={setTab} />
      {tab === 'had' || tab === 'bars' ? (
        <SharedDrinks name={profile.display_name} tab={tab} shared={profile.shares_rankings} signedIn={signedIn} drinks={had.data} failed={!!had.error} />
      ) : tab === 'menus' ? (
        <MenuHistory profileId={profile.id} name={profile.display_name} />
      ) : tab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : (
          <OriginalsGrid
            originals={originals}
            selfId={profile.id}
            columns={columns}
            emptyText={profile.kind === 'bar' ? 'No drinks credited to this bar yet.' : 'No drinks credited to them yet.'}
          />
        )
      ) : tab === 'rankings' ? (
        <ComingSoon text={`${profile.display_name}'s rankings will show here once ranking opens.`} />
      ) : (
        <ComingSoon text={profile.kind === 'bar' ? "What's on the back bar will show here." : "What's on their shelf will show here."} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  body: { gap: space.xl },
  header: { alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  link: { textDecorationLine: 'underline' },
  favourites: { gap: space.md },
});
