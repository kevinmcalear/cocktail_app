import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, Segmented, Tag } from '@/components/ds';
import { BarWeekLine } from '@/components/screens/week/BarWeek';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarFacts } from '@/hooks/useBarFacts';
import { isUnclaimed, useMenuCredits, useMenuEditions, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { drinkRunTags } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';
import { pageLocksSpecs, pageShowsDescriptions, pageShowsDrinks, privatePageNote, specLockNote } from '@/lib/pageVisibility';

import { barPlace } from '../bar/BarFactLines';
import { OnTheMenu } from '../bar/OnTheMenu';
import { SpecLockPanel } from '../drink/SpecLockPanel';
import { BarClassics } from './BarClassics';
import { usePouredSplit } from './ClassicsTheyPour';
import { BarMatches } from './BarMatches';
import { BarRankings, BestHere } from './BarRankings';
import { BarFactsList, BarYours, useYouHere } from './BarYours';
import { Awards, MenuHistory } from './BarRecord';
import { LockedOriginals } from './LockedOriginals';
import { MenuNow } from './MenuNow';
import { Positions } from './Positions';
import { BarHeader, MenuCredits, OriginalsGrid, useBarNumbers } from './ProfileSections';
import { PublicBarFacts } from './PublicBarFacts';
import { BarClaimCard, ClaimLine } from './BarClaimCard';
import { SeeYourName } from './SeeYourName';

export type BarTab = 'drinks' | 'rankings' | 'menus' | 'people';
/** Originals shown before "All 12 originals". */
const FIRST_ORIGINALS = 4;
/** "On the menu now" rows before "All 12 on Field Notes" (Q30 A). */
export const FIRST_ON_NOW = 3;

/** A bar page's tabs on a phone, signed in or out: drinks first (Q30 A, approved 26 Oct 2026). */
export const BAR_TABS = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'rankings', label: 'Top drinks' },
  { value: 'menus', label: 'Past menus' },
  { value: 'people', label: 'People' },
] as const;
export const PEOPLE_ONLY = BAR_TABS.filter((t) => t.value === 'people');

/**
 * A bar's page on a phone, signed in (w2-bar-pages Q30 A and Q33 B, over
 * ppl-bar-top, -menus, -originals, -unclaimed): who it is with its numbers on
 * one line, "See your name?" for the likely person, hours and location, This
 * week as one line, then Drinks, Top drinks, Past menus and People as tabs.
 * Drinks opens first: on the menu now, best here by score, then its own
 * drinks and the classics it pours. A page that keeps its specs back
 * (unclaimed, or not open) shows names, a lock, and why. The claim prompts
 * end the page in one quiet line (and sit in More). Wider screens get the
 * drawn desktop page (PublicBarPage signed in).
 */
