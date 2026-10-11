import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, PressableScale, useGutter } from '@/components/ds';
import { CurrentUserAvatar } from '@/components/ui/UserAvatar';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';

import { CreateButton } from './CreateSheet';
import { VenueSwitcher, VenueWordmark } from './VenueSwitcher';

/**
 * The top of every redesigned tab on a phone: the logo (the venue menu) on
 * the left, New and you on the right, the page's big title below. In venue
 * mode "You" lives here rather than in the tab bar, which keeps the tabs for
 * the work. The You screen itself passes `you={false}` and gets Settings and
 * New, with no logo.
 *
 * Wide web has the logo, New and you in the side nav, so there is no avatar
 * on the page (you live in the sidebar's foot): a `title` and `actions` share
 * one line, or the row is just the space above the title. `wordmark` puts the
 * venue's name beside the logo, in its display face (Tonight only).
 */
export function ScreenHeader({ you = true, title, actions, wordmark }: { you?: boolean; title?: ReactNode; actions?: ReactNode; wordmark?: boolean }) {
  const router = useRouter();
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useIsWideWeb();
  const settings = <GlassButton accessibilityLabel="Settings" icon="gearshape" onPress={() => router.push('/settings')} />;
  if (wide) {
    const trailing = you ? actions : (
      <>
        {actions}
        {settings}
      </>
    );
    if (!title && !trailing) return <View style={styles.wide} />;
    return (
      <View style={[styles.row, styles.wideTitled, { paddingHorizontal: gutter }]}>
        {title ?? <View />}
        <View style={styles.end}>{trailing}</View>
      </View>
    );
  }
  return (
    <>
      <View style={[styles.row, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        {you ? (
          <View style={styles.start}>
            <VenueSwitcher />
            {wordmark && !home ? <VenueWordmark venue={active} /> : null}
          </View>
        ) : (
          <View />
        )}
        <View style={styles.end}>
          {actions}
          {you ? (
            <>
              <CreateButton />
              {/* Home mode has You as a tab; venue mode opens it over the tabs. */}
              <PressableScale role="link" accessibilityLabel="You: your profile and settings" onPress={() => (home ? router.navigate('/profile') : router.push('/you'))} style={styles.avatar}>
                <CurrentUserAvatar size={32} />
              </PressableScale>
            </>
          ) : (
            <>
              {settings}
              <CreateButton />
            </>
          )}
        </View>
      </View>
      {title ? <View style={{ paddingHorizontal: gutter }}>{title}</View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  // Wide web: the space above the title, where a phone has the logo row.
  wide: { height: space.xl },
  wideTitled: { minHeight: space.xxl + space.md, paddingTop: space.md },
  start: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
});

/**
 * The header inside a list: ScreenHeader handles its own safe-area padding and
 * gutter, so this cancels the list's horizontal padding around it.
 */
export function ScreenHeaderSpacer(props: { title?: ReactNode; actions?: ReactNode; wordmark?: boolean }) {
  const gutter = useGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScreenHeader {...props} />
    </View>
  );
}
