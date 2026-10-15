import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import type { NameCredit } from '@/hooks/useProfiles';

/**
 * Drinks a person made at bars whose page is Names or Private: the drink's
 * name and the bar, nothing more (Kevin, 15 Oct 2026). Each row opens the bar,
 * never the drink, which that bar keeps to itself.
 */
export function NameCredits({ credits, hidden }: { credits: NameCredit[]; hidden: ReadonlySet<string> }) {
  const ds = useDs();
  const router = useRouter();
  const shown = credits.filter((c) => !hidden.has(c.item_id));
  if (!shown.length) return null;
  return (
    <View style={styles.block}>
      <Caption tone="muted" role="heading" aria-level={3}>
        At bars that keep their drinks to themselves
      </Caption>
      <View role="list">
        {shown.map((c) => (
          <PressableScale
            key={c.item_id}
            role="link"
            accessibilityLabel={`${c.name}, at ${c.bar_name}. Open ${c.bar_name}`}
            onPress={() => router.push(`/p/${c.bar_handle}` as Href)}
            style={[styles.row, { borderBottomColor: ds.c.line }]}
          >
            <Body>{c.name}</Body>
            <Caption tone="muted">{`at ${c.bar_name}`}</Caption>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
