import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { MenuCreditWithProfile, Original } from '@/hooks/useProfiles';
import { heroPicture } from '@/lib/itemImages';

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
            <DrinkImage source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} accessibilityLabel={d.name} />
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
  soon: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg },
});
