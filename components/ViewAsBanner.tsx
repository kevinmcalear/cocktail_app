import { usePathname } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { backbar, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useViewAs } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';

/**
 * "Viewing as Bartender" with Exit, over every screen while View as is on
 * (Settings › Preferences, or Brand › Preview as staff). A status, so screen
 * readers announce it when it appears. On the web it takes its own band at
 * the top and pushes the page down, so it never covers a page's back button
 * or title (tools-settings-viewas-phone); native floats it under the notch.
 * An add wizard shows ViewAsPill in its paper band instead, so nothing
 * covers the progress or the drawing.
 */
export function ViewAsBanner() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs({ fresh: true });
  const pathname = usePathname();

  // Setting up a venue or an account is the person's own work, not a role's view, and the pill would sit over the setup's Back and progress.
  if (viewAsRoleLevel == null || SETUP_ROUTES.some((r) => pathname.startsWith(r))) return null;

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

// Setup and the add wizards (which show ViewAsPill in their band instead).
const SETUP_ROUTES = ['/venue-setup', '/onboarding', '/age-check', '/add-'];

/** "Viewing as Bartender · Exit" as a small pill in an add wizard's paper band, in the flow under the drawing. */
export function ViewAsPill({ ink }: { ink: string }) {
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  if (viewAsRoleLevel == null) return null;
  return (
    <View role="status" style={[styles.wizardPill, { backgroundColor: backbar.light.glass }]}>
      <Caption color={ink} numberOfLines={1} style={styles.pillText}>{`Viewing as ${roleLabel(viewAsRoleLevel)}`}</Caption>
      <PressableScale role="button" accessibilityLabel="Exit View as" disabled={isSaving} onPress={() => void setViewAsRoleLevel(null)} style={styles.wizardExit}>
        <Caption color={ink} style={styles.pillText}>Exit</Caption>
      </PressableScale>
    </View>
  );
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
  wizardPill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, paddingLeft: space.lg, borderRadius: radius.pill, maxWidth: '100%' },
  pillText: { fontFamily: fontFamilies.bodySemiBold, flexShrink: 1 },
  wizardExit: { minHeight: layout.minTapTarget - space.sm, justifyContent: 'center', paddingHorizontal: space.md },
});
