import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, PressableScale, useGutter } from '@/components/ds';
import { CurrentUserAvatar } from '@/components/ui/UserAvatar';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';

import { CreateButton } from './CreateSheet';
import { VenueSwitcher } from './VenueSwitcher';

/**
 * The top of every redesigned tab: the venue you're in, New (make something
 * or pick up a draft), and you. In venue mode "You" lives here rather than in
 * the tab bar, which keeps the tabs for the work. The You screen itself passes
 * `you={false}` and gets Settings in the avatar's place.
 */
export function ScreenHeader({ you = true }: { you?: boolean }) {
  const router = useRouter();
  const home = useMode().mode === 'home';
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  return (
    <View style={[styles.row, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
      {/* Wide web has the chip in the sidebar (WebSideNav). */}
      {wide ? <View /> : <VenueSwitcher />}
      <View style={styles.end}>
        {/* Wide web has New in the sidebar. */}
        {wide ? null : <CreateButton />}
        {you ? (
          // Home mode has You as a tab; venue mode opens it over the tabs.
          <PressableScale role="link" accessibilityLabel="You: your profile and settings" onPress={() => (home ? router.navigate('/profile') : router.push('/you'))} style={styles.avatar}>
            <CurrentUserAvatar size={32} />
          </PressableScale>
        ) : (
          <GlassButton accessibilityLabel="Settings" icon="gearshape" onPress={() => router.push('/settings')} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
