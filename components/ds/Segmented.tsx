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
  /**
   * underline: tabs whose selected label is underlined (the default).
   * track: a full-width rounded track with the selected part filled in ink
   * (ppl-you, ppl-person). As tabs it's a pill; as a choice (`choice`) it's
   * a rounded box with muted unselected labels (ppl-settings, ppl-what-people-see).
   */
  look?: 'underline' | 'track';
  /** A choice between values (radio buttons) instead of tabs that switch what shows. */
  choice?: boolean;
  /** The track sits on a surface (a sheet or card), so it takes the ground colour. */
  onSurface?: boolean;
}

/** Tabs within a screen (Spec · Service · Family), or a one-of choice drawn as a track. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, look = 'underline', choice, onSurface }: SegmentedProps<T>) {
  const ds = useDs();
  const track = look === 'track';
  const trackStyle = track
    ? [styles.track, choice ? styles.box : [styles.pill, { borderColor: ds.c.line }], { backgroundColor: onSurface ? ds.c.ground : ds.c.surface }]
    : [styles.bar, { borderBottomColor: ds.c.line }];
  return (
    <View role={choice ? 'radiogroup' : 'tablist'} accessibilityLabel={accessibilityLabel} style={trackStyle}>
      {options.map((o) => {
        const selected = o.value === value;
        const a11y = choice ? { role: 'radio' as const, 'aria-checked': selected } : { role: 'tab' as const, 'aria-selected': selected };
        return (
          <PressableScale
            key={o.value}
            {...a11y}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={
              track
                ? [styles.part, choice ? styles.boxPart : styles.pillPart, { backgroundColor: selected ? ds.c.ink : 'transparent' }]
                : [styles.tab, { borderBottomColor: selected ? ds.c.ink : 'transparent' }]
            }
          >
            <DsText
              variant="body"
              color={track && selected ? ds.c.ground : selected || (track && !choice) ? ds.c.ink : ds.c.muted}
              numberOfLines={1}
              style={{ fontFamily: selected ? fontFamilies.bodySemiBold : track ? fontFamilies.bodyMedium : fontFamilies.body }}
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
  track: { flexDirection: 'row', gap: space.xs, padding: space.xs },
  pill: { borderRadius: radius.pill, borderWidth: 1 },
  box: { borderRadius: radius.control },
  part: { flex: 1, minWidth: 0, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  pillPart: { borderRadius: radius.pill },
  boxPart: { borderRadius: radius.control - space.xs },
});
