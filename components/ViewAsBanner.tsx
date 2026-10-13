import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { useViewAs } from '@/hooks/useViewAs';
import { roleLabel } from '@/lib/roles';

/**
 * "Viewing as Bartender" with Exit, over every screen while View as is on
 * (Settings › Preferences, or Brand › Preview as staff). A status, so screen
 * readers announce it when it appears. In an add wizard it sits below the
 * paper band's back button and progress, so they stay in sight.
 */
export function ViewAsBanner() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving } = useViewAs();
  const wizard = usePathname().startsWith('/add-');

  if (viewAsRoleLevel == null) return null;

  return (
    <View
      role="status"
      style={[styles.banner, { top: insets.top + space.sm + (wizard ? layout.minTapTarget * 2 + space.lg : 0), backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}
    >
      <Body numberOfLines={1} style={styles.label}>{`Viewing as ${roleLabel(viewAsRoleLevel)}`}</Body>
      <Button label="Exit" variant="primary" disabled={isSaving} onPress={() => void setViewAsRoleLevel(null)} />
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
});
