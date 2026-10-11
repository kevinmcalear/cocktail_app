import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { DrinkMenuRun } from '@/hooks/useProfiles';
import { drinkMenuCard } from '@/lib/menuEditions';

/**
 * "On the menu Mar 2024 to Jan 2025 · Night Garden menu · not on at Little
 * Rye now": when a bar's drink was on its menus, so nobody walks up and asks
 * for one that came off. Opens the menu. Ranking and saving stay open; this
 * only says when. Nothing for a drink no menu lists.
 */
export function MenuRuns({ runs }: { runs: DrinkMenuRun[] }) {
  const router = useRouter();
  if (!runs.length) return null;
  return (
    <View style={styles.runs}>
      {runs.map((r) => {
        const { title, detail } = drinkMenuCard(r.barName, r.editionName, r);
        return <MenuCard key={r.barId} title={title} detail={detail} onPress={() => router.push(`/p/${r.barId}/menus/${r.editionId}` as Href)} />;
      })}
    </View>
  );
}

/** A menu the drink is on: calendar, what and where, opening the menu ("On the menu now · Autumn menu at Little Rye"). */
export function MenuCard({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${title}. ${detail}. Open the menu`} onPress={onPress} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <IconSymbol name="calendar" size={22} color={ds.accentText} />
      <View style={styles.text}>
        <Body>{title}</Body>
        <Caption tone="muted">{detail}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  runs: { gap: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
