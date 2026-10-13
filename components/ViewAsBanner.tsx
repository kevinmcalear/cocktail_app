import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useViewAs } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';

/**
 * "Viewing as Bartender" with Exit, over every screen while View as is on
 * (Settings › Preferences, or Brand › Preview as staff). A status, so screen
 * readers announce it when it appears.
 */
export function ViewAsBanner() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  const pathname = usePathname();

  // Setting up a venue or an account is the person's own work, not a role's view, and the pill would sit over the setup's Back and progress.
  if (viewAsRoleLevel == null || SETUP_ROUTES.some((r) => pathname.startsWith(r))) return null;

  return (
    <View
      role="status"
      style={[styles.banner, { top: insets.top + space.sm, backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}
    >
      <Body numberOfLines={1} style={styles.label}>{`Viewing as ${roleLabel(viewAsRoleLevel)}`}</Body>
      <Button label="Exit" variant="primary" disabled={isSaving} onPress={() => void setViewAsRoleLevel(null)} />
    </View>
  );
}

const SETUP_ROUTES = ['/venue-setup', '/onboarding', '/age-check'];

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
});
