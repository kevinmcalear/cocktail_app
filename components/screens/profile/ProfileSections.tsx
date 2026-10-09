import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, Spec, Title, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useVenueScore } from '@/hooks/useDiscover';
import { useProfileAwards, useProfilePositions, type MenuCreditWithProfile, type Original, type Profile } from '@/hooks/useProfiles';
import { heroPicture } from '@/lib/itemImages';
import { rankedCount } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';
import { versionLabel } from '@/lib/servedAt';

import { CreditTag } from '../drink/FamilyTree';
import { ClassicsTheyPour, usePouredSplit } from './ClassicsTheyPour';
import { isShownPosition } from './Positions';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

/**
 * A profile's credited drinks as tiles; each opens the drink. The profile's
 * own name is left out of each tile. Their copies of a classic poured as it is
 * (the same spec, or none to tell) sit in one line, "Classics they pour",
 * instead of a tile each; a variation's tile says what it changes.
 */
export function OriginalsGrid({ originals, columns, emptyText, selfId }: { originals: Original[]; columns: number; emptyText: string; selfId: string }) {
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const { poured, own, matches } = usePouredSplit(selfId, originals);
  if (!originals.length) return <Body tone="muted">{emptyText}</Body>;
  return (
    <View style={styles.originals}>
      <ClassicsTheyPour drinks={poured} />
      <View role="list" style={styles.grid}>
        {own.map((d) => {
          const hero = heroPicture(d.item_images);
          const others = [d.creator, d.origin_bar].filter((p) => p && p.id !== selfId).map((p) => p!.display_name);
          const meta = [d.origin_year, ...others, versionLabel(matches?.[d.id])].filter(Boolean).join(' · ');
          return (
            <PressableScale
              key={d.id}
              role="link"
              accessibilityLabel={[d.name, meta].filter(Boolean).join('. ')}
              onPressIn={() => prefetch(d.id, { name: d.name, item_images: d.item_images })}
              onPress={() => router.push(`/cocktail/${d.id}` as Href)}
              style={[styles.tile, { width: `${100 / columns}%` }]}
            >
              <DrinkImage thumb source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} itemId={d.id} accessibilityLabel={d.name} />
              <DsText variant="headline" numberOfLines={2}>
                {d.name}
              </DsText>
              {meta ? (
                <Caption tone="muted" numberOfLines={1}>
                  {meta}
                </Caption>
              ) : null}
              <CreditTag status={d.credit_status} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** "On the menu at": bars carrying this profile's drinks, current menus first. */
export function MenuCredits({ credits, names }: { credits: MenuCreditWithProfile[]; names: Map<string, string> }) {
  const ds = useDs();
  const router = useRouter();
  if (!credits.length) return null;
  return (
    <View style={styles.menus}>
      <Caption tone="muted" style={styles.cap}>
        On the menu at
      </Caption>
      <View role="list">
        {credits.map((c) => {
          const drinks = c.itemIds.map((id) => names.get(id)).filter(Boolean).join(', ');
          const label = `${c.barName ?? 'A bar'}, ${c.menuName}${c.current ? '' : ' (past menu)'}: ${drinks}`;
          const row = (
            <>
              <View style={styles.flex}>
                <DsText variant="headline" numberOfLines={1}>
                  {c.barName ?? 'A bar'}
                </DsText>
                <Caption tone="muted" numberOfLines={2}>
                  {`${c.menuName} · ${drinks}`}
                </Caption>
              </View>
              <Caption tone={c.current ? 'ink' : 'muted'}>{c.current ? 'On now' : 'Past menu'}</Caption>
            </>
          );
          return c.barProfileId ? (
            <PressableScale
              key={c.menuId}
              role="link"
              accessibilityLabel={`${label}. Open the bar's profile`}
              onPress={() => router.push(`/p/${c.barProfileId}` as Href)}
              style={[styles.menu, { borderBottomColor: ds.c.line }]}
            >
              {row}
            </PressableScale>
          ) : (
            <View key={c.menuId} role="listitem" accessible accessibilityLabel={label} style={[styles.menu, { borderBottomColor: ds.c.line }]}>
              {row}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * A bar's name with its score and how many people have ranked drinks there.
 * The score is its drinks' scores averaged, weighted by how many people
 * ranked each. Early (under MIN_RANKERS people) gives the count, no number.
 */
export function BarHeader({ profile, detail }: { profile: { id: string; display_name: string; avatar_url: string | null }; detail: string }) {
  const { data } = useVenueScore(profile.id);
  const score = data?.score ?? null;
  const ranked = data?.rankers ? rankedCount(data.rankers) : null;
  const scoreLabel = score !== null ? `Bar score ${formatScore(score)} out of 10` : ranked ? `No bar score until ${MIN_RANKERS} people have ranked here` : null;
  return (
    <View accessible accessibilityLabel={[profile.display_name, detail, ranked, scoreLabel].filter(Boolean).join('. ')} style={styles.barHeader}>
      <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={52} />
      <View style={styles.flex}>
        <Title>{profile.display_name}</Title>
        <Caption tone="muted">{[detail, ranked].filter(Boolean).join(' · ')}</Caption>
      </View>
      {score !== null ? <Spec tone="accent">{formatScore(score)}</Spec> : null}
    </View>
  );
}

/** The numbers under a bar's name (its score sits in BarHeader): awards, people and originals. */
export function BarStats({ profile, originals }: { profile: Pick<Profile, 'id' | 'kind'>; originals: number }) {
  const { data: awards = [] } = useProfileAwards(profile.id);
  const people = (useProfilePositions(profile).data ?? []).filter(isShownPosition).length;
  return (
    <Stats>
      <Stat value={awards.length} label={awards.length === 1 ? 'award' : 'awards'} />
      <Stat value={people} label={people === 1 ? 'person' : 'people'} />
      <Stat value={originals} label={originals === 1 ? 'original' : 'originals'} />
    </Stats>
  );
}

/** The numbers under a profile's name. */
export function Stats({ children }: { children: ReactNode }) {
  return (
    <View role="list" style={styles.stats}>
      {children}
    </View>
  );
}

export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View role="listitem" accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Spec align="center">{value}</Spec>
      <Caption tone="muted" align="center">
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  originals: { gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm / 2, rowGap: space.lg },
  tile: { paddingHorizontal: space.sm / 2, gap: space.xs },
  menus: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  menu: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl },
  stat: { alignItems: 'center', minWidth: 72 },
});
