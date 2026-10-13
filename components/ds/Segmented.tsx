import { StyleSheet, View } from 'react-native';

import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /**
   * underline: page tabs (History's Tree | Timeline). pill: a segmented control
   * in a rounded track, the picked one softly filled (the batch sheet). ink:
   * the same track with the picked one filled in ink (the drink page's Spec |
   * Service | Backstory on desktop). quiet: the small switch inside a sheet
   * (New event's Add one | From a calendar link), caption text on a raised pick.
   */
  variant?: 'underline' | 'pill' | 'ink' | 'quiet';
  /** Pill, ink and quiet: segments share the full width instead of hugging their labels. */
  stretch?: boolean;
}

/** Tabs within a screen (Spec · Service · Family), underlined or as a pill control. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, variant = 'underline', stretch }: SegmentedProps<T>) {
  const ds = useDs();
  const pill = variant !== 'underline';
  const quiet = variant === 'quiet';
  return (
    <View
      role="tablist"
      accessibilityLabel={accessibilityLabel}
      style={pill ? [styles.track, { backgroundColor: ds.c.surface, borderColor: ds.c.line }, quiet ? [styles.quiet, { backgroundColor: ds.c.line }] : null, stretch ? null : styles.hug] : [styles.bar, { borderBottomColor: ds.c.line }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const fill = !selected ? 'transparent' : variant === 'ink' ? ds.c.ink : quiet ? ds.c.lineStrong : withAlpha(ds.c.ink, 0.16);
        return (
          <PressableScale
            key={o.value}
            role="tab"
            accessibilityLabel={o.label}
            aria-selected={selected}
            onPress={() => onChange(o.value)}
            style={pill ? [styles.segment, quiet ? styles.quietSegment : null, stretch ? styles.flex : null, { backgroundColor: fill }] : [styles.tab, { borderBottomColor: selected ? ds.c.ink : 'transparent' }]}
          >
            <DsText
              variant={quiet ? 'caption' : 'body'}
              numberOfLines={1}
              color={pill && selected && variant === 'ink' ? ds.c.ground : undefined}
              tone={selected || variant === 'ink' ? 'ink' : 'muted'}
              style={[{ fontFamily: selected || variant === 'ink' ? fontFamilies.bodySemiBold : pill ? fontFamilies.bodyMedium : fontFamilies.body }, pill && !quiet ? styles.small : null]}
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
  track: { flexDirection: 'row', gap: space.xs, padding: space.xs - 1, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  hug: { alignSelf: 'flex-start' },
  segment: { minHeight: layout.minTapTarget - space.xs, paddingHorizontal: space.lg + space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, paddingHorizontal: space.xs },
  quiet: { padding: 2, gap: 2, borderWidth: 0, borderRadius: radius.control },
  quietSegment: { minHeight: 36, paddingHorizontal: space.xs, borderRadius: radius.control - 2 },
  // The control's labels a step under body, as drawn (15 on 24).
  small: { fontSize: type.body.fontSize - 2, lineHeight: type.body.lineHeight - 2 },
});
