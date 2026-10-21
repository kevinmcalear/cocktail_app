import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, useBreakpoint } from '@/components/ds';
import { BarWeek } from '@/components/screens/week/BarWeek';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useBarFacts } from '@/hooks/useBarFacts';
import { useItemScores } from '@/hooks/useFlavor';
import { usePublicClassics } from '@/hooks/useStaffList';
import { isUnclaimed, useMenuCredits, useMenuEditions, useProfileAwards, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { sortAwards } from '@/lib/awards';
import { drinkRunTags } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';
import { pageLocksSpecs, pageShowsDescriptions, pageShowsDrinks, privatePageNote, specLockNote } from '@/lib/pageVisibility';
import { useActiveVenue } from '@/hooks/useActiveVenue';

import { barPlace } from '../bar/BarFactLines';
import { OnTheMenu } from '../bar/OnTheMenu';
import { SpecLockPanel } from '../drink/SpecLockPanel';
import { Kicker, SignInBand } from '../published/PublicChrome';
import { PublicPage } from '../published/PublicShell';
import { BarMatches } from './BarMatches';
import { BarRankings } from './BarRankings';
import { BarYours, useYouHere } from './BarYours';
import { ClaimProfile } from './ClaimProfile';
import { ClassicsTheyPour } from './ClassicsTheyPour';
import { LockedOriginals } from './LockedOriginals';
import { Positions } from './Positions';
import { PublicBarActions, PublicBarHeader } from './PublicBarHeader';
import { PublicBarFacts } from './PublicBarFacts';
import { MenuNow } from './MenuNow';
import { SeeYourName } from './SeeYourName';
import { PublicMenus } from './PublicMenus';
import { MenuCredits, OriginalsGrid } from './ProfileSections';

/** Their drinks shown before "All 12 originals". */
const FIRST_ORIGINALS = 2;
/** Award lines shown before "Show all". */
const FIRST_AWARDS = 4;

/**
 * A bar's page signed out (ppl-pub-bar-desktop, -phone): one page, no tabs.
 * Wide: Top drinks, Their drinks and Classics they pour beside hours,
 * location and Instagram, This week, menus, people and awards. Phone: hours and the
 * actions under the name, then This week, Menus, Top drinks, Their drinks,
 * Classics they pour and People. Love and Report ask to sign in; the
 * sign-in band closes it.
 * `signedIn`: the same desktop page inside the app (ppl-pub-bar-desktop is the
 * only desktop bar page drawn): no site nav or sign-in band, Love and Report
 * work, your drinks here over Top drinks, a search's matches under the name.
 * A phone signed in has its own page with tabs (BarProfile).
 */
export function PublicBarPage({ profile, signedIn = false }: { profile: Profile; signedIn?: boolean }) {
  const wide = useBreakpoint() !== 'phone';
  const here = useYouHere(profile.id);
  const searched = !!useLocalSearchParams<{ q?: string }>().q;
  const { data: facts } = useBarFacts(profile.id);
  const locked = profile.page_visibility === 'locked';
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id, { locked });
  const runs = drinkRunTags(useMenuEditions(profile.id).data ?? []);
  const { data: credits = [] } = useMenuCredits(signedIn ? originals.map((d) => d.id) : []);
  const [allOriginals, setAllOriginals] = useState(false);
  const unclaimed = isUnclaimed(profile);
  const specsLocked = pageLocksSpecs(profile.page_visibility, false);
  // Private: facts, hours, people and awards; no drinks, menus or scores (ppl-bar-private).
  const drinksShown = pageShowsDrinks(profile.page_visibility, useActiveVenue().venues.some((v) => v.id === profile.bar_id));
  const place = [barPlace(facts?.bar_type ?? 'Bar', [profile.locality, profile.city].filter(Boolean).join(', ')), signedIn && here.count ? `you’ve had ${plural(here.count, 'drink')} here` : null].filter(Boolean).join(' · ');

  const section = (title: string, body: ReactNode, kicker = false) => (
    <View style={styles.section}>
      {kicker ? <Kicker>{title}</Kicker> : <Headline role="heading">{title}</Headline>}
      {body}
    </View>
  );
  const shown = allOriginals ? originals : originals.slice(0, FIRST_ORIGINALS);
  const drinksSection = section(
    'Their drinks',
    isLoading ? (
      <Caption tone="muted">Loading drinks…</Caption>
    ) : (
      <>
        {specsLocked ? (
          <LockedOriginals originals={shown} selfId={profile.id} details={pageShowsDescriptions(profile.page_visibility)} runs={runs} quiet={!signedIn} emptyText="No drinks credited to this bar yet." />
        ) : (
          <OriginalsGrid originals={shown} selfId={profile.id} columns={1} layout="rows" ownerName={profile.display_name} runs={runs} emptyText="No drinks credited to this bar yet." />
        )}
        {originals.length > FIRST_ORIGINALS && !allOriginals ? (
          <Button label={`All ${originals.length} originals`} variant="secondary" onPress={() => setAllOriginals(true)} style={styles.start} />
        ) : null}
      </>
    ),
  );
  const theirDrinks = drinksShown ? drinksSection : null;
  const classics = !drinksShown || originals.some((d) => d.riff_of_id) ? null : <StaffClassics barId={profile.bar_id} />;
  const facts_ = <PublicBarFacts profileId={profile.id} instagram={profile.instagram} />;
  const week = <BarWeek barId={profile.bar_id} profileId={profile.id} barName={profile.display_name} />;
  const menus = drinksShown ? section('Menus', <PublicMenus profileId={profile.id} name={profile.display_name} />, wide) : null;
  const people = section('People', <Positions profile={profile} currentUntitled emptyText={`Nobody is listed at ${profile.display_name} yet.`} />, true);
  const awards = <PublicAwards profileId={profile.id} />;
  const topSection = section(
    'Top drinks',
    <>
      {signedIn ? <BarYours profileId={profile.id} drinkIds={originals.map((d) => d.id)} /> : null}
      <BarRankings bar={profile} />
    </>,
  );
  // Why the specs are kept back, with Claim: in the main column under the drinks it explains (ppl-bar-unclaimed).
  const top = drinksShown ? topSection : null;
  const lock = !drinksShown ? (
    <SpecLockPanel title="Drinks stay with the bar" note={privatePageNote(profile.display_name, signedIn)} />
  ) : specsLocked ? (
    <SpecLockPanel note={specLockNote(profile.display_name, unclaimed, false)} action={unclaimed ? <ClaimProfile profile={profile} label="Work here? Claim this page" /> : null} />
  ) : unclaimed ? (
    <ClaimProfile profile={profile} />
  ) : null;
  const body = (
    <>
      <View style={styles.head}>
        <PublicBarHeader profile={profile} place={place} claimed={unclaimed ? 'Not claimed yet' : 'Claimed'} />
        {wide ? null : facts_}
        <PublicBarActions profile={profile} signedIn={signedIn} />
      </View>
      {signedIn ? <SeeYourName profile={profile} /> : null}
      {signedIn ? <BarMatches barProfileId={profile.id} /> : null}
      {/* Opened from a search: the menu it's pouring follows the matches (disc-search-bar). */}
      {signedIn && searched ? <OnTheMenu profileId={profile.id} /> : null}
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.main}>
            {/* Signed in, the menu on now leads, each drink with who made it (find-yourself). */}
            {signedIn && specsLocked && drinksShown ? <MenuNow profileId={profile.id} originals={originals} details={pageShowsDescriptions(profile.page_visibility)} /> : null}
            {top}
            {theirDrinks}
            {classics}
            {lock}
            {signedIn ? <MenuCredits credits={credits} names={new Map(originals.map((d) => [d.id, d.name]))} /> : null}
          </View>
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
          {week}
          {menus}
          {top}
          {theirDrinks}
          {classics}
          {lock}
          {people}
          {awards}
        </View>
      )}
    </>
  );
  if (signedIn)
    return (
      <View style={styles.page}>
        <WebHead>
          <title>{`${profile.display_name} (@${profile.handle})`}</title>
        </WebHead>
        {body}
      </View>
    );

  return (
    <PublicPage title={`${profile.display_name} (@${profile.handle})`}>
      {body}
      <SignInBand text={wide ? 'Tap any drink to see more. Sign in to rank what you had here and love the bar.' : 'Sign in to rank what you had here and love the bar.'} />
    </PublicPage>
  );
}

