import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Segmented, Tag, Title } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useMyProfile } from '@/hooks/useMyProfile';
import { isUnclaimed, useMenuCredits, useProfileAwards, useProfileOriginals, useProfilePicks, useProfilePositions, useWorkedMenus, type Profile } from '@/hooks/useProfiles';
import { useProfileBars, useProfileDrinks } from '@/hooks/useRankings';
import { hadStats, topFour } from '@/lib/hadDrinks';
import { plural } from '@/lib/menus';
import { barsCrediting, personTabs, pickedShown, profileLine } from '@/lib/profiles';

import { ClaimProfile } from './ClaimProfile';
import { SharedDrinks } from './HadDrinks';
import { PersonAwards } from './PersonAwards';
import { Positions } from './Positions';
import { ProfileLinks } from './ProfileLinks';
import { MenuCredits, OriginalsGrid, Stat, Stats } from './ProfileSections';
import { TopFour, fourSlots } from './TopFour';

type Tab = 'had' | 'bars' | 'originals';
const TABS = [
  { value: 'had', label: 'Had' },
  { value: 'bars', label: 'Bars' },
  { value: 'originals', label: 'Originals' },
] as const;
/** Originals shown before "All 14 originals". */
const FIRST_ORIGINALS = 4;

/** "7 awards" under the pills: on the web it jumps to the Awards section. */
function AwardsChip({ count }: { count: number }) {
  const label = plural(count, 'award');
  if (Platform.OS !== 'web') return <Tag label={label} />;
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. Jump to them`} onPress={() => document.getElementById('awards')?.scrollIntoView({ behavior: 'smooth' })}>
      <Tag label={label} />
    </PressableScale>
  );
}

/**
 * Someone else's profile (ppl-person): who they are, their numbers, top four,
 * where they work and worked, their awards, the menus their drinks are on,
 * then what they've had, their bars and their originals, each only as they
 * show it (or, to them, everything with a note).
 */
export function PersonProfile({ profile, columns }: { profile: Profile; columns: number }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const mine = useMyProfile().data?.id === profile.id;
  const shown = personTabs(profile, mine);
  const tabs = TABS.filter((t) => shown.includes(t.value));
  const [picked, setTab] = useState<Tab | null>(null);
  const [allOriginals, setAllOriginals] = useState(false);
  const tab: Tab | undefined = tabs.find((t) => t.value === picked)?.value ?? tabs[0]?.value;
  const showsMade = profile.made_mode !== 'none';
  const had = useProfileDrinks(profile.id, profile.had_mode !== 'none');
  const bars = useProfileBars(profile.id, profile.bars_mode !== 'none');
  const madePicks = useProfilePicks(profile.id, 'originals').data ?? {};
  const { data: credited = [], isLoading } = useProfileOriginals(profile.id);
  const originals = credited.filter((d) => pickedShown(profile.made_mode, madePicks[d.id]));
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  const worked = useWorkedMenus(profile.id).data ?? [];
  const awards = useProfileAwards(profile.id).data ?? [];
  const positions = useProfilePositions(profile).data ?? [];
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const onMenus = barsCrediting(credits);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  // What they said they do, or the job they picked; never a label we made up.
  const line = profileLine(profile, positions);
  const riffs = originals.reduce((n, d) => n + (d.versions?.[0]?.count ?? 0), 0);
  const drinksHad = hadStats(had.data ?? []).drinks;

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.header}>
        <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={88} />
        <Title align="center">{profile.display_name}</Title>
        <Caption tone="muted" align="center">
          {[`@${profile.handle}`, place].filter(Boolean).join(' · ')}
        </Caption>
        {line ? <Body align="center">{line}</Body> : null}
        <View style={styles.chips}>
          {originals.length > 0 && showsMade ? <Tag label="Creator" /> : null}
          {onMenus && showsMade ? <Tag label={`Credited on ${onMenus} bar ${onMenus === 1 ? 'menu' : 'menus'}`} /> : null}
          {awards.length ? <AwardsChip count={awards.length} /> : null}
          {isUnclaimed(profile) ? <Tag label="Not claimed yet" /> : null}
          {profile.is_public ? null : <Tag label="Private" />}
        </View>
        {profile.bio ? <Body align="center">{profile.bio}</Body> : null}
        <ProfileLinks profile={profile} align="center" />
      </View>

      <Stats>
        {showsMade ? <Stat value={originals.length} label={originals.length === 1 ? 'original' : 'originals'} /> : null}
        {had.data?.length ? <Stat value={drinksHad} label={drinksHad === 1 ? 'drink had' : 'drinks had'} /> : null}
        {showsMade && riffs ? <Stat value={riffs} label={riffs === 1 ? 'riff by others' : 'riffs by others'} /> : null}
      </Stats>

      {had.data ? <TopFour slots={fourSlots(topFour(had.data))} /> : null}

      {isUnclaimed(profile) ? <ClaimProfile profile={profile} /> : null}

      <Positions profile={profile} />

      <PersonAwards profileId={profile.id} />

      {showsMade ? <MenuCredits credits={credits} names={names} worked={worked} /> : null}

      {tab ? <Segmented accessibilityLabel="Profile sections" options={tabs} value={tab} onChange={setTab} /> : null}
      {mine && tab ? (
        <View style={styles.mine}>
          <Caption tone="muted" style={styles.flex}>
            This is what others see.
          </Caption>
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
        <View style={styles.section}>
          <Body tone="muted">Only you see the drinks you’ve made here. Their credits still show on each drink’s own page. You can show them from your profile settings.</Body>
          <Button label="Profile settings" variant="ghost" onPress={() => router.push('/settings/profile-sharing' as Href)} style={styles.start} />
        </View>
      ) : tab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : (
          <View style={styles.section}>
            <OriginalsGrid
              originals={allOriginals ? originals : originals.slice(0, FIRST_ORIGINALS)}
              selfId={profile.id}
              columns={columns}
              ownerName={profile.display_name}
              emptyText="No drinks credited to them yet."
            />
            {originals.length > FIRST_ORIGINALS && !allOriginals ? (
              <Button label={`All ${originals.length} originals`} variant="secondary" onPress={() => setAllOriginals(true)} style={styles.start} />
            ) : null}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  header: { alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  section: { gap: space.md },
  start: { alignSelf: 'flex-start' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
