import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Segmented, Tag, TextLink, Title } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useItemFamilies, useProfileUserId } from '@/hooks/useFollows';
import { useProfileMade, useSetMadeShown } from '@/hooks/useMade';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useMenuCredits, useProfileAwards, useProfileNameCredits, useProfileOriginals, useProfilePicks, useProfilePositions, useWorkedMenus, type Profile } from '@/hooks/useProfiles';
import { useProfileBars, useProfileDrinks } from '@/hooks/useRankings';
import { dotLine, favouriteFamily, familyPlural } from '@/lib/follows';
import { hadStats } from '@/lib/hadDrinks';
import { plural } from '@/lib/menus';
import { barsCrediting, personTabs, pickedShown, profileLine } from '@/lib/profiles';
import { siteOrigin } from '@/lib/venueLink';

import { useFollow } from '../people/Follow';
import { PersonActions, PersonRanks } from '../people/PersonFollow';
import { SharedDrinks } from './HadDrinks';
import { PersonAwards } from './PersonAwards';
import { Positions } from './Positions';
import { ProfileLinks } from './ProfileLinks';
import { NameCredits } from './NameCredits';
import { MenuCredits, OriginalsGrid, Stat, Stats } from './ProfileSections';
import { useShareLink } from './useShareLink';

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
 * Someone else's claimed profile (ppl-person; an unclaimed one is UnclaimedPerson): who they are, their numbers, top four,
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
  const made = useProfileMade(profile.id, profile.had_mode !== 'none').data;
  const setMadeShown = useSetMadeShown();
  const madePicks = useProfilePicks(profile.id, 'originals').data ?? {};
  const { data: credited = [], isLoading } = useProfileOriginals(profile.id);
  const nameCredits = useProfileNameCredits(profile.id, profile.made_mode !== 'none').data ?? [];
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
  const stats = hadStats(had.data ?? []);
  // Following (Kept-follow): their page's owner, and whether you follow each other. Never on your own page.
  const ownerId = useProfileUserId(mine ? null : profile.id).data ?? null;
  const follow = useFollow(ownerId, profile.display_name);
  const share = useShareLink(`${siteOrigin()}/p/${profile.handle}`, profile.display_name);
  const families = useItemFamilies((had.data ?? []).map((d) => d.itemId)).data ?? {};
  const favourite = favouriteFamily((had.data ?? []).map((d) => families[d.itemId]));
  const keeps = !mine && profile.had_mode === 'none';

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.header}>
        <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={88} />
        <Title align="center">{profile.display_name}</Title>
        <Caption tone="muted" align="center">
          {dotLine([place, favourite && `mostly ${familyPlural(favourite).toLowerCase()}`, follow.followsYou && 'follows you']) || `@${profile.handle}`}
        </Caption>
        {line ? <Body align="center">{line}</Body> : null}
        <View style={styles.chips}>
          {originals.length > 0 && showsMade ? <Tag label="Creator" /> : null}
          {onMenus && showsMade ? <Tag label={`Credited on ${onMenus} bar ${onMenus === 1 ? 'menu' : 'menus'}`} /> : null}
          {awards.length ? <AwardsChip count={awards.length} /> : null}
          {profile.is_public ? null : <Tag label="Private" />}
        </View>
        {profile.bio ? <Body align="center">{profile.bio}</Body> : null}
        <ProfileLinks profile={profile} align="center" />
      </View>

      {/* Nothing to count (nothing ranked or made): no empty ruled band. */}
      {had.data?.length || (showsMade && originals.length) ? (
        <Stats ruled>
          {had.data?.length ? <Stat ruled value={stats.drinks} label="ranked" /> : null}
          {stats.bars ? <Stat ruled value={stats.bars} label={stats.bars === 1 ? 'bar' : 'bars'} /> : null}
          {favourite ? <Stat ruled value={familyPlural(favourite)} label="favourite" /> : null}
          {showsMade && originals.length ? <Stat ruled value={originals.length} label={originals.length === 1 ? 'original' : 'originals'} /> : null}
          {showsMade && riffs ? <Stat ruled value={riffs} label={riffs === 1 ? 'riff by others' : 'riffs by others'} /> : null}
        </Stats>
      ) : null}

      <PersonActions follow={mine || !ownerId ? null : follow} name={profile.display_name} onShare={() => void share()} />

      <PersonRanks name={profile.display_name} drinks={had.data} keeps={keeps} following={follow.following} families={families} />

      <Positions profile={profile} />

      <PersonAwards profileId={profile.id} />

      {showsMade ? <MenuCredits credits={credits} names={names} worked={worked} /> : null}

      {tab ? <Segmented accessibilityLabel="Profile sections" variant="ink" stretch options={tabs} value={tab} onChange={setTab} /> : null}
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
          made={made}
          onHideMade={mine ? (id) => setMadeShown.mutate({ id, shown: false }) : undefined}
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
            {/* Only name-only credits: no empty grid above them. */}
            {originals.length || !nameCredits.length ? (
              <OriginalsGrid
                originals={allOriginals ? originals : originals.slice(0, FIRST_ORIGINALS)}
                selfId={profile.id}
                columns={columns}
                ownerName={profile.display_name}
                emptyText="No drinks credited to them yet."
              />
            ) : null}
            {originals.length > FIRST_ORIGINALS && !allOriginals ? (
              <View style={styles.start}>
                <TextLink label={`All ${originals.length} originals`} onPress={() => setAllOriginals(true)} />
              </View>
            ) : null}
            <NameCredits credits={nameCredits} hidden={new Set(credited.map((d) => d.id))} />
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