/**
 * The bar's staff list as Classics they pour: a card of names in their
 * order, with scores where the bar's own pour has a page, the first few then
 * All. Used when none of its own drinks are versions of a classic (those
 * already show in Their drinks).
 */
function StaffClassics({ barId }: { barId: string | null }) {
  const { data = [] } = usePublicClassics(barId);
  const drinks = data.map((c) => ({ id: c.openId, name: c.name }));
  const { data: scores } = useItemScores(drinks.flatMap((d) => (d.id ? [d.id] : [])));
  return <ClassicsTheyPour drinks={drinks} scores={scores} note="From the staff list, with their bottles." />;
}

/** Awards as plain lines, newest first: "City Bar Awards 2025 · No. 3". */
function PublicAwards({ profileId }: { profileId: string }) {
  const [all, setAll] = useState(false);
  const { data = [] } = useProfileAwards(profileId);
  if (!data.length) return null;
  const lines = sortAwards(data).map((a) => ({ id: a.id, text: `${a.award} ${a.year} · ${[a.position !== null ? `No. ${a.position}` : null, a.title].filter(Boolean).join(', ')}` }));
  return (
    <View style={styles.section}>
      <Kicker>Awards</Kicker>
      <View role="list" style={styles.lines}>
        {(all ? lines : lines.slice(0, FIRST_AWARDS)).map((l) => (
          <Body key={l.id} role="listitem">
            {l.text}
          </Body>
        ))}
      </View>
      {lines.length > FIRST_AWARDS && !all ? <Button label={`Show all ${lines.length} awards`} variant="secondary" onPress={() => setAll(true)} style={styles.start} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xxl },
  head: { gap: space.lg },
  columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.xxl + space.sm },
  main: { flexGrow: 3, flexShrink: 1, flexBasis: 480, minWidth: 0, gap: space.xl + space.xs },
  aside: { flexGrow: 2, flexShrink: 1, flexBasis: 320, minWidth: 0, maxWidth: 420, gap: space.xl },
  stack: { gap: space.xl },
  section: { gap: space.sm },
  lines: { gap: space.xs },
  start: { alignSelf: 'flex-start', marginTop: space.sm },
});
