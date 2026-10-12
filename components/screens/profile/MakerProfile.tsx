import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, IngredientThumb, PressableScale, TextLink, useDs } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useMakerBottles, useMakerDrinks, type MakerBottle } from '@/hooks/useMakers';
import { isUnclaimed, useProfile, type Profile } from '@/hooks/useProfiles';
import { itemHref } from '@/lib/itemRoutes';
import { makesLine, servesLine } from '@/lib/makers';

import { Awards } from './BarRecord';
import { ClaimProfile } from './ClaimProfile';
import { MakerGlassBars } from './MakerGlassBars';
import { ProfileLinks } from './ProfileLinks';
import { BarHeader, OriginalsGrid, Stat, Stats } from './ProfileSections';

/**
 * A maker's page: the house that makes a bottle, cuts a bar's ice or makes
 * its glass. Who they are, what they make and where they deliver, their
 * bottles, and the drinks that credit them (once they've confirmed it).
 * Owned by a venue team like a bar's page; never on the map or in Discover.
 */
export function MakerProfile({ profile, columns }: { profile: Profile; columns: number }) {
  const { data: bottles = [], isLoading: bottlesLoading } = useMakerBottles(profile.id);
  const { data: drinks = [], isLoading: drinksLoading } = useMakerDrinks(profile.id);
  const { data: group } = useProfile(profile.part_of_profile_id);
  const router = useRouter();
  const signedIn = useSignedIn();
  const unclaimed = isUnclaimed(profile);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  const serves = servesLine(profile.serves);
  // Bottles for a bottle house, credited drinks for an ice or glass maker; both when it makes both.
  const showBottles = profile.makes.includes('bottles') || bottles.length > 0;
  const showDrinks = profile.makes.includes('ice') || profile.makes.includes('glassware') || drinks.length > 0;
  const name = profile.display_name;
  const signInLine =
    showBottles && showDrinks
      ? `Sign in to see ${name}’s bottles and the drinks that credit them.`
      : showBottles
        ? `Sign in to see ${name}’s bottles.`
        : `Sign in to see the drinks that credit ${name}.`;

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.head}>
        <BarHeader profile={profile} detail={[makesLine(profile.makes), place, unclaimed ? 'Not claimed yet' : 'Claimed'].filter(Boolean).join(' · ')} />
        {group ? <TextLink label={`Part of ${group.display_name}`} onPress={() => router.push(`/p/${group.handle}` as Href)} /> : null}
        {serves ? <Caption tone="muted">{serves}</Caption> : null}
        {profile.bio ? <Body>{profile.bio}</Body> : null}
        <ProfileLinks profile={profile} align="start" />
      </View>

      {signedIn && (showBottles || showDrinks) ? (
        <Stats>
          {showBottles ? <Stat value={bottles.length} label={bottles.length === 1 ? 'bottle' : 'bottles'} /> : null}
          {showDrinks ? <Stat value={drinks.length} label={drinks.length === 1 ? 'drink' : 'drinks'} /> : null}
        </Stats>
      ) : null}

      <Awards profileId={profile.id} />

      {unclaimed ? <ClaimProfile profile={profile} label="Make this? Claim this page" /> : null}

      {!signedIn ? (
        <View style={styles.section}>
          <Caption tone="muted">{signInLine}</Caption>
          <TextLink label="Sign in" onPress={() => router.push('/auth/login' as Href)} />
        </View>
      ) : null}

      {signedIn && (bottles.length > 0 || bottlesLoading) ? (
        <View style={styles.section}>
          <Headline role="heading">Bottles</Headline>
          {bottlesLoading ? <Caption tone="muted">Loading bottles…</Caption> : <BottleList bottles={bottles} />}
        </View>
      ) : null}

      {signedIn && showDrinks ? (
        <View style={styles.section}>
          <Headline role="heading">In drinks</Headline>
          {drinksLoading ? (
            <Caption tone="muted">Loading drinks…</Caption>
          ) : (
            <OriginalsGrid originals={drinks} selfId={profile.id} columns={columns} emptyText={`No drinks credit ${profile.display_name} yet.`} />
          )}
        </View>
      ) : null}

      {signedIn ? <MakerGlassBars profileId={profile.id} name={profile.display_name} /> : null}
    </View>
  );
}

function BottleList({ bottles }: { bottles: MakerBottle[] }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View role="list">
      {bottles.map((b) => {
        const detail = [b.kind, b.abv != null ? `${b.abv}%` : null].filter(Boolean).join(' · ');
        return (
          <PressableScale
            key={b.id}
            role="link"
            accessibilityLabel={[b.name, detail].filter(Boolean).join('. ')}
            onPress={() => router.push(itemHref('Ingredient', b.id) as Href)}
            style={[styles.row, { borderBottomColor: ds.c.line }]}
          >
            <IngredientThumb id={b.id} name={b.name} />
            <View style={styles.flex}>
              <Body numberOfLines={1}>{b.name}</Body>
              {detail ? (
                <Caption tone="muted" numberOfLines={1}>
                  {detail}
                </Caption>
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  head: { gap: space.sm },
  section: { gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
