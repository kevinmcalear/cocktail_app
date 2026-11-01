import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space } from '@/constants/tokens';

import { PressableScale } from './PressableScale';
import { DsText } from './Text';
import { useDs } from './theme';
import type { IconName } from './Button';

interface ExtendedFabProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Off: the round FAB, the label gone (it shrinks as the page scrolls). */
  open?: boolean;
  /** Where it sits over the page. */
  style?: StyleProp<ViewStyle>;
}

/** Android's home for a screen's one main action: Material 3's extended FAB, 56 tall, in the venue's accent. */
export function ExtendedFab({ label, icon, onPress, accessibilityLabel = label, open = true, style }: ExtendedFabProps) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[styles.fab, open ? styles.open : styles.round, { backgroundColor: ds.accentFill.fill }, style]}>
      <IconSymbol name={icon} size={20} color={ds.accentFill.text} />
      {open ? (
        <DsText color={ds.accentFill.text} style={styles.label}>
          {label}
        </DsText>
      ) : null}
    </PressableScale>
  );
}

const SIZE = 56;
const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, height: SIZE, minWidth: SIZE, borderRadius: radius.control + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, elevation: 3 },
  open: { paddingHorizontal: space.lg },
  round: { paddingHorizontal: 0 },
  label: { ...font.semiBold },
});
