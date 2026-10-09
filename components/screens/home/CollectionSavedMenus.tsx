import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSavedMenus } from '@/hooks/useKept';
import { menuRange, menuState } from '@/lib/menuEditions';

/**
 * Bar menus you saved (Save menu on a bar's menu page), on Collection's
 * Menus, each with how much of it your shelf makes. Nothing when there are none.
 */
export function CollectionSavedMenus({ canMakeIds }: { canMakeIds: Set<string> }) {
  const ds = useDs();
  const router = useRouter();
  const menus = useSavedMenus().data ?? [];
  if (!menus.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Saved from bars</Headline>
      <Caption tone="muted">Menus you loved. They stay here after the bar moves on.</Caption>
      <View role="list">
        {menus.map((m) => {
          const ready = m.drinkIds.filter((id) => canMakeIds.has(id)).length;
          const when = menuState(m.dates) === 'past' ? `Past · ${menuRange(m.dates)}` : menuRange(m.dates);
          const make = m.drinkIds.length ? `${ready} of ${m.drinkIds.length} ready to make` : null;
          return (
            <View role="listitem" key={m.editionId}>
              <PressableScale
                role="link"
                accessibilityLabel={[`${m.name}, ${m.barName}`, when, make].filter(Boolean).join('. ')}
                onPress={() => router.push(`/p/${m.barId}/menus/${m.editionId}` as Href)}
                style={[styles.row, { borderBottomColor: ds.c.line }]}
              >
                <Caption tone="muted">{[m.barName, when].filter(Boolean).join(' · ')}</Caption>
                <Headline>{m.name}</Headline>
                {make ? <Caption tone="accent">{make}</Caption> : null}
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  row: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
