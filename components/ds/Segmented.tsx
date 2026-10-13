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
   * Service | Backstory on desktop).
   */
  variant?: 'underline' | 'pill' | 'ink';
  /** Pill and ink: segments share the full width instead of hugging their labels. */
  stretch?: boolean;
}

/** Tabs within a screen (Spec · Service · Family), underlined or as a pill control. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, variant = 'underline', stretch }: SegmentedProps<T>) {
  const ds = useDs();
  const pill = variant !== 'underline';
  return (
    <View
      role="tablist"
      accessibilityLabel={accessibilityLabel}
      style={pill ? [styles.track, { backgroundColor: ds.c.surface, borderColor: ds.c.line }, stretch ? null : styles.hug] : [styles.bar, { borderBottomColor: ds.c.line }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const fill = !selected ? 'transparent' : variant === 'ink' ? ds.c.ink : withAlpha(ds.c.ink, 0.16);
        return (
          <PressableScale
            key={o.value}
            {...a11y}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={pill ? [styles.segment, stretch ? styles.flex : null, { backgroundColor: fill }] : [styles.tab, { borderBottomColor: selected ? ds.c.ink : 'transparent' }]}
          >
            <DsText
              variant="body"
              numberOfLines={1}
              color={pill && selected && variant === 'ink' ? ds.c.ground : undefined}
              tone={selected || variant === 'ink' ? 'ink' : 'muted'}
              style={[{ fontFamily: selected || variant === 'ink' ? fontFamilies.bodySemiBold : pill ? fontFamilies.bodyMedium : fontFamilies.body }, pill ? styles.small : null]}
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
  // The control's labels a step under body, as drawn (15 on 24).
  small: { fontSize: type.body.fontSize - 2, lineHeight: type.body.lineHeight - 2 },
});
