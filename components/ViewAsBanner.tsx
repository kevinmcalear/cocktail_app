import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useViewAs } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';

/**
 * "Viewing as Bartender" with Exit, over every screen while View as is on
 * (Settings › Preferences, or Brand › Preview as staff). A status, so screen
 * readers announce it when it appears. On the web it takes its own band at
 * the top and pushes the page down, so it never covers a page's back button
 * or title (tools-settings-viewas-phone); native floats it under the notch.
 */
export function ViewAsBanner() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();

  if (viewAsRoleLevel == null) return null;

  const pill = (
    <View role="status" style={[styles.pill, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <Body numberOfLines={1} style={[styles.label, styles.strong]}>{`Viewing as ${roleLabel(viewAsRoleLevel)}`}</Body>
      <PressableScale role="button" accessibilityLabel="Exit View as" disabled={isSaving} onPress={() => void setViewAsRoleLevel(null)} style={styles.exit}>
        <Body style={styles.strong}>Exit</Body>
      </PressableScale>
    </View>
  );
  if (Platform.OS === 'web') return <View style={[styles.band, { backgroundColor: ds.c.ground }]}>{pill}</View>;
  return <View style={[styles.float, { top: insets.top + space.sm }]}>{pill}</View>;
}

const styles = StyleSheet.create({
  band: { alignItems: 'center', paddingTop: space.lg, paddingBottom: space.xs, paddingHorizontal: space.lg },
  float: { position: 'absolute', alignSelf: 'center', zIndex: 9998, maxWidth: '92%' },
  pill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTapTarget + space.xs,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { flexShrink: 1 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  exit: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
});
