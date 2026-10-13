import { StyleSheet, View } from 'react-native';

import { fontFamilies, layout, radius, space } from '@/constants/tokens';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Tabs share the whole width equally (Collection's Drinks · Menus · Bars), in a round track. */
  fill?: boolean;
  /** With `fill`: the small switch inside a sheet (New event's Add one · From a calendar link), caption text on a quiet raised pick. */
  quiet?: boolean;
  /** Plain text tabs with the selected one underlined, where the canvas draws them so (History's Tree · Timeline). */
  underline?: boolean;
}

/**
 * Tabs within a screen (Spec · Service · Family), as the canvas draws them:
 * a dark track with the selected tab a cream pill.
 */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, fill, underline, quiet }: SegmentedProps<T>) {
  const ds = useDs();
  if (underline) return <Underlined options={options} value={value} onChange={onChange} accessibilityLabel={accessibilityLabel} />;
  return (
    <View
      role="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: ds.c.surface }, fill ? [styles.fill, { borderColor: ds.c.line }] : null, quiet ? [styles.quiet, { backgroundColor: ds.c.line }] : null]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            role="tab"
            accessibilityLabel={o.label}
            aria-selected={selected}
            onPress={() => onChange(o.value)}
            style={[styles.tab, fill ? styles.fillTab : null, quiet ? styles.quietTab : null, selected ? { backgroundColor: quiet ? ds.c.lineStrong : ds.c.ink } : null]}
          >
            <DsText
              variant={quiet ? 'caption' : 'body'}
              numberOfLines={1}
              color={quiet ? (selected ? ds.c.ink : ds.c.muted) : selected ? ds.c.ground : fill ? ds.c.ink : ds.c.muted}
              style={{ fontFamily: selected ? fontFamilies.bodySemiBold : fontFamilies.bodyMedium }}
            >
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Underlined<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const ds = useDs();
  return (
    <View role="tablist" accessibilityLabel={accessibilityLabel} style={styles.lineBar}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale key={o.value} role="tab" accessibilityLabel={o.label} aria-selected={selected} onPress={() => onChange(o.value)} style={[styles.lineTab, { borderBottomColor: selected ? ds.c.ink : 'transparent' }]}>
            <DsText variant="body" tone={selected ? 'ink' : 'muted'} style={{ fontFamily: fontFamilies.bodyMedium }}>
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lineBar: { flexDirection: 'row', gap: space.xl },
  lineTab: { minHeight: layout.minTapTarget, justifyContent: 'center', borderBottomWidth: 2 },
  track: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', gap: 2, padding: 3, borderRadius: radius.control, borderCurve: 'continuous' },
  fill: { alignSelf: 'stretch', gap: space.xs, padding: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  tab: { height: 38, paddingHorizontal: 14, borderRadius: radius.control - 3, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  fillTab: { flex: 1, height: 44, borderRadius: radius.pill },
  quiet: { padding: 2, gap: 2, borderWidth: 0, borderRadius: radius.control },
  quietTab: { height: 36, paddingHorizontal: space.sm, borderRadius: radius.control - 2 },
});
