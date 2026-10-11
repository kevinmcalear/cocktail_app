import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsText, GlassSurface, PressableScale, useDs, useGutter, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

/** How tall the pinned bar is, for the page's bottom padding. */
export const ACTION_BAR_HEIGHT = 52 + space.xl * 2;

export interface BarAction {
  key: string;
  label: string;
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** The one primary action: Batch in venue mode (decision b13). */
  primary?: boolean;
}

/**
 * Batch, Rank it, I made it (board drink-phone-venue, "pinned action bar").
 * Phones pin it to the bottom over a fade into the ground; wide screens put
 * the same buttons in a row under the spec.
 */
export function DrinkActionBar({ actions, pinned }: { actions: BarAction[]; pinned: boolean }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  if (!actions.length) return null;
  const row = (
    <View style={[styles.row, pinned ? { left: gutter, right: gutter, bottom: insets.bottom + space.xl, position: 'absolute' } : null]}>
      {actions.map((a) => (
        <BarButton key={a.key} action={a} />
      ))}
    </View>
  );
  if (!pinned) return row;
  return (
    <>
      <LinearGradient
        colors={[withAlpha(ds.c.ground, 0), withAlpha(ds.c.ground, 0.92), ds.c.ground]}
        locations={[0, 0.45, 1]}
        style={[styles.fade, { height: ACTION_BAR_HEIGHT + insets.bottom + space.xl }]}
      />
      {row}
    </>
  );
}

function BarButton({ action }: { action: BarAction }) {
  const ds = useDs();
  const ink = action.primary ? ds.accentFill.text : ds.c.ink;
  const content = (
    <View style={styles.inner}>
      <IconSymbol name={action.icon} size={18} color={ink} />
      <DsText variant="body" color={ink} style={styles.label} numberOfLines={1}>
        {action.label}
      </DsText>
    </View>
  );
  return (
    <PressableScale accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} style={styles.flex}>
      {action.primary ? (
        <View style={[styles.button, { backgroundColor: ds.accentFill.fill }]}>{content}</View>
      ) : (
        <GlassSurface interactive style={styles.button}>
          {content}
        </GlassSurface>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  button: { height: 52, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  label: { fontFamily: fontFamilies.bodySemiBold },
});
