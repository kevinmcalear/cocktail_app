import { StyleSheet, View } from 'react-native';

import { DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space, STATUS } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';

/** One line above the drinks: a guest's allergy ("Egg in 1 drink · Clover Club") or a past menu's "This menu has ended". */
export function MenuPageBanner({ text, aside, warn, onPress }: { text: string; aside: string | null; warn: boolean; onPress?: () => void }) {
  const ds = useDs();
  const ink = warn ? readableAccent(STATUS.warning, ds.c.ground) : ds.c.ink;
  const Row = onPress ? PressableScale : View;
  return (
    <Row
      role={onPress ? 'link' : 'alert'}
      accessibilityLabel={[text, aside].filter(Boolean).join(': ')}
      onPress={onPress}
      style={[styles.banner, { backgroundColor: warn ? withAlpha(STATUS.warning, 0.18) : ds.c.raised }]}
    >
      <IconSymbol name={warn ? 'exclamationmark.triangle' : 'clock'} size={16} color={ink} />
      <DsText variant="label" color={ink} style={[styles.label, font.semiBold]}>
        {text}
      </DsText>
      {aside ? (
        <DsText variant="label" color={ink}>
          {aside}
        </DsText>
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  label: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 48, borderRadius: radius.control, borderCurve: 'continuous' },
});
