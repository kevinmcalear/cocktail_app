import { Platform, StyleSheet, View } from 'react-native';

import { useMaterialRoles } from '@/components/nav/material';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

interface SegmentedCapsuleProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/**
 * The page's own switch (Drinks, House-made, Bottles; Loved, Want to go;
 * Prod-drinks): a soft track with the pick raised on iOS and the web.
 * Android (Prod-and): connected buttons, the pick a full pill with a check.
 * Apart from Segmented so the pages without one don't load it.
 */
export function SegmentedCapsule<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedCapsuleProps<T>) {
  const ds = useDs();
  const android = Platform.OS === 'android';
  const dark = ds.scheme === 'dark';
  const rest = withAlpha(ds.c.ink, 0.07);
  const { indicator } = useMaterialRoles();
  return (
    <View role="tablist" accessibilityLabel={accessibilityLabel} style={[styles.capsule, android ? null : { backgroundColor: rest }, android ? styles.connected : null]}>
      {options.map((o) => {
        const selected = o.value === value;
        const fill = android ? (selected ? indicator : rest) : selected ? (dark ? withAlpha(ds.c.ink, 0.16) : ds.c.surface) : 'transparent';
        return (
          <PressableScale
            key={o.value}
            role="tab"
            aria-selected={selected}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.capsuleItem, android ? (selected ? styles.connectedOn : styles.connectedItem) : null, { backgroundColor: fill }, selected && !android && !dark ? { boxShadow: `0 1px 4px ${withAlpha(ds.c.ink, 0.1)}` } : null]}
          >
            {android && selected ? <IconSymbol name="checkmark" size={15} color={ds.c.ink} /> : null}
            <DsText variant="body" numberOfLines={1} style={[styles.small, selected ? font.semiBold : font.medium]}>
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: radius.card - space.xs },
  connected: { padding: 0 },
  capsuleItem: { flex: 1, minWidth: 0, minHeight: layout.minTapTarget - 6, flexDirection: 'row', gap: space.xs + 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs, borderRadius: radius.control + 3 },
  connectedItem: { minHeight: layout.minTapTarget, borderRadius: space.sm },
  connectedOn: { minHeight: layout.minTapTarget, borderRadius: radius.card - 2 },
  // The control's labels a step under body, as drawn (15 on 24).
  small: { fontSize: type.label.fontSize, lineHeight: type.label.lineHeight },
});
