import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, useBreakpoint } from '@/components/ds';
import { BarWeek } from '@/components/screens/week/BarWeek';
import { space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { usePublicClassics } from '@/hooks/useStaffList';
import { isUnclaimed, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { pageLocksSpecs, pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';
import { instagramUrl } from '@/lib/profiles';
import { shareLink } from '@/lib/shareLink';
import { siteOrigin } from '@/lib/venueLink';

import { SpecLockPanel } from '../drink/SpecLockPanel';
import { Kicker, SignInBand } from '../published/PublicChrome';
import { PublicPage } from '../published/PublicShell';
import { ProfileSafety } from '../safety/ProfileSafety';
import { BarRankings } from './BarRankings';
import { Awards, MenuHistory } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { ClassicsTheyPour } from './ClassicsTheyPour';
import { LockedOriginals } from './LockedOriginals';
import { Positions } from './Positions';
import { PublicBarFacts } from './PublicBarFacts';
import { BarHeader, OriginalsGrid } from './ProfileSections';

/**
 * A bar's page signed out (ppl-pub-bar-desktop, -phone): one page, no tabs.
 * Wide: Top drinks, Their drinks and Classics they pour beside hours and
 * location, menus, people and awards. Phone: the same in one column, hours
 * first. Love asks to sign in; the sign-in band closes it.
 */
export function PublicBarPage({ profile }: { profile: Profile }) {
  const wide = useBreakpoint() !== 'phone';
  const { data: facts } = useBarFacts(profile.id);
  const locked = profile.page_visibility === 'locked';
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id, { locked });
  const unclaimed = isUnclaimed(profile);
  const specsLocked = pageLocksSpecs(profile.page_visibility, false);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  const detail = [facts?.bar_type ?? 'Bar', place, unclaimed ? 'Not claimed yet' : 'Claimed'].filter(Boolean).join(' · ');

  const section = (title: string, body: React.ReactNode, kicker = false) => (
    <View style={styles.section}>
      {kicker ? <Kicker>{title}</Kicker> : <Headline role="heading">{title}</Headline>}
      {body}
    </View>
  );
  const theirDrinks = section(
    'Their drinks',
    isLoading ? (
      <Caption tone="muted">Loading drinks…</Caption>
    ) : specsLocked ? (
      <LockedOriginals originals={originals} selfId={profile.id} details={pageShowsDescriptions(profile.page_visibility)} emptyText="No drinks credited to this bar yet." />
    ) : (
      <OriginalsGrid originals={originals} selfId={profile.id} columns={1} layout="rows" ownerName={profile.display_name} emptyText="No drinks credited to this bar yet." />
    ),
  );
  const main = (
    <>
      {section('Top drinks', <BarRankings bar={profile} />)}
      {theirDrinks}
      {originals.some((d) => d.riff_of_id) ? null : <StaffClassics barId={profile.bar_id} barName={profile.display_name} />}
    </>
  );
  const facts_ = <PublicBarFacts profileId={profile.id} />;
  const week = <BarWeek barId={profile.bar_id} profileId={profile.id} barName={profile.display_name} />;
  const menus = section('Menus', <MenuHistory profileId={profile.id} name={profile.display_name} />, true);
  const people = section('People', <Positions profile={profile} emptyText={`Nobody is listed at ${profile.display_name} yet.`} />, true);
  const awards = <Awards profileId={profile.id} />;

  return (
    <PublicPage title={`${profile.display_name} (@${profile.handle})`}>
      <View style={styles.head}>
        <BarHeader profile={profile} detail={detail} />
        {wide ? null : facts_}
        <HeaderActions profile={profile} />
      </View>
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.main}>{main}</View>
          <View style={styles.aside}>
            {facts_}
            {week}
            {menus}
            {people}
            {awards}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {menus}
          {week}
          {main}
          {people}
          {awards}
        </View>
      )}
      {specsLocked ? (
        <SpecLockPanel note={specLockNote(profile.display_name, unclaimed, false)} action={unclaimed ? <ClaimProfile profile={profile} label="Work here? Claim this page" /> : null} />
      ) : unclaimed ? (
        <ClaimProfile profile={profile} />
      ) : null}
      <SignInBand text="Tap any drink to see more. Sign in to rank what you had here and love the bar." />
    </PublicPage>
  );
}

/**
 * The bar's staff list as the board draws Classics they pour: a line of
 * pills in their order, the first few then All. Used when none of its own
 * drinks are versions of a classic (those already show as pills).
 */
function StaffClassics({ barId, barName }: { barId: string | null; barName: string }) {
  const { data = [] } = usePublicClassics(barId);
  const drinks = data.filter((c) => c.openId).map((c) => ({ id: c.openId!, name: c.name }));
  return <ClassicsTheyPour drinks={drinks} barName={barName} />;
}

/** Love (asks to sign in), Share and Instagram, under the bar's name; report and block at the end. */
function HeaderActions({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      setCopied((await shareLink(`${siteOrigin()}/p/${profile.handle}`, profile.display_name)) === 'copied');
    } catch {
      setCopied(false);
    }
  };
  return (
    <View style={styles.actions}>
      <Button label="Love" icon="heart" variant="secondary" accessibilityHint={`Sign in to love ${profile.display_name}`} onPress={() => router.push('/auth/login')} />
      <Button label={copied ? 'Link copied' : 'Share'} icon="square.and.arrow.up" variant="secondary" onPress={() => void share()} />
      {profile.instagram ? (
        <Button
          label="Instagram"
          icon="link"
          variant="secondary"
          accessibilityLabel={`${profile.display_name} on Instagram, opens in a new tab`}
          onPress={() => void Linking.openURL(instagramUrl(profile.instagram!))}
        />
      ) : null}
      <ProfileSafety profile={profile} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.xxl + space.sm },
  main: { flexGrow: 3, flexShrink: 1, flexBasis: 480, minWidth: 0, gap: space.xxl },
  aside: { flexGrow: 2, flexShrink: 1, flexBasis: 320, minWidth: 0, maxWidth: 420, gap: space.xxl },
  stack: { gap: space.xxl },
  section: { gap: space.md },
});
