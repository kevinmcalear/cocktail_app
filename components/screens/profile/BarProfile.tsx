import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Segmented, Tag } from '@/components/ds';
import { BarWeek } from '@/components/screens/week/BarWeek';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarFacts } from '@/hooks/useBarFacts';
import { isUnclaimed, useMenuCredits, useMenuEditions, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { hoursSource } from '@/lib/barHours';
import { drinkRunTags } from '@/lib/menuEditions';
import { plural } from '@/lib/menus';
import { pageLocksSpecs, pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';

import { barPlace } from '../bar/BarFactLines';
import { BarFactsBlock } from '../bar/BarFactsBlock';
import { OnTheMenu } from '../bar/OnTheMenu';
import { SpecLockPanel } from '../drink/SpecLockPanel';
import { LoveBarButton } from '../kept/LoveBarButton';
import { BarClassics } from './BarClassics';
import { BarMatches } from './BarMatches';
import { BarRankings } from './BarRankings';
import { BarFactsList, BarYours, useYouHere } from './BarYours';
import { Awards, MenuHistory } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { LockedOriginals } from './LockedOriginals';
import { Positions } from './Positions';
import { ProfileLinks } from './ProfileLinks';
import { BarHeader, BarStats, MenuCredits, OriginalsGrid } from './ProfileSections';

type Tab = 'menus' | 'originals' | 'rankings' | 'people';
/** A bar's page leads with its menus. */
/** Originals shown before "All 12 originals". */
const FIRST_ORIGINALS = 4;

const TABS = [
  { value: 'menus', label: 'Menus' },
  { value: 'originals', label: 'Originals' },
  { value: 'rankings', label: 'Top drinks' },
  { value: 'people', label: 'People' },
] as const;

/**
 * A bar's page: who it is, its numbers, This week, what matches a search, its
 * classics and awards, then Menus, Originals, Top drinks and People. A page
 * that keeps its specs back (unclaimed, or not open) shows names, a lock, and why.
 */
export function BarProfile({ profile, columns }: { profile: Profile; columns: number }) {
  const [tab, setTab] = useState<Tab>('menus');
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [allOriginals, setAllOriginals] = useState(false);
  const facts = useBarFacts(profile.id).data;
  const here = useYouHere(profile.id);
  const runs = drinkRunTags(useMenuEditions(profile.id).data ?? []);
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id, { locked: profile.page_visibility === 'locked' });
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const unclaimed = isUnclaimed(profile);
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const specsLocked = pageLocksSpecs(profile.page_visibility, onTeam);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  const searched = !!useLocalSearchParams<{ q?: string }>().q;

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.head}>
        <BarHeader
          profile={profile}
          detail={[barPlace(facts?.bar_type, place) || 'Bar', here.count ? `you’ve had ${plural(here.count, 'drink')} here` : null].filter(Boolean).join(' · ')}
          love={<LoveBarButton profileId={profile.id} name={profile.display_name} labelled />}
        />
        {/* Opened from a search: the facts and actions, then straight into what matched (disc-search-bar). */}
        {searched ? null : (
          <View style={styles.chips}>
            <Tag label={unclaimed ? 'Not claimed yet' : 'Claimed'} />
            {profile.is_closed ? <Tag label={profile.closed_year ? `Closed ${profile.closed_year}` : 'Closed'} /> : null}
            {profile.is_public ? null : <Tag label="Private" />}
          </View>
        )}
        {profile.bio && !searched ? <Body>{profile.bio}</Body> : null}
        {searched ? null : <ProfileLinks profile={profile} align="start" />}
        <BarFactsBlock profileId={profile.id} />
        {unclaimed && facts?.hours ? <Caption tone="muted">{hoursSource(false, facts.hours_updated_at)}</Caption> : null}
      </View>

      {/* A search's matches (nothing without one) come right under the header. */}
      <BarMatches barProfileId={profile.id} />

      <BarStats profile={profile} originals={originals.length} onAwards={() => setAwardsOpen((v) => !v)} />

      {awardsOpen ? <Awards profileId={profile.id} /> : null}

      {unclaimed ? <BarFactsList profile={profile} /> : null}

      <BarWeek barId={profile.bar_id} profileId={profile.id} barName={profile.display_name} />

      {/* The menu it's pouring (b12, as Discover's bar view); the rest follows. */}
      <OnTheMenu profileId={profile.id} />

      {unclaimed && !specsLocked ? <ClaimProfile profile={profile} /> : null}

      <MenuCredits credits={credits} names={names} />

      <Segmented accessibilityLabel="Profile sections" options={TABS} value={tab} onChange={setTab} />
      {tab === 'menus' ? (
        <MenuHistory profileId={profile.id} name={profile.display_name} />
      ) : tab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : specsLocked ? (
          <LockedOriginals originals={originals} selfId={profile.id} details={pageShowsDescriptions(profile.page_visibility)} runs={runs} emptyText="No drinks credited to this bar yet." />
        ) : (
          <View style={styles.tab}>
            <OriginalsGrid
              originals={allOriginals ? originals : originals.slice(0, FIRST_ORIGINALS)}
              selfId={profile.id}
              columns={columns}
              layout="rows"
              ownerName={profile.display_name}
              runs={runs}
              emptyText="No drinks credited to this bar yet."
            />
            {originals.length > FIRST_ORIGINALS && !allOriginals ? (
              <Button label={`All ${originals.length} originals`} variant="secondary" onPress={() => setAllOriginals(true)} style={styles.start} />
            ) : null}
            {/* Classics they pour sit with the originals now, not above the tabs (ppl-bar-originals). */}
            <BarClassics barId={profile.bar_id} />
          </View>
        )
      ) : tab === 'rankings' ? (
        <View style={styles.tab}>
          <BarYours profileId={profile.id} drinkIds={originals.map((d) => d.id)} />
          <BarRankings bar={profile} />
        </View>
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
  body: { gap: space.xl },
  head: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tab: { gap: space.lg },
  start: { alignSelf: 'flex-start' },
});
