import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useClassicSuggestions } from '@/hooks/useClassics';

/** In Library, for editors: how many drinks look like classics but aren't linked yet. Hidden when none. */
export function MatchClassicsNudge({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const { suggestions } = useClassicSuggestions(barId);
  if (!suggestions.length) return null;
  const n = suggestions.length;
  return (
    <View style={[styles.nudge, { backgroundColor: ds.c.raised }]}>
      <Body style={styles.flex}>{`${n} ${n === 1 ? 'drink looks' : 'drinks look'} like a classic. Link them so they show up in "best Martini" lists.`}</Body>
      <Button label="Match" variant="secondary" onPress={() => router.push('/classics')} />
    </View>
  );
}

const styles = StyleSheet.create({
  nudge: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 200 },
});
