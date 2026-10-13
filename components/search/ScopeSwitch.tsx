import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { SearchScope } from '@/lib/searchScope';

interface ScopeSwitchProps<T extends string> {
  options: readonly { value: T; label: string }[];
  scope: T;
  onScope: (scope: T) => void;
  /** What the group is called (an area on the rankings page). */
  accessibilityLabel?: string;
  /** Long place names (the rankings area): each side as wide as its words, in the smaller text, so none cut off. */
  fit?: boolean;
}

/** Where to search: the venue, this area or everywhere, the picked side filled. Also the rankings page's area (disc-rankings). */
export function ScopeSwitch<T extends string = SearchScope>({ options, scope, onScope, accessibilityLabel = 'Where to search', fit }: ScopeSwitchProps<T>) {
  const ds = useDs();
  return (
    <View role="tablist" accessibilityLabel={accessibilityLabel} style={[styles.switch, { backgroundColor: ds.c.surface }]}>
      {options.map((o) => {
        const on = scope === o.value;
        return (
          <PressableScale
            key={o.value}
            role="tab"
            aria-selected={on}
            accessibilityLabel={o.label}
            onPress={() => onScope(o.value)}
            style={[styles.side, fit && styles.fit, on && { backgroundColor: ds.accentFill.fill }]}
          >
            <DsText variant={fit ? 'caption' : 'body'} color={on ? ds.accentFill.text : fit ? ds.c.ink : ds.c.muted} style={on ? styles.bold : null} numberOfLines={1}>
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.pill },
  side: { flex: 1, minHeight: layout.minTapTarget - space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  fit: { flexBasis: 'auto', flexShrink: 1, minWidth: 0 },
  bold: { fontFamily: fontFamilies.bodySemiBold },
});
