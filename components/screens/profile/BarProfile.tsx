import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Segmented, Tag } from '@/components/ds';
import { BarWeek } from '@/components/screens/week/BarWeek';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { isUnclaimed, useMenuCredits, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { pageLocksSpecs, pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';

import { SpecLockPanel } from '../drink/SpecLockPanel';
import { BarClassics } from './BarClassics';
import { BarMatches } from './BarMatches';
import { BarRankings } from './BarRankings';
import { Awards, MenuHistory } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { LockedOriginals } from './LockedOriginals';
import { Positions } from './Positions';
import { ProfileLinks } from './ProfileLinks';
import { BarHeader, BarStats, MenuCredits, OriginalsGrid } from './ProfileSections';

type Tab = 'menus' | 'originals' | 'rankings' | 'people';
/** A bar's page leads with its menus. */
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
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id, { locked: profile.page_visibility === 'locked' });
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const unclaimed = isUnclaimed(profile);
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const specsLocked = pageLocksSpecs(profile.page_visibility, onTeam);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.head}>
        <BarHeader profile={profile} detail={[place || 'Bar', unclaimed ? 'Not claimed yet' : 'Claimed'].join(' · ')} />
        <View style={styles.chips}>
          {profile.is_closed ? <Tag label={profile.closed_year ? `Closed ${profile.closed_year}` : 'Closed'} /> : null}
          {profile.is_public ? null : <Tag label="Private" />}
        </View>
        {profile.bio ? <Body>{profile.bio}</Body> : null}
        <ProfileLinks profile={profile} align="start" />
      </View>

      <BarStats profile={profile} originals={originals.length} />

      <BarWeek barId={profile.bar_id} profileId={profile.id} barName={profile.display_name} />

      <BarMatches barProfileId={profile.id} />

      <BarClassics barId={profile.bar_id} />

      <Awards profileId={profile.id} />

      {unclaimed && !specsLocked ? <ClaimProfile profile={profile} /> : null}

      <MenuCredits credits={credits} names={names} />

      <Segmented accessibilityLabel="Profile sections" options={TABS} value={tab} onChange={setTab} />
      {tab === 'menus' ? (
        <MenuHistory profileId={profile.id} name={profile.display_name} />
      ) : tab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : specsLocked ? (
          <LockedOriginals originals={originals} selfId={profile.id} details={pageShowsDescriptions(profile.page_visibility)} emptyText="No drinks credited to this bar yet." />
        ) : (
          <OriginalsGrid originals={originals} selfId={profile.id} columns={columns} layout="rows" ownerName={profile.display_name} emptyText="No drinks credited to this bar yet." />
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
  body: { gap: space.xl },
  head: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
