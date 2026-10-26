import { StyleSheet, View } from 'react-native';

import { PressableScale, useDs } from '@/components/ds';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { layout, radius } from '@/constants/tokens';

/** One icon beside the Spec heading: a method or the glass (Eddie E43). */
export interface SpecMark {
  key: string;
  /** Read out: "Method: Shaken", "Glass: Double rocks". */
  label: string;
  /** A CustomIcons key. */
  icon: string;
  /** The glass opens the glass sheet, like the make line's Glass. */
  onPress?: () => void;
  accessibilityHint?: string;
}

const SIZE = 32;
// 32 drawn, 44 to tap.
const SLOP = (layout.minTapTarget - SIZE) / 2;

/**
 * The method and the glass as small line icons right after "Spec", so the
 * first glance says "shaken, double rocks". The make line under the spec
 * still says them in words (Kevin's pick A).
 */
export function SpecMarks({ marks }: { marks: SpecMark[] }) {
  const ds = useDs();
  if (!marks.length) return null;
  return (
    <View style={styles.row}>
      {marks.map((m) => {
        const icon = <CustomIcon name={m.icon} size={18} color={ds.c.ink} />;
        const box = [styles.box, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.raised }];
        return m.onPress ? (
          <PressableScale key={m.key} role="button" accessibilityLabel={m.label} accessibilityHint={m.accessibilityHint} hitSlop={SLOP} onPress={m.onPress} style={box}>
            {icon}
          </PressableScale>
        ) : (
          <View key={m.key} role="img" aria-label={m.label} style={box}>
            {icon}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  box: { width: SIZE, height: SIZE, borderRadius: radius.control - 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
