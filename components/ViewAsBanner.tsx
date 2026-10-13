import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { backbar, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useViewAs } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';

/**
 * "Viewing as Bartender" with Exit, over every screen while View as is on
 * (Settings › Preferences, or Brand › Preview as staff). A status, so screen
 * readers announce it when it appears. An add wizard shows ViewAsPill in its
 * paper band instead, so nothing covers the progress or the drawing.
 */
export function ViewAsBanner() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  const wizard = usePathname().startsWith('/add-');

  if (viewAsRoleLevel == null || wizard) return null;

  return (
    <View role="status" style={[styles.banner, { top: insets.top + space.sm, backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <Body numberOfLines={1} style={styles.label}>{`Viewing as ${roleLabel(viewAsRoleLevel)}`}</Body>
      <Button label="Exit" variant="primary" disabled={isSaving} onPress={() => void setViewAsRoleLevel(null)} />
    </View>
  );
}

/** "Viewing as Bartender · Exit" as a small pill in an add wizard's paper band, in the flow under the drawing. */
export function ViewAsPill({ ink }: { ink: string }) {
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  if (viewAsRoleLevel == null) return null;
  return (
    <View role="status" style={[styles.pill, { backgroundColor: backbar.light.glass }]}>
      <Caption color={ink} numberOfLines={1} style={styles.pillText}>{`Viewing as ${roleLabel(viewAsRoleLevel)}`}</Caption>
      <PressableScale role="button" accessibilityLabel="Exit View as" disabled={isSaving} onPress={() => void setViewAsRoleLevel(null)} style={styles.exit}>
        <Caption color={ink} style={styles.pillText}>Exit</Caption>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9998,
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, paddingLeft: space.lg, borderRadius: radius.pill, maxWidth: '100%' },
  pillText: { fontFamily: fontFamilies.bodySemiBold, flexShrink: 1 },
  exit: { minHeight: layout.minTapTarget - space.sm, justifyContent: 'center', paddingHorizontal: space.md },
});
