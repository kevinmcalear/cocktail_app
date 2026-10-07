import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, Spec, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useVenueScore } from '@/hooks/useDiscover';
import type { MenuCreditWithProfile, Original } from '@/hooks/useProfiles';
import { heroPicture } from '@/lib/itemImages';
import { peopleCount } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';

import { CreditTag } from '../drink/FamilyTree';

/** A profile's credited drinks as tiles; each opens the drink. The profile's own name is left out of each tile. */
export function OriginalsGrid({ originals, columns, emptyText, selfId }: { originals: Original[]; columns: number; emptyText: string; selfId: string }) {
  const router = useRouter();
  if (!originals.length) return <Body tone="muted">{emptyText}</Body>;
  return (
    <View role="list" style={styles.grid}>
      {originals.map((d) => {
        const hero = heroPicture(d.item_images);
        const others = [d.creator, d.origin_bar].filter((p) => p && p.id !== selfId).map((p) => p!.display_name);
        const meta = [d.origin_year, ...others].filter(Boolean).join(' · ');
        return (
          <PressableScale
            key={d.id}
            role="link"
            accessibilityLabel={[d.name, meta].filter(Boolean).join('. ')}
            onPress={() => router.push(`/cocktail/${d.id}` as Href)}
            style={[styles.tile, { width: `${100 / columns}%` }]}
          >
            <DrinkImage source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} itemId={d.id} accessibilityLabel={d.name} />
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
 * A bar's score: its drinks' scores averaged, weighted by how many people
 * ranked each. Early (under MIN_RANKERS people) says so, without a number.
 */
export function BarScore({ profileId }: { profileId: string }) {
  const { data } = useVenueScore(profileId);
  if (!data) return null;
  const people = peopleCount(data.rankers);
  const drinks = data.drinks === 1 ? '1 drink' : `${data.drinks} drinks`;
  if (data.score === null) {
    return (
      <Caption tone="muted" align="center">
        {`Early: ${people} ranked ${drinks} here so far. A bar score shows once ${MIN_RANKERS} people have.`}
      </Caption>
    );
  }
  return (
    <View accessible accessibilityLabel={`Bar score ${formatScore(data.score)} out of 10, from ${people} across ${drinks}`} style={styles.score}>
      <Spec align="center">{formatScore(data.score)}</Spec>
      <Caption tone="muted" align="center">{`Bar score · ${people} · ${drinks}`}</Caption>
    </View>
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

/** Rankings and the shelf arrive with their own steps (7c, and the home bar). */
export function ComingSoon({ text }: { text: string }) {
  const ds = useDs();
  return (
    <View style={[styles.soon, { borderColor: ds.c.lineStrong }]}>
      <Body tone="muted">{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm / 2, rowGap: space.lg },
  tile: { paddingHorizontal: space.sm / 2, gap: space.xs },
  menus: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  menu: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  score: { alignItems: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl },
  stat: { alignItems: 'center', minWidth: 72 },
  soon: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg },
});
