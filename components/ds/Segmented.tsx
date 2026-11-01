import { Platform, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, type } from '@/constants/tokens';
import { useMaterialRoles } from '@/components/nav/material';
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
   * capsule: the page's own switch (Drinks, House-made, Bottles; Loved, Want to go):
   * a soft track with the pick raised on iOS and the web, Android's connected button group.
   */
  variant?: 'underline' | 'pill' | 'ink' | 'quiet' | 'capsule';
  /** Segments share the full width instead of hugging their labels. Underlined, that's a bar page's tabs: 15 on 20, centred (ppl-bar-top). */
  stretch?: boolean;
  /** Underline: the picked tab is underlined in the accent, not ink (ppl-bar-top). */
  accent?: boolean;
  /** A choice between values (radios) rather than tabs: a rounded box, unpicked labels muted (ppl-settings, ppl-what-people-see). */
  choice?: boolean;
  /** The track sits on a sheet or card, so it takes the ground colour. */
  onSurface?: boolean;
}

/** Tabs within a screen (Spec · Service · Family), underlined or as a pill control. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, variant = 'underline', stretch, accent, choice, onSurface }: SegmentedProps<T>) {
  const ds = useDs();
  if (variant === 'capsule') return <Capsule options={options} value={value} onChange={onChange} accessibilityLabel={accessibilityLabel} />;
  const pill = variant !== 'underline';
  const quiet = variant === 'quiet';
  return (
    <View
      role={choice ? 'radiogroup' : 'tablist'}
      accessibilityLabel={accessibilityLabel}
      style={pill ? [styles.track, { backgroundColor: onSurface ? ds.c.ground : ds.c.surface, borderColor: ds.c.line }, choice ? styles.box : null, quiet ? [styles.quiet, { backgroundColor: ds.c.line }] : null, stretch ? null : styles.hug] : [styles.bar, stretch ? styles.barStretch : null, { borderBottomColor: ds.c.line }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const a11y = choice ? { role: 'radio' as const, 'aria-checked': selected } : { role: 'tab' as const, 'aria-selected': selected };
        const line = selected ? (accent ? ds.accentText : ds.c.ink) : 'transparent';
        const fill = !selected ? 'transparent' : variant === 'ink' ? ds.c.ink : quiet ? ds.c.lineStrong : withAlpha(ds.c.ink, 0.16);
        return (
          <PressableScale
            key={o.value}
            {...a11y}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={pill ? [styles.segment, choice ? styles.boxSegment : null, quiet ? styles.quietSegment : null, stretch ? styles.flex : null, { backgroundColor: fill }] : [styles.tab, stretch ? styles.tabStretch : null, { borderBottomColor: line }]}
          >
            <DsText
              variant={quiet ? 'caption' : 'body'}
              numberOfLines={1}
              color={pill && selected && variant === 'ink' ? ds.c.ground : undefined}
              tone={selected || (variant === 'ink' && !choice) ? 'ink' : 'muted'}
              style={[{ ...(selected || variant === 'ink' ? font.semiBold : pill || stretch ? font.medium : font.regular) }, pill && !quiet ? styles.small : null, !pill && stretch ? type.label : null]}
            >
              {o.label}
            </DsText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The page's switch (Prod-drinks). Android (Prod-and): connected buttons, the pick a full pill with a check. */
function Capsule<T extends string>({ options, value, onChange, accessibilityLabel }: Pick<SegmentedProps<T>, 'options' | 'value' | 'onChange' | 'accessibilityLabel'>) {
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
  bar: { flexDirection: 'row', gap: space.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { minHeight: layout.minTapTarget, justifyContent: 'center', borderBottomWidth: 2, marginBottom: -1 },
  barStretch: { gap: 0 },
  tabStretch: { flex: 1, minWidth: 0, alignItems: 'center' },
  track: { flexDirection: 'row', gap: space.xs, padding: space.xs - 1, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  hug: { alignSelf: 'flex-start' },
  box: { borderRadius: radius.control },
  boxSegment: { borderRadius: radius.control - 3 },
  segment: { minHeight: layout.minTapTarget - space.xs, paddingHorizontal: space.lg + space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, paddingHorizontal: space.xs },
  quiet: { padding: 2, gap: 2, borderWidth: 0, borderRadius: radius.control },
  quietSegment: { minHeight: 36, paddingHorizontal: space.xs, borderRadius: radius.control - 2 },
  // The control's labels a step under body, as drawn (15 on 24).
  small: { fontSize: type.label.fontSize, lineHeight: type.label.lineHeight },
});
