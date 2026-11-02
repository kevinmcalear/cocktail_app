import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';

// Its own file, not bits.tsx: Discover shows it on first load, and bits.tsx would bring the technique page parts with it.

/** A tappable row that opens another screen in the library, or `onPress` (a sheet over this one). */
export function LinkRow({ title, detail, href, icon, onPress }: { title: string; detail?: string; href: string; icon?: Parameters<typeof IconSymbol>[0]['name']; onPress?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale role="link" accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress ?? (() => router.push(href as never))} style={[styles.card, { backgroundColor: ds.c.surface }]}>
      {icon ? <IconSymbol name={icon} size={20} color={ds.c.ink} /> : null}
      <View style={styles.flex}>
        <Headline>{title}</Headline>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
