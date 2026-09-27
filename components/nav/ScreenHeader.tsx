import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, useGutter } from '@/components/ds';
import { CurrentUserAvatar } from '@/components/ui/UserAvatar';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { VenueSwitcher } from './VenueSwitcher';

/**
 * The top of every redesigned tab: the venue you're in, and you. "You" lives
 * here rather than in the tab bar, which keeps the tabs for the work.
 */
export function ScreenHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  return (
    <View style={[styles.row, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
      {/* Wide web has the chip in the sidebar (WebSideNav). */}
      {wide ? <View /> : <VenueSwitcher />}
      <PressableScale accessibilityLabel="You: profile and settings" onPress={() => router.push('/settings')} style={styles.avatar}>
        <CurrentUserAvatar size={32} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  avatar: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
});

/**
 * The header inside a list: ScreenHeader handles its own safe-area padding and
 * gutter, so this cancels the list's horizontal padding around it.
 */
export function ScreenHeaderSpacer() {
  const gutter = useGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScreenHeader />
    </View>
  );
}
