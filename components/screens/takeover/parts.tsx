import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, partyHues, radius, space, STATUS } from '@/constants/tokens';
import { isHexColor, readableAccent, withAlpha } from '@/lib/color';

/** A bar's or brand's round mark: its first letter in the display face on its colour (Keep-phone's marks). */
export interface Mark {
  name: string;
  color?: string | null;
}

const hue = (name: string) => partyHues[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % partyHues.length];

export function BarMark({ name, color, size = 36, ring }: Mark & { size?: number; ring?: boolean }) {
  const ds = useDs();
  const bg = isHexColor(color) ? color : hue(name);
  return (
    <View
      aria-hidden
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring ? { borderWidth: 3, borderColor: ds.c.ground } : null,
      ]}
    >
      <DsText variant="body" color={ds.c.ground} style={{ fontFamily: displayFaces.instrument.regular, fontSize: size / 2, lineHeight: size * 0.62 }}>
        {name.slice(0, 1).toUpperCase()}
      </DsText>
    </View>
  );
}

/** Two bars' marks, the second tucked under the first (the guest's over the host's). */
export function Marks({ marks, size = 50 }: { marks: Mark[]; size?: number }) {
  return (
    <View aria-hidden style={styles.marks}>
      {marks.map((m, i) => (
        <View key={`${m.name}-${i}`} style={i ? { marginLeft: -size * 0.24 } : null}>
          <BarMark name={m.name} color={isHexColor(m.color) ? m.color : partyHues[(i + 1) % partyHues.length]} size={size} ring={i > 0} />
        </View>
      ))}
    </View>
  );
}

/** The accent row at the end of a group: "Add a guest bartender". */
export function AddRow({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const ds = useDs();
  return (
    <View role="listitem">
      <PressableScale role="button" accessibilityLabel={label} onPress={onPress} style={[styles.row, { borderTopColor: ds.c.line }]}>
        <IconSymbol name={icon} size={20} color={ds.accentText} />
        <DsText variant="body" color={ds.accentText} style={styles.words}>
          {label}
        </DsText>
      </PressableScale>
    </View>
  );
}

/** A small amber note with an icon: "Guest at Little Rye until Fri 7 Nov, 4am". */
export function WarnNote({ icon, text }: { icon: IconName; text: string }) {
  const ds = useDs();
  const ink = readableAccent(STATUS.warning, ds.c.ground);
  return (
    <View style={[styles.note, { backgroundColor: withAlpha(STATUS.warning, 0.16) }]}>
      <IconSymbol name={icon} size={18} color={ink} />
      <Caption color={ink} style={styles.words}>
        {text}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  marks: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm + 2, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  words: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card },
});
