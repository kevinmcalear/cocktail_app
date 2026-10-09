import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
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
 *
 * `actions` sit just before the avatar. A `title` goes under the row, or in
 * it on wide web, where the row is only the avatar, so title, actions and
 * avatar share one line.
 */
export function ScreenHeader({ you = true, title, actions }: { you?: boolean; title?: ReactNode; actions?: ReactNode }) {
  const router = useRouter();
  const home = useMode().mode === 'home';
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  const avatar = (
    // Home mode has You as a tab; venue mode opens it over the tabs.
    <PressableScale role="link" accessibilityLabel="You: your profile and settings" onPress={() => (home ? router.navigate('/profile') : router.push('/you'))} style={styles.avatar}>
      <CurrentUserAvatar size={32} />
    </PressableScale>
  );
  // Wide web has the chip and New in the sidebar (WebSideNav); the row keeps
  // only your avatar, at the same height, so every page's title starts level.
  if (wide && you) {
    if (!title && !actions) return <View style={[styles.wide, styles.wideRow, { paddingHorizontal: gutter }]}>{avatar}</View>;
    return (
      <View style={[styles.row, styles.wideTitled, { paddingHorizontal: gutter }]}>
        {title ?? <View />}
        <View style={styles.pair}>
          {actions}
          {avatar}
        </View>
      </View>
    );
  }
  return (
    <>
      <View style={[styles.row, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        {wide ? <View /> : <VenueSwitcher />}
        <View style={styles.end}>
          {wide ? null : <CreateButton />}
          <View style={styles.pair}>
            {actions}
            {you ? (
              avatar
            ) : (
              <GlassButton accessibilityLabel="Settings" icon="gearshape" onPress={() => router.push('/settings')} />
            )}
          </View>
        </View>
      </View>
      {title ? <View style={{ paddingHorizontal: gutter }}>{title}</View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  wide: { height: space.xxl },
  wideRow: { height: space.xxl + space.md, paddingTop: space.md, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  wideTitled: { minHeight: space.xxl + space.md, paddingTop: space.md },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // No gap: the avatar's tap target already pads its left side.
  pair: { flexDirection: 'row', alignItems: 'center' },
  avatar: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
});

/**
 * The header inside a list: ScreenHeader handles its own safe-area padding and
 * gutter, so this cancels the list's horizontal padding around it.
 */
export function ScreenHeaderSpacer(props: { title?: ReactNode; actions?: ReactNode }) {
  const gutter = useGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScreenHeader {...props} />
    </View>
  );
}
