import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { Original } from '@/hooks/useProfiles';
import { heroPicture } from '@/lib/itemImages';
import { creators } from '@/lib/lineage';

/**
 * A bar's drinks when its page keeps the specs back: each name, and (unless
 * the page is locked) its picture, who made it and what it's like, with a
 * lock where the spec would be. Each row still opens the drink, to rank or save it.
 */
export function LockedOriginals({ originals, selfId, details, emptyText }: { originals: Original[]; selfId: string; details: boolean; emptyText: string }) {
  const ds = useDs();
  const router = useRouter();
  if (!originals.length) return <Body tone="muted">{emptyText}</Body>;
  return (
    <View role="list">
      {originals.map((d) => {
        const by = creators(d).filter((p) => p.id !== selfId).map((p) => p.display_name);
        const meta = details ? [by.length ? `by ${by.join(' and ')}` : null, d.origin_year].filter(Boolean).join(' · ') : '';
        const description = details ? d.description : null;
        const hero = details ? heroPicture(d.item_images) : null;
        return (
          <PressableScale
            key={d.id}
            role="link"
            accessibilityLabel={[d.name, meta, description, 'Spec private'].filter(Boolean).join('. ')}
            onPress={() => router.push(`/cocktail/${d.id}` as Href)}
            style={[styles.row, { borderBottomColor: ds.c.line }]}
          >
            {details ? (
              <View style={styles.thumb}>
                <DrinkImage thumb source={hero?.url} generated={hero?.isSketch} glass={d.glass?.icon_key} itemId={d.id} accessibilityLabel={d.name} radius="control" hideTag />
              </View>
            ) : null}
            <View style={styles.text}>
              <Body>{d.name}</Body>
              {meta ? <Caption tone="muted">{meta}</Caption> : null}
              {description ? (
                <Body tone="muted" style={styles.description}>
                  {description}
                </Body>
              ) : null}
            </View>
            <View style={[styles.lock, { backgroundColor: ds.c.raised }]} aria-hidden>
              <IconSymbol name="lock.fill" size={18} color={ds.c.muted} />
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 52 },
  text: { flex: 1, minWidth: 0, gap: space.xs / 2 },
  description: { marginTop: space.xs },
  lock: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
