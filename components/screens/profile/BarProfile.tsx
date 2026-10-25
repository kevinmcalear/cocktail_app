import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Segmented, Tag } from '@/components/ds';
import { BarWeek } from '@/components/screens/week/BarWeek';
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
import { BarRankings } from './BarRankings';
import { BarFactsList, BarYours, useYouHere } from './BarYours';
import { Awards, MenuHistory } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { LockedOriginals } from './LockedOriginals';
import { MenuNow } from './MenuNow';
import { Positions } from './Positions';
import { BarHeader, BarStats, MenuCredits, OriginalsGrid } from './ProfileSections';
import { PublicBarFacts } from './PublicBarFacts';
import { SeeYourName } from './SeeYourName';

export type BarTab = 'menus' | 'originals' | 'rankings' | 'people';
/** A bar's page leads with its menus. */
/** Originals shown before "All 12 originals". */
const FIRST_ORIGINALS = 4;

/** A bar page's tabs on a phone, signed in or out (p01). */
export const BAR_TABS = [
  { value: 'menus', label: 'Menus' },
  { value: 'originals', label: 'Originals' },
  { value: 'rankings', label: 'Top drinks' },
  { value: 'people', label: 'People' },
] as const;
export const PEOPLE_ONLY = BAR_TABS.filter((t) => t.value === 'people');

/**
 * A bar's page on a phone, signed in (ppl-bar-top, -menus, -originals,
 * -unclaimed): who it is, hours and location, what matches a search, its
 * numbers between two rules, its facts (Opened, Awards), This week, then Menus,
 * Originals, Top drinks and People as tabs. A page that keeps its specs back
 * (unclaimed, or not open) shows names, a lock, and why. Wider screens get
 * the drawn desktop page (PublicBarPage signed in).
 */
export function BarProfile({ profile, columns }: { profile: Profile; columns: number }) {
  const [tab, setTab] = useState<BarTab>('menus');
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [allOriginals, setAllOriginals] = useState(false);
  const facts = useBarFacts(profile.id).data;
  const here = useYouHere(profile.id);
  const runs = drinkRunTags(useMenuEditions(profile.id).data ?? []);
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id, { locked: profile.page_visibility === 'locked' });
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  // Copies poured as a classic aren't originals: the stat and "All N originals" count the bar's own.
  const { poured, own } = usePouredSplit(profile.id, originals);
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const unclaimed = isUnclaimed(profile);
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const specsLocked = pageLocksSpecs(profile.page_visibility, onTeam);
  // Private: facts, hours, people and awards; no drinks, menus or scores (ppl-bar-private).
  const drinksShown = pageShowsDrinks(profile.page_visibility, onTeam);
  const shownTab: BarTab = drinksShown ? tab : 'people';
  // The neighbourhood, else the city: "Cocktail bar · Fitzroy" (ppl-bar-top).
  const place = profile.locality || profile.city;
  const searched = !!useLocalSearchParams<{ q?: string }>().q;

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <BarHeader
        profile={profile}
        detail={[barPlace(facts?.bar_type, place) || 'Bar', here.count ? `you’ve had ${plural(here.count, 'drink')} here` : null].filter(Boolean).join(' · ')}
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
      {/* Your name may be on its drinks: the credits below open your page (find-yourself). */}
      <SeeYourName profile={profile} />
      {/* Hours, the address and Instagram, then Directions, Call and Website three across (b32: claimed or not), and where the hours came from. */}
      <PublicBarFacts profileId={profile.id} instagram={profile.instagram} />

      {/* A search's matches (nothing without one) come right under the header. */}
      <BarMatches barProfileId={profile.id} />
      {/* Opened from a search, the menu it's pouring follows the matches (disc-search-bar); the plain page has it under Menus (ppl-bar-menus). */}
      {searched ? <OnTheMenu profileId={profile.id} /> : null}

      <BarStats profile={profile} originals={drinksShown ? own.length : null} onAwards={() => setAwardsOpen((v) => !v)} />

      {awardsOpen ? <Awards profileId={profile.id} /> : null}

      <BarFactsList profile={profile} />

      {unclaimed && !specsLocked ? <ClaimProfile profile={profile} /> : null}

      <BarWeek barId={profile.bar_id} profileId={profile.id} barName={profile.display_name} />

      <Segmented accessibilityLabel="Bar sections" stretch accent options={drinksShown ? BAR_TABS : PEOPLE_ONLY} value={shownTab} onChange={setTab} />
      {shownTab === 'menus' ? (
        <View style={styles.tab}>
          {/* The menu on now, each drink with who made it, while the specs stay with the bar (find-yourself). */}
          {specsLocked ? <MenuNow profileId={profile.id} originals={originals} details={pageShowsDescriptions(profile.page_visibility)} /> : null}
          <MenuHistory profileId={profile.id} name={profile.display_name} />
        </View>
      ) : shownTab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : specsLocked ? (
          <LockedOriginals originals={originals} selfId={profile.id} details={pageShowsDescriptions(profile.page_visibility)} runs={runs} emptyText="No drinks credited to this bar yet." />
        ) : (
          <View style={styles.tab}>
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
            {/* Classics they pour sit with the originals now, not above the tabs (ppl-bar-originals). */}
            <BarClassics barId={profile.bar_id} />
            <MenuCredits credits={credits} names={names} />
          </View>
        )
      ) : shownTab === 'rankings' ? (
        <View style={styles.tab}>
          <BarYours profileId={profile.id} drinkIds={originals.map((d) => d.id)} />
          <BarRankings bar={profile} />
        </View>
      ) : (
        <Positions profile={profile} emptyText={`Nobody is listed at ${profile.display_name} yet.`} />
      )}
      {!drinksShown ? (
        <SpecLockPanel title="Drinks stay with the bar" note={privatePageNote(profile.display_name, true)} />
      ) : specsLocked ? (
        <SpecLockPanel
          note={specLockNote(profile.display_name, unclaimed, false)}
          action={unclaimed ? <ClaimProfile profile={profile} label="Work here? Claim this page" /> : null}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg + space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tab: { gap: space.lg },
  start: { alignSelf: 'flex-start' },
});