export function BarProfile({ profile, columns }: { profile: Profile; columns: number }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; tab?: string }>();
  const [tab, setTab] = useState<BarTab>('drinks');
  // More's "Worked here?" opens People (?tab=people), once.
  if (params.tab === 'people' && tab !== 'people') setTab('people');
  useEffect(() => {
    if (params.tab) router.setParams({ tab: undefined });
  }, [params.tab, router]);
  const [allOriginals, setAllOriginals] = useState(false);
  const facts = useBarFacts(profile.id).data;
  const here = useYouHere(profile.id);
  const runs = drinkRunTags(useMenuEditions(profile.id).data ?? []);
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id, { locked: profile.page_visibility === 'locked' });
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  // Copies poured as a classic aren't originals: the count and "All N originals" count the bar's own.
  const { poured, own } = usePouredSplit(profile.id, originals);
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const unclaimed = isUnclaimed(profile);
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const specsLocked = pageLocksSpecs(profile.page_visibility, onTeam);
  // Private: facts, hours, people and awards; no drinks, menus or scores (ppl-bar-private).
  const drinksShown = pageShowsDrinks(profile.page_visibility, onTeam);
  const shownTab: BarTab = drinksShown ? tab : 'people';
  const details = pageShowsDescriptions(profile.page_visibility);
  // The neighbourhood, else the city: "Cocktail bar · Fitzroy" (ppl-bar-top).
  const place = profile.locality || profile.city;
  const searched = !!params.q;
  const numbers = useBarNumbers(profile, drinksShown ? own.length : null);

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <BarHeader
        profile={profile}
        detail={[barPlace(facts?.bar_type, place) || 'Bar', here.count ? `you’ve had ${plural(here.count, 'drink')} here` : null].filter(Boolean).join(' · ')}
        numbers={numbers}
        tagInline={unclaimed}
        // Opened from a search: the facts and actions, then straight into what matched (disc-search-bar).
        tag={
          searched ? null : (
            <View style={styles.chips}>
              <Tag label={unclaimed ? 'Not claimed yet' : 'Claimed'} tone={unclaimed ? 'default' : 'outline'} />
              {profile.is_closed ? <Tag label={profile.closed_year ? `Closed ${profile.closed_year}` : 'Closed'} tone="outline" /> : null}
              {profile.is_public ? null : <Tag label="Private" tone="outline" />}
            </View>
          )
        }
      />
      {/* Your name may be on its drinks: the credits open your page (find-yourself), for the likely person only (Q33). */}
      <SeeYourName bar={profile} originals={originals} card />
      {/* Opened from Setup's Find your bar, or a claim on its way (owner-setup call 3). */}
      <BarClaimCard profile={profile} />
      {/* Hours, the address and Instagram, then Directions, Call and Website three across (b32: claimed or not), and where the hours came from. */}
      <PublicBarFacts profileId={profile.id} instagram={profile.instagram} />

      {/* A search's matches (nothing without one) come right under the header. */}
      <BarMatches barProfileId={profile.id} />
      {/* Opened from a search, the menu it's pouring follows the matches (disc-search-bar); the plain page has it at the top of Drinks. */}
      {searched ? <OnTheMenu profileId={profile.id} /> : null}

      <BarWeekLine barId={profile.bar_id} profileId={profile.id} barName={profile.display_name} />

      <Segmented accessibilityLabel="Bar sections" stretch accent options={drinksShown ? BAR_TABS : PEOPLE_ONLY} value={shownTab} onChange={setTab} />
      {shownTab === 'drinks' ? (
        <View style={styles.tab}>
          {searched ? null : <MenuNow profileId={profile.id} originals={originals} details={details} first={FIRST_ON_NOW} locked={specsLocked} />}
          <BestHere barId={profile.id} />
          {/* Its own drinks and the classics it pours, under Best here (Q30 A: the Originals tab folds in). */}
          <View style={styles.section}>
            <Headline role="heading">Their drinks</Headline>
            {isLoading ? (
              <Caption tone="muted">Loading drinks…</Caption>
            ) : specsLocked ? (
              <LockedOriginals originals={originals} selfId={profile.id} details={details} runs={runs} emptyText="No drinks credited to this bar yet." />
            ) : (
              <>
                <OriginalsGrid
                  originals={allOriginals ? originals : [...poured, ...own.slice(0, FIRST_ORIGINALS)]}
                  selfId={profile.id}
                  columns={columns}
                  layout="rows"
                  ownerName={profile.display_name}
                  runs={runs}
                  emptyText="No drinks credited to this bar yet."
                />
                {own.length > FIRST_ORIGINALS && !allOriginals ? (
                  <Button label={`All ${own.length} originals`} variant="secondary" onPress={() => setAllOriginals(true)} style={styles.start} />
                ) : null}
              </>
            )}
          </View>
          {specsLocked ? null : <BarClassics barId={profile.bar_id} />}
          {specsLocked ? null : <MenuCredits credits={credits} names={names} />}
        </View>
      ) : shownTab === 'rankings' ? (
        <View style={styles.tab}>
          <BarYours profileId={profile.id} drinkIds={originals.map((d) => d.id)} />
          <BarRankings bar={profile} />
        </View>
      ) : shownTab === 'menus' ? (
        <MenuHistory profileId={profile.id} name={profile.display_name} />
      ) : (
        <View style={styles.tab}>
          <Positions profile={profile} emptyText={`Nobody is listed at ${profile.display_name} yet.`} />
          {/* The bar's facts and awards, which sat above the tabs before drinks came first. */}
          <BarFactsList profile={profile} />
          <Awards profileId={profile.id} />
        </View>
      )}
      {!drinksShown ? (
        <SpecLockPanel title="Drinks stay with the bar" note={privatePageNote(profile.display_name, true)} />
      ) : specsLocked ? (
        <SpecLockPanel note={specLockNote(profile.display_name, unclaimed, false)} />
      ) : null}
      {/* The claim prompts, quietly, at the very end (Q33 B); also in More. */}
      <ClaimLine profile={profile} onFind={() => setTab('people')} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg + space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tab: { gap: space.xl },
  section: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
