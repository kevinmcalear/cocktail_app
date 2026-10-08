import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { SearchScope } from '@/lib/searchScope';

interface ScopeSwitchProps {
  options: readonly { value: SearchScope; label: string }[];
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
}

/** Where to search: the venue, this area or everywhere, the picked side filled. */
export function ScopeSwitch({ options, scope, onScope }: ScopeSwitchProps) {
  const ds = useDs();
  return (
    <View role="tablist" accessibilityLabel="Where to search" style={[styles.switch, { backgroundColor: ds.c.surface }]}>
      {options.map((o) => {
        const on = scope === o.value;
        return (
          <PressableScale
            key={o.value}
            role="tab"
            aria-selected={on}
            accessibilityLabel={o.label}
            onPress={() => onScope(o.value)}
            style={[styles.side, on && { backgroundColor: ds.accentFill.fill }]}
          >
            <DsText variant="body" color={on ? ds.accentFill.text : ds.c.muted} style={on ? styles.bold : null} numberOfLines={1}>
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
  bold: { fontFamily: fontFamilies.bodySemiBold },
});
