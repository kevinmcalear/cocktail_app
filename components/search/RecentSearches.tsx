import { Platform, StyleSheet, View } from 'react-native';

import { Body, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';

import { ResultGroup } from './ResultRows';

/** Before you type: the words you searched. A tap searches them again; Android's arrow puts them in the field. */
export function RecentSearches({ terms, onPick, onClear }: { terms: readonly string[]; onPick: (term: string) => void; onClear: () => void }) {
  const ds = useDs();
  return (
    <ResultGroup
      label="Recent"
      plain
      counted={false}
      items={terms}
      action={{ label: 'Clear', onPress: onClear }}
      render={(term) => (
        <View key={term} style={styles.term}>
          <PressableScale role="button" accessibilityLabel={`Search ${term}`} onPress={() => onPick(term)} style={styles.termText}>
            <IconSymbol name="clock.arrow.circlepath" size={22} color={ds.c.muted} />
            <Body numberOfLines={1} style={styles.flex}>
              {term}
            </Body>
          </PressableScale>
          {Platform.OS === 'android' ? (
            <PressableScale role="button" accessibilityLabel={`Put ${term} in the field`} onPress={() => onPick(term)} style={styles.fill}>
              <IconSymbol name="arrow.up.left" size={22} color={ds.c.muted} />
            </PressableScale>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  term: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  termText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 52 },
  fill: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
