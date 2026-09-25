import { StyleSheet, View } from 'react-native';

import { fontFamilies, layout, space } from '@/constants/tokens';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Tabs within a screen (Spec · Service · Family). The selected one is underlined. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const ds = useDs();
  return (
    <View role="tablist" accessibilityLabel={accessibilityLabel} style={[styles.bar, { borderBottomColor: ds.c.line }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            role="tab"
            accessibilityLabel={o.label}
            aria-selected={selected}
            onPress={() => onChange(o.value)}
            style={[styles.tab, { borderBottomColor: selected ? ds.c.ink : 'transparent' }]}
          >
            <DsText
              variant="body"
              tone={selected ? 'ink' : 'muted'}
              style={{ fontFamily: selected ? fontFamilies.bodySemiBold : fontFamilies.body }}
            >
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: space.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { minHeight: layout.minTapTarget, justifyContent: 'center', borderBottomWidth: 2, marginBottom: -1 },
});
